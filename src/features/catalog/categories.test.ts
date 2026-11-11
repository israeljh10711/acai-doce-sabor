import { describe, expect, it } from 'vitest'
import { CATEGORIES, findCategoryBySlug } from './categories.ts'

describe('categorias de Monte seu Pedido', () => {
  it('são as três categorias definidas pelo proprietário, na ordem pedida', () => {
    expect(CATEGORIES.map((category) => category.name)).toEqual([
      'Açaí Oca',
      'Açaí Tradicional',
      'Milk-shake',
    ])
  })

  it('têm slugs únicos, sem acentos nem espaços', () => {
    const slugs = CATEGORIES.map((category) => category.slug)

    expect(new Set(slugs).size).toBe(slugs.length)
    for (const slug of slugs) {
      expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    }
  })

  it('encontra uma categoria pelo slug', () => {
    expect(findCategoryBySlug('milk-shake')?.name).toBe('Milk-shake')
  })

  it('devolve undefined para slug desconhecido ou ausente', () => {
    expect(findCategoryBySlug('pizza')).toBeUndefined()
    expect(findCategoryBySlug(undefined)).toBeUndefined()
  })
})
