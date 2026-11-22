import { describe, expect, it } from 'vitest'
import { parseStoreSettingsChange } from '../store/storeSettings.ts'
import { readContact, readHours, readZones, timeInput, withSavedZoneIds } from './storeForm.ts'

describe('formulários da loja no modo vendedor (pedido de 2026-11-17)', () => {
  it('horário digitado: "13:30" em minutos; fechar às 00:00 é a meia-noite', () => {
    expect(readHours('13:00', '21:00')).toEqual({ ok: true, hours: { opensAt: 780, closesAt: 1260 } })
    expect(readHours('14:00', '00:00')).toEqual({ ok: true, hours: { opensAt: 840, closesAt: 1440 } })
    expect(readHours('04:30', '21:00')).toEqual({ ok: false, problem: 'A abertura precisa ser a partir das 05:00.' })
    expect(readHours('15:00', '14:00')).toEqual({ ok: false, problem: 'O fechamento precisa ser depois da abertura (no máximo 00:00).' })
    expect(readHours('', '21:00')).toEqual({ ok: false, problem: 'Escolha a hora de abrir e a de fechar.' })
    expect([timeInput(780), timeInput(810), timeInput(1440)]).toEqual(['13:00', '13:30', '00:00'])
  })

  it('bairros: nome e valor; linha toda vazia é ignorada; nome repetido ou valor errado não passa', () => {
    expect(
      readZones(
        [
          { id: 'centro', name: ' Centro ', price: '3,00' },
          { name: '', price: '' },
          { name: 'Alto da Boa Vista', price: '5' },
          { name: 'Sítio', price: '0' },
        ],
        () => 'abcd',
      ),
    ).toEqual({
      ok: true,
      zones: [
        { id: 'centro', name: 'Centro', feeCents: 300 },
        { id: 'bairro-alto-da-boa-vista-abcd', name: 'Alto da Boa Vista', feeCents: 500 },
        { id: 'bairro-sitio-abcd', name: 'Sítio', feeCents: 0 },
      ],
    })
    expect(readZones([{ name: 'Centro', price: '3' }, { name: 'centro', price: '4' }])).toEqual({ ok: false, problem: 'Há bairros com o mesmo nome.' })
    expect(readZones([{ name: 'Centro', price: 'abc' }])).toEqual({ ok: false, problem: 'Confira os bairros: cada um com nome e valor (ex.: 3,00).' })
    expect(readZones([{ name: '', price: '3' }])).toEqual({ ok: false, problem: 'Confira os bairros: cada um com nome e valor (ex.: 3,00).' })
  })

  it('contato: WhatsApp com DDD, rua, cidade e UF com 2 letras', () => {
    expect(readContact({ whatsapp: '83 99699 9980', street: 'Rua Francisco Tota, 12', city: 'Teixeira', uf: 'pb' })).toEqual({
      ok: true,
      contact: { whatsapp: '(83) 99699-9980', street: 'Rua Francisco Tota, 12', city: 'Teixeira', uf: 'PB' },
    })
    expect(readContact({ whatsapp: '9980', street: ' ', city: '', uf: 'Paraíba' })).toEqual({
      ok: false,
      problems: {
        whatsapp: 'WhatsApp com DDD, por exemplo (83) 99699-9980.',
        street: 'Escreva a rua e o número.',
        city: 'Escreva a cidade.',
        uf: 'Use a sigla do estado, com 2 letras (ex.: PB).',
      },
    })
  })
})

describe('bairro com nome comprido (achado da auditoria E2E, 2026-11-21)', () => {
  it('o id cabe no limite das configurações e o bairro não some ao salvar', () => {
    const read = readZones([{ name: 'E2E-ACAI-TEST-Bairro Desligado', price: '6,00' }, { name: 'Bairro com nome bem comprido da cidade', price: '3,00' }], () => 'abcd')
    if (!read.ok) throw new Error(read.problem)
    for (const zone of read.zones) expect(zone.id.length).toBeLessThanOrEqual(40)
    const parsed = parseStoreSettingsChange({ delivery: { mode: 'taxas', zones: read.zones } })
    expect(parsed.delivery?.zones.map((zone) => zone.name)).toEqual(['E2E-ACAI-TEST-Bairro Desligado', 'Bairro com nome bem comprido da cidade'])
  })
})

describe('bairro novo mantém o id depois de salvar (achado da auditoria E2E, 2026-11-21)', () => {
  const rows = [
    { name: 'Centro', price: '3,00' },
    { name: '', price: '' },
    { id: 'bairro-velho-ab12', name: 'Velho', price: '2,00' },
  ]
  it('sem o id gravado, o salvar seguinte dava outro id ao mesmo bairro (o problema)', () => {
    const first = readZones(rows, () => 'aaaa')
    const second = readZones(rows, () => 'bbbb')
    if (!first.ok || !second.ok) throw new Error('bairros inválidos')
    expect(second.zones[0].id).not.toBe(first.zones[0].id)
  })
  it('com o id gravado nas linhas, salvar de novo (o horário, o Pix...) mantém os mesmos ids', () => {
    const first = readZones(rows, () => 'aaaa')
    if (!first.ok) throw new Error('bairros inválidos')
    const after = withSavedZoneIds(rows, first.zones)
    const second = readZones(after, () => 'bbbb')
    if (!second.ok) throw new Error('bairros inválidos')
    expect(second.zones.map((zone) => zone.id)).toEqual(first.zones.map((zone) => zone.id))
    expect(after[0].id).toBe('bairro-centro-aaaa')
    // A linha vazia continua vazia e sem id; o bairro que já tinha id fica com o dele.
    expect(after[1]).toEqual({ name: '', price: '' })
    expect(after[2].id).toBe('bairro-velho-ab12')
  })
})
