import { describe, expect, it } from 'vitest'
import { baseCatalogRecords } from '../features/catalog/baseRecords.ts'
import { CatalogRecordsError } from '../features/catalog/records.ts'
import { LOCAL_CATALOG_KEY, createLocalCatalogRepository, createSupabaseCatalogRepository, recordsToDatabase } from './catalogRepository.ts'
import { createSupabaseRest } from './supabaseRest.ts'

const base = baseCatalogRecords()

describe('cardápio do Supabase', () => {
  it('lê catalogo_publico() e confere o formato', async () => {
    const repository = createSupabaseCatalogRepository({ readCatalog: async () => JSON.parse(JSON.stringify(recordsToDatabase(base))) })
    expect(repository.kind).toBe('supabase')
    expect(await repository.load()).toEqual(base)
  })
  it('não troca em silêncio pelo cardápio do código quando falha', async () => {
    const offline = createSupabaseCatalogRepository({
      readCatalog: async () => {
        throw new Error('Supabase respondeu 503')
      },
    })
    await expect(offline.load()).rejects.toThrow('503')
    const broken = createSupabaseCatalogRepository({ readCatalog: async () => ({ products: 'x' }) })
    await expect(broken.load()).rejects.toBeInstanceOf(CatalogRecordsError)
  })
  it('chama a RPC com a chave pública, sem token na URL', async () => {
    const calls: { url: string; init: RequestInit }[] = []
    const rest = createSupabaseRest(
      { url: 'https://exemplo.supabase.co/', key: 'sb_publishable_x' },
      {
        fetch: (async (url: string, init: RequestInit) => {
          calls.push({ url, init })
          return new Response(JSON.stringify(recordsToDatabase(base)), { status: 200 })
        }) as typeof fetch,
        now: () => 0,
        store: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
        randomId: () => 'x',
      },
    )
    await createSupabaseCatalogRepository(rest).load()
    expect(calls[0].url).toBe('https://exemplo.supabase.co/rest/v1/rpc/catalogo_publico')
    expect(calls[0].init.method).toBe('POST')
    expect(calls[0].init.headers).toMatchObject({ apikey: 'sb_publishable_x' })
    expect(calls[0].url).not.toMatch(/token|apikey|key=/)
  })
})

describe('cardápio local (demonstração)', () => {
  it('sem nada guardado, a semente do código', async () => {
    expect(await createLocalCatalogRepository({ getItem: () => null }).load()).toEqual(base)
    expect(await createLocalCatalogRepository(null).load()).toEqual(base)
  })
  it('com registros guardados, os guardados', async () => {
    const edited = { ...base, products: base.products.map((product) => (product.id === 'jujuba' ? { ...product, name: 'Jujuba nova' } : product)) }
    const store = { getItem: (key: string) => (key === LOCAL_CATALOG_KEY ? JSON.stringify(recordsToDatabase(edited)) : null) }
    const loaded = await createLocalCatalogRepository(store).load()
    expect(loaded.products.find((product) => product.id === 'jujuba')?.name).toBe('Jujuba nova')
  })
  it('guardado estragado dá erro (não apaga o que o vendedor fez)', async () => {
    await expect(createLocalCatalogRepository({ getItem: () => '{"products": 1}' }).load()).rejects.toBeInstanceOf(CatalogRecordsError)
  })
})
