import { describe, expect, it } from 'vitest'
import type { DeliverySettings } from '../store/storeSettings.ts'
import { type CustomerDraft, EMPTY_CUSTOMER, OTHER_ZONE, checkCustomer, feeCents, feeFor } from './delivery.ts'

const TAXAS: DeliverySettings = {
  mode: 'taxas',
  zones: [
    { id: 'centro', name: 'Centro', feeCents: 300 },
    { id: 'longe', name: 'Bairros afastados', feeCents: 500 },
  ],
}
const GRATIS: DeliverySettings = { mode: 'gratis', zones: [] }
const COMBINAR: DeliverySettings = { mode: 'combinar', zones: [] }

const draft = (patch: Partial<CustomerDraft>): CustomerDraft => ({ ...EMPTY_CUSTOMER, name: 'Maria', ...patch })
const entrega = (patch: Partial<CustomerDraft> = {}) =>
  draft({ kind: 'entrega', street: 'Rua das Flores', number: '12', district: 'Centro', ...patch })

describe('frete do pedido (pedido de 2026-11-17)', () => {
  it('retirada na loja é grátis e não pede endereço', () => {
    const result = checkCustomer(draft({ kind: 'retirada' }), TAXAS)
    expect(result).toEqual({ ok: true, customer: { name: 'Maria', phone: null, fulfillment: { kind: 'retirada' }, fee: { kind: 'retirada' } } })
    expect(feeCents({ kind: 'retirada' })).toBe(0)
  })

  it('entrega grátis', () => {
    expect(feeFor(entrega(), GRATIS)).toEqual({ kind: 'gratis' })
  })

  it('taxa do bairro escolhido na lista, com o nome do bairro', () => {
    expect(feeFor(entrega({ zoneId: 'longe' }), TAXAS)).toEqual({ kind: 'taxa', cents: 500, zoneName: 'Bairros afastados' })
    expect(feeCents({ kind: 'taxa', cents: 500, zoneName: 'Bairros afastados' })).toBe(500)
    const result = checkCustomer(entrega({ zoneId: 'longe', district: '' }), TAXAS)
    expect(result.ok && result.customer.fulfillment).toEqual({ kind: 'entrega', street: 'Rua das Flores', number: '12', district: 'Bairros afastados', reference: null })
  })

  it('"Outro bairro" fica a combinar e pede o bairro escrito', () => {
    expect(feeFor(entrega({ zoneId: OTHER_ZONE }), TAXAS)).toEqual({ kind: 'combinar' })
    const missing = checkCustomer(entrega({ zoneId: OTHER_ZONE, district: ' ' }), TAXAS)
    expect(missing.ok ? null : missing.problems).toEqual({ district: 'Escreva o bairro.' })
    const result = checkCustomer(entrega({ zoneId: OTHER_ZONE, district: 'Sítio Novo' }), TAXAS)
    expect(result.ok && result.customer.fulfillment).toMatchObject({ district: 'Sítio Novo' })
  })

  it('a combinar, ou lista de bairros vazia: frete a combinar, com o bairro escrito', () => {
    expect(feeFor(entrega(), COMBINAR)).toEqual({ kind: 'combinar' })
    expect(feeFor(entrega(), { mode: 'taxas', zones: [] })).toEqual({ kind: 'combinar' })
    expect(feeCents({ kind: 'combinar' })).toBe(0)
  })

  it('bairro escolhido que saiu da lista: pede para escolher de novo', () => {
    expect(feeFor(entrega({ zoneId: 'sumiu' }), TAXAS)).toBeNull()
    const result = checkCustomer(entrega({ zoneId: 'sumiu' }), TAXAS)
    expect(result.ok ? null : result.problems).toEqual({ zone: 'Escolha o bairro.' })
  })

  it('sem escolher entrega ou retirada, não há frete', () => {
    expect(feeFor(draft({}), TAXAS)).toBeNull()
  })
})

describe('dados do cliente (pedido de 2026-11-17)', () => {
  it('nome obrigatório; telefone opcional, mas com DDD quando escrito', () => {
    const result = checkCustomer({ ...EMPTY_CUSTOMER, phone: '99999-000' }, COMBINAR)
    expect(result.ok ? null : result.problems).toEqual({
      name: 'Escreva seu nome.',
      phone: 'Telefone com DDD, por exemplo (83) 99999-0000.',
      kind: 'Escolha entrega ou retirada na loja.',
    })
    const ok = checkCustomer(draft({ name: '  Maria  da Silva ', phone: '83 99999 0000', kind: 'retirada' }), COMBINAR)
    expect(ok.ok && [ok.customer.name, ok.customer.phone]).toEqual(['Maria da Silva', '(83) 99999-0000'])
  })

  it('na entrega, rua, número e bairro são obrigatórios; a referência é opcional', () => {
    const result = checkCustomer(entrega({ street: '', number: ' ', district: '' }), COMBINAR)
    expect(result.ok ? null : result.problems).toEqual({
      street: 'Escreva a rua.',
      number: 'Escreva o número (ou s/n).',
      district: 'Escreva o bairro.',
    })
    const ok = checkCustomer(entrega({ reference: '  perto da praça ' }), COMBINAR)
    expect(ok.ok && ok.customer.fulfillment).toEqual({ kind: 'entrega', street: 'Rua das Flores', number: '12', district: 'Centro', reference: 'perto da praça' })
    expect(ok.ok && ok.customer.fee).toEqual({ kind: 'combinar' })
  })

  it('na lista de bairros, falta escolher o bairro', () => {
    const result = checkCustomer(entrega({ zoneId: null }), TAXAS)
    expect(result.ok ? null : result.problems).toEqual({ zone: 'Escolha o bairro.' })
  })
})
