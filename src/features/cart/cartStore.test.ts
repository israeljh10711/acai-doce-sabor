import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('carrinho guardado no aparelho (cartStore)', () => {
  it('é lido depois das mudanças do vendedor: um item criado por ele não some ao recarregar a página', async () => {
    vi.resetModules()
    const storage = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    })
    storage.set(
      'acai-doce-sabor:carrinho',
      JSON.stringify({ v: 2, items: [{ kind: 'extra', id: 'a1', itemId: 'picole-da-casa', choices: [], quantity: 2, note: 'bem gelado' }] }),
    )
    // Como no site: os módulos carregam primeiro, e só depois as mudanças do vendedor são aplicadas.
    const { getCart, cartActions } = await import('./cartStore.ts')
    const { setCatalogChanges } = await import('../catalog/catalogStore.ts')
    const { NO_CHANGES } = await import('../catalog/catalogChanges.ts')
    setCatalogChanges({
      ...NO_CHANGES,
      items: { 'picole-da-casa': { name: 'Picolé da casa', priceCents: 400, drawer: 'picoles-e-sorvetes', created: true } },
    })

    const cart = getCart()
    expect(cart.items.map((item) => (item.kind === 'extra' ? [item.itemId, item.quantity, item.note] : null))).toEqual([['picole-da-casa', 2, 'bem gelado']])

    cartActions.setNote('a1', 'sem palito')
    expect(getCart().items[0].note).toBe('sem palito')
    expect(JSON.parse(storage.get('acai-doce-sabor:carrinho') ?? '{}').items[0].note).toBe('sem palito')
  })
})
