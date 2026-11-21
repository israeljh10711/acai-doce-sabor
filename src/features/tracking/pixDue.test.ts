import { describe, expect, it } from 'vitest'
import { pixDue } from './pixDue.ts'

type Input = Parameters<typeof pixDue>[0]

const view = (patch: Partial<Input> = {}): Input => ({
  paymentMethod: 'pix',
  status: 'novo',
  totalCents: 2000,
  additions: [],
  fee: { kind: 'local', cents: 0, zone: null },
  ...patch,
})
const batch = (subtotalCents: number) => ({ createdAt: '2026-11-21T18:30:00.000Z', subtotalCents, itemsBlock: '', items: [] })

describe('valor do Pix no acompanhamento (2026-11-21)', () => {
  it('sem acréscimos: o total do pedido', () => {
    expect(pixDue(view())).toEqual({ totalCents: 2000, beforeAdditionsCents: 2000, additionsCents: 0, feePending: false })
  })

  it('com acréscimos: o total atualizado, o valor de antes e a diferença (R$ 20,00 + R$ 8,00)', () => {
    expect(pixDue(view({ totalCents: 2800, additions: [batch(500), batch(300)] }))).toEqual({
      totalCents: 2800,
      beforeAdditionsCents: 2000,
      additionsCents: 800,
      feePending: false,
    })
  })

  it('o valor acompanha o pedido: um acréscimo novo muda o total e a diferença', () => {
    const before = pixDue(view({ totalCents: 2500, additions: [batch(500)] }))
    const after = pixDue(view({ totalCents: 2800, additions: [batch(500), batch(300)] }))
    expect([before?.totalCents, before?.additionsCents, after?.totalCents, after?.additionsCents]).toEqual([2500, 500, 2800, 800])
  })

  it('entrega a combinar: avisa que o frete ainda não está no total', () => {
    expect(pixDue(view({ fee: { kind: 'combinar', cents: 0, zone: null } }))?.feePending).toBe(true)
  })

  it('outra forma de pagamento, ou pedido cancelado: sem Pix a pagar', () => {
    expect(pixDue(view({ paymentMethod: 'dinheiro' }))).toBeNull()
    expect(pixDue(view({ paymentMethod: null }))).toBeNull()
    expect(pixDue(view({ status: 'cancelado' }))).toBeNull()
  })
})
