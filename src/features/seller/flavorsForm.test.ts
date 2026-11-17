import { describe, expect, it } from 'vitest'
import { BASE_EXTRA_ITEMS } from '../catalog/extras.ts'
import { BASE_PRODUCTS } from '../catalog/menu.ts'
import { type GroupRow, type OptionRow, flavorRowsOf, groupRowsOf, readChoiceGroups, readFlavors, sameFlavors, sameGroups } from './flavorsForm.ts'

let next = 0
const option = (name: string, available = true, id?: string): OptionRow => ({ key: `o${++next}`, name, available, ...(id ? { id } : {}) })
const group = (label: string, options: OptionRow[], id?: string): GroupRow => ({ key: `g${++next}`, label, options, ...(id ? { id } : {}) })

describe('gerenciador de sabores: escolhas de um item (pedido de 2026-11-17)', () => {
  it('lê as escolhas com as opções e o esgotado; linhas sem nome ficam de fora; escolha toda vazia some', () => {
    const result = readChoiceGroups([
      group(' Sabor ', [option('Morango'), option(' '), option('Uva', false)], 'sabor'),
      group('', []),
    ])
    expect(result).toEqual({ ok: true, groups: [{ id: 'sabor', label: 'Sabor', options: [{ name: 'Morango' }, { name: 'Uva', available: false }] }] })
  })

  it('escolha sem nome, sem opção ou com opção repetida não passa', () => {
    expect(readChoiceGroups([group('', [option('Morango')])])).toEqual({ ok: false, problem: 'Dê um nome a cada escolha (ex.: Sabor).' })
    expect(readChoiceGroups([group('Sabor', [option('')])])).toEqual({ ok: false, problem: 'Cada escolha precisa de pelo menos um sabor.' })
    expect(readChoiceGroups([group('Sabor', [option('Morango'), option('morango')])])).toEqual({ ok: false, problem: 'Há sabores repetidos em "Sabor".' })
  })

  it('no máximo 3 escolhas e 40 opções', () => {
    const four = [1, 2, 3, 4].map((n) => group(`E${n}`, [option('A')]))
    expect(readChoiceGroups(four)).toEqual({ ok: false, problem: 'Use no máximo 3 escolhas.' })
    const many = Array.from({ length: 41 }, (_, n) => option(`S${n}`))
    expect(readChoiceGroups([group('Sabor', many)])).toEqual({ ok: false, problem: 'Use no máximo 40 sabores por escolha.' })
  })

  it('linhas do formulário a partir do item (Kit Completo: duas escolhas) e comparação com o que já está', () => {
    const kit = BASE_EXTRA_ITEMS.find((item) => item.id === 'kit-completo-casquinha')!
    const rows = groupRowsOf(kit)
    expect(rows.map((row) => [row.id, row.label, row.options.length])).toEqual([
      ['sorvete', 'Sabor do sorvete (2 litros)', 12],
      ['cobertura', 'Sabor da cobertura', 5],
    ])
    const read = readChoiceGroups(rows)
    expect(read.ok && sameGroups(kit, read.groups)).toBe(true)
    rows[1].options[0].available = false
    const changed = readChoiceGroups(rows)
    expect(changed.ok && sameGroups(kit, changed.groups)).toBe(false)
    expect(groupRowsOf(undefined)).toEqual([])
  })
})

describe('gerenciador de sabores: sabores de um produto (pedido de 2026-11-17)', () => {
  it('Milk-shake: linhas com o id; pelo menos um sabor; repetido não passa', () => {
    const shake = BASE_PRODUCTS['milk-shake']
    const rows = flavorRowsOf(shake)
    expect(rows[0]).toMatchObject({ id: 'acai', name: 'Açaí', available: true })
    const read = readFlavors(rows)
    expect(read.ok && sameFlavors(shake, read.flavors)).toBe(true)
    expect(readFlavors([option(' ')])).toEqual({ ok: false, problem: 'Deixe pelo menos um sabor.' })
    expect(readFlavors([option('Açaí', true, 'acai'), option('acai')])).toEqual({ ok: false, problem: 'Há sabores repetidos.' })
    expect(readFlavors([option('Açaí', true, 'acai'), option('Nutella', false)])).toEqual({
      ok: true,
      flavors: [{ id: 'acai', name: 'Açaí' }, { name: 'Nutella', available: false }],
    })
  })
})
