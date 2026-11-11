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

  it('têm um resumo e um texto de botão que diz a ação', () => {
    for (const category of CATEGORIES) {
      expect(category.summary.length).toBeGreaterThan(10)
      expect(category.actionLabel).toMatch(/^Montar /)
    }
  })

  it('refletem os tamanhos confirmados: Oca a partir de 200 ml e Tradicional a partir de 150 ml', () => {
    expect(findCategoryBySlug('acai-oca')?.summary).toContain('200 ml')
    expect(findCategoryBySlug('acai-tradicional')?.summary).toContain('150 ml')
    expect(findCategoryBySlug('milk-shake')?.summary).toContain('13 sabores')
  })

  it('encontra uma categoria pelo slug', () => {
    expect(findCategoryBySlug('milk-shake')?.name).toBe('Milk-shake')
  })

  it('devolve undefined para slug desconhecido ou ausente', () => {
    expect(findCategoryBySlug('pizza')).toBeUndefined()
    expect(findCategoryBySlug(undefined)).toBeUndefined()
  })
})
