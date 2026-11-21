import { describe, expect, it } from 'vitest'
import type { DeliverySettings } from '../store/storeSettings.ts'
import { DEFAULT_STORE_SETTINGS, storePlaceText } from '../store/storeSettings.ts'
import { COMBINAR_PHONE_TEXT, type CustomerDraft, EMPTY_CUSTOMER, OTHER_ZONE, addressPatch, checkCustomer, draftForStorage, feeCents, feeFor, parseCustomerDraft } from './delivery.ts'

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
    expect(result.ok && result.customer.fulfillment).toEqual({ kind: 'entrega', street: 'Rua das Flores', number: '12', district: 'Bairros afastados', reference: null, gps: null })
  })

  it('"Outro bairro" fica a combinar e pede o bairro escrito', () => {
    expect(feeFor(entrega({ zoneId: OTHER_ZONE }), TAXAS)).toEqual({ kind: 'combinar' })
    const missing = checkCustomer(entrega({ zoneId: OTHER_ZONE, district: ' ', phone: '83999990000' }), TAXAS)
    expect(missing.ok ? null : missing.problems).toEqual({ district: 'Escreva o bairro.' })
    const result = checkCustomer(entrega({ zoneId: OTHER_ZONE, district: 'Sítio Novo', phone: '83999990000' }), TAXAS)
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
      kind: 'Escolha entrega, retirada ou comer no local.',
    })
    const ok = checkCustomer(draft({ name: '  Maria  da Silva ', phone: '83 99999 0000', kind: 'retirada' }), COMBINAR)
    expect(ok.ok && [ok.customer.name, ok.customer.phone]).toEqual(['Maria da Silva', '(83) 99999-0000'])
  })

  it('na entrega, rua, número e bairro são obrigatórios; a referência é opcional', () => {
    const result = checkCustomer(entrega({ street: '', number: ' ', district: '', phone: '83999990000' }), COMBINAR)
    expect(result.ok ? null : result.problems).toEqual({
      street: 'Escreva a rua.',
      number: 'Escreva o número (ou s/n).',
      district: 'Escreva o bairro.',
    })
    const ok = checkCustomer(entrega({ reference: '  perto da praça ', phone: '83999990000' }), COMBINAR)
    expect(ok.ok && ok.customer.fulfillment).toEqual({ kind: 'entrega', street: 'Rua das Flores', number: '12', district: 'Centro', reference: 'perto da praça', gps: null })
    expect(ok.ok && ok.customer.fee).toEqual({ kind: 'combinar' })
  })

  it('frete a combinar (2026-11-21): telefone obrigatório, com o aviso de que a loja vai ligar', () => {
    for (const [label, customer, settings] of [
      ['modo "a combinar"', entrega(), COMBINAR],
      ['lista de bairros vazia', entrega(), { mode: 'taxas', zones: [] } as DeliverySettings],
      ['"Outro bairro"', entrega({ zoneId: OTHER_ZONE, district: 'Sítio Novo' }), TAXAS],
    ] as const) {
      const result = checkCustomer(customer, settings)
      expect([label, result.ok ? null : result.problems]).toEqual([label, { phone: COMBINAR_PHONE_TEXT }])
      expect(checkCustomer({ ...customer, phone: '(83) 99999-0000' }, settings).ok).toBe(true)
    }
    expect(COMBINAR_PHONE_TEXT).toBe('Para entregas com frete a combinar, informe seu telefone. A loja entrará em contato para confirmar o valor da entrega.')
    // Telefone escrito errado: vale a mensagem do DDD.
    const wrong = checkCustomer(entrega({ phone: '123' }), COMBINAR)
    expect(wrong.ok ? null : wrong.problems).toEqual({ phone: 'Telefone com DDD, por exemplo (83) 99999-0000.' })
  })

  it('frete conhecido (bairro com taxa, grátis), retirar e comer no local: telefone continua opcional', () => {
    expect(checkCustomer(entrega({ zoneId: 'centro' }), TAXAS).ok).toBe(true)
    expect(checkCustomer(entrega(), GRATIS).ok).toBe(true)
    expect(checkCustomer(draft({ kind: 'retirada' }), COMBINAR).ok).toBe(true)
    expect(checkCustomer(draft({ kind: 'local' }), COMBINAR).ok).toBe(true)
  })

  it('na lista de bairros, falta escolher o bairro', () => {
    const result = checkCustomer(entrega({ zoneId: null }), TAXAS)
    expect(result.ok ? null : result.problems).toEqual({ zone: 'Escolha o bairro.' })
  })
})

describe('dados guardados na aba (pedido de 2026-11-17)', () => {
  it('voltam iguais; campo estranho ou de tipo errado vira vazio', () => {
    const saved = entrega({ zoneId: 'centro', reference: 'casa azul' })
    expect(parseCustomerDraft(JSON.parse(JSON.stringify(saved)))).toEqual(saved)
    expect(parseCustomerDraft({ name: 5, kind: 'voando', zoneId: 3, street: 'Rua A', extra: 'x' })).toEqual({ ...EMPTY_CUSTOMER, street: 'Rua A' })
    expect(parseCustomerDraft(null)).toEqual(EMPTY_CUSTOMER)
  })
})

describe('três modalidades e GPS (pedido de 2026-11-20)', () => {
  const GPS = { lat: -7.220987, lng: -37.254124 }

  it('comer no local: grátis, sem endereço, e diferente da retirada', () => {
    const result = checkCustomer(draft({ kind: 'local', zoneId: 'longe', street: 'Rua A', number: '1' }), TAXAS)
    expect(result).toEqual({ ok: true, customer: { name: 'Maria', phone: null, fulfillment: { kind: 'local' }, fee: { kind: 'local' } } })
    expect(feeFor(draft({ kind: 'local' }), TAXAS)).toEqual({ kind: 'local' })
    expect(feeCents({ kind: 'local' })).toBe(0)
    expect(feeFor(draft({ kind: 'retirada' }), TAXAS)).toEqual({ kind: 'retirada' })
  })

  it('trocar entrega com bairro pago por retirar ou comer no local zera o frete na hora', () => {
    const paid = entrega({ zoneId: 'longe' })
    expect(feeCents(feeFor(paid, TAXAS) ?? { kind: 'combinar' })).toBe(500)
    for (const kind of ['retirada', 'local'] as const) {
      const fee = feeFor({ ...paid, kind }, TAXAS)
      expect(fee && feeCents(fee)).toBe(0)
    }
    // E volta: entrega recalcula pelo bairro.
    expect(feeFor({ ...paid, kind: 'local' }, TAXAS) && feeFor(paid, TAXAS)).toEqual({ kind: 'taxa', cents: 500, zoneName: 'Bairros afastados' })
  })

  it('o GPS vai junto só na entrega; é opcional', () => {
    const withGps = checkCustomer(entrega({ gps: GPS }), GRATIS)
    expect(withGps.ok && withGps.customer.fulfillment).toMatchObject({ kind: 'entrega', gps: GPS })
    const without = checkCustomer(entrega(), GRATIS)
    expect(without.ok && without.customer.fulfillment).toMatchObject({ kind: 'entrega', gps: null })
    for (const kind of ['retirada', 'local'] as const) {
      const other = checkCustomer(draft({ kind, gps: GPS }), GRATIS)
      expect(other.ok && other.customer.fulfillment).toEqual({ kind })
    }
  })

  it('o GPS não substitui o endereço: sem rua e número, a entrega não passa', () => {
    const result = checkCustomer(entrega({ gps: GPS, street: '', number: '' }), GRATIS)
    expect(result.ok ? null : result.problems).toEqual({ street: 'Escreva a rua.', number: 'Escreva o número (ou s/n).' })
  })

  it('número aceita 12, 12A e S/N', () => {
    for (const number of ['12', '12A', 'S/N']) {
      const result = checkCustomer(entrega({ number }), GRATIS)
      expect(result.ok && result.customer.fulfillment).toMatchObject({ number })
    }
  })

  it('dados recebidos: aceita "local" e GPS válido; GPS inválido vira nulo', () => {
    expect(parseCustomerDraft({ name: 'Ana', kind: 'local' })).toEqual({ ...EMPTY_CUSTOMER, name: 'Ana', kind: 'local' })
    expect(parseCustomerDraft({ kind: 'entrega', gps: { lat: -7.2209871234, lng: -37.254124 } }).gps).toEqual({ lat: -7.220987, lng: -37.254124 })
    expect(parseCustomerDraft({ kind: 'entrega', gps: { lat: 200, lng: -37 } }).gps).toBeNull()
    expect(parseCustomerDraft({ kind: 'entrega', gps: 'aqui' }).gps).toBeNull()
  })

  it('o que fica guardado na aba nunca leva o GPS (não volta de outra sessão)', () => {
    const saved = draftForStorage(entrega({ gps: GPS, zoneId: 'centro' }))
    expect(saved).toEqual(entrega({ gps: null, zoneId: 'centro' }))
    expect(parseCustomerDraft(JSON.parse(JSON.stringify(saved))).gps).toBeNull()
  })

  it('endereço da loja para os cartões e a comanda: "Rua Francisco Tota, 12 — Teixeira, PB"', () => {
    expect(storePlaceText(DEFAULT_STORE_SETTINGS.contact)).toBe('Rua Francisco Tota, 12 — Teixeira, PB')
    expect(storePlaceText({ ...DEFAULT_STORE_SETTINGS.contact, street: 'Av. Nova, 99', city: 'Patos' })).toBe('Av. Nova, 99 — Patos, PB')
  })
})

describe('endereço sugerido pelo GPS (pedido de 2026-11-20)', () => {
  const GUESS = { street: 'Rua Francisco Tota', number: '12', district: 'Centro' }

  it('preenche só o que está vazio: o que o cliente escreveu fica', () => {
    expect(addressPatch(draft({ kind: 'entrega' }), GUESS, [])).toEqual({ street: 'Rua Francisco Tota', number: '12', district: 'Centro' })
    expect(addressPatch(entrega({ street: 'Rua Nova', number: '', district: '' }), GUESS, [])).toEqual({ number: '12', district: 'Centro' })
    expect(addressPatch(entrega(), GUESS, [])).toEqual({})
    expect(addressPatch(draft({ kind: 'entrega', street: '  ' }), { street: 'Rua A', number: null, district: null }, [])).toEqual({ street: 'Rua A' })
  })

  it('com a lista de bairros: escolhe o de mesmo nome (sem acento ou maiúsculas), só se nenhum foi escolhido', () => {
    const zones = [...TAXAS.zones, { id: 'sao-jose', name: 'São José', feeCents: 400 }]
    expect(addressPatch(draft({ kind: 'entrega' }), { ...GUESS, district: 'sao jose' }, zones)).toMatchObject({ zoneId: 'sao-jose' })
    expect(addressPatch(draft({ kind: 'entrega' }), GUESS, zones)).toMatchObject({ zoneId: 'centro' })
    expect(addressPatch(draft({ kind: 'entrega', zoneId: 'longe' }), GUESS, zones)).not.toHaveProperty('zoneId')
    expect(addressPatch(draft({ kind: 'entrega' }), { ...GUESS, district: 'Bairro Que Não Existe' }, zones)).not.toHaveProperty('zoneId')
    // "Outro bairro" escolhido e o bairro escrito vazio: preenche o escrito.
    expect(addressPatch(draft({ kind: 'entrega', zoneId: OTHER_ZONE }), GUESS, zones)).toMatchObject({ district: 'Centro' })
  })
})
