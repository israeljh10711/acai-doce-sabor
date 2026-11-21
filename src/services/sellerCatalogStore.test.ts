import { describe, expect, it } from 'vitest'
import { NO_CHANGES } from '../features/catalog/catalogChanges.ts'
import { CATALOG_KEY, type LocalDeps, createLocalBackend, parseBackup } from './sellerCatalogStore.ts'

/** Armazenamento e IndexedDB falsos, em memória. */
function fakeDeps(): LocalDeps & { storage: Map<string, string>; blobs: Map<string, Blob> } {
  const storage = new Map<string, string>()
  const blobs = new Map<string, Blob>()
  let next = 0
  return {
    storage,
    blobs,
    store: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => void storage.set(key, value),
      removeItem: (key) => void storage.delete(key),
    },
    images: {
      put: async (id, blob) => void blobs.set(id, blob),
      all: async () => [...blobs.entries()],
      ids: async () => [...blobs.keys()],
      delete: async (id) => void blobs.delete(id),
    },
    hash: async (text) => {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
      return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
    },
    objectUrl: (blob) => `blob:fake/${blob.size}`,
    newId: () => `foto-${++next}`,
  }
}

describe('gravação no aparelho (modo vendedor sem Supabase)', () => {
  it('senha de antes (guardada num teste anterior) é trocada pela senha nova do pedido', async () => {
    const deps = fakeDeps()
    deps.storage.set('acai_doce_sabor_seller_password_v1', await deps.hash(String(2000 + 26)))
    const backend = createLocalBackend(deps)
    expect(await backend.signIn(String(2000 + 26))).toBe(false)
    expect(await backend.signIn('vendedor2026')).toBe(true)
  })

  it('a senha inicial do pedido entra; uma errada não; a sessão fica até "Sair"', async () => {
    const backend = createLocalBackend(fakeDeps())
    expect(backend.kind).toBe('local')
    expect(backend.isSignedIn()).toBe(false)
    expect(await backend.signIn('1234')).toBe(false)
    expect(backend.isSignedIn()).toBe(false)
    expect(await backend.signIn('vendedor2026')).toBe(true)
    expect(backend.isSignedIn()).toBe(true)
    await backend.signOut()
    expect(backend.isSignedIn()).toBe(false)
  })

  it('trocar a senha: a nova entra e a antiga deixa de entrar; senha curta é recusada', async () => {
    const deps = fakeDeps()
    const backend = createLocalBackend(deps)
    await backend.signIn('vendedor2026')
    expect(await backend.changePassword('12')).toBe(false)
    expect(await backend.changePassword('acai2027')).toBe(true)
    await backend.signOut()
    expect(await backend.signIn('vendedor2026')).toBe(false)
    expect(await backend.signIn('acai2027')).toBe(true)
    // A senha não fica guardada como texto.
    expect([...deps.storage.values()].some((value) => value.includes('acai2027'))).toBe(false)
  })

  it('gravar, ler e restaurar o original', async () => {
    const deps = fakeDeps()
    const backend = createLocalBackend(deps)
    let changes = await backend.save('items', 'sundae', { priceCents: 950 })
    expect(changes.items.sundae).toEqual({ priceCents: 950 })
    changes = await backend.save('toppings', 'granola', { available: false })
    expect(JSON.parse(deps.storage.get(CATALOG_KEY)!).toppings.granola).toEqual({ available: false })
    expect(createLocalBackend(deps).loadSync()).toEqual(changes)
    changes = await backend.save('items', 'sundae', null)
    expect(changes.items.sundae).toBeUndefined()
  })

  it('foto: guardada no IndexedDB e devolvida como idb:, com o endereço ao carregar', async () => {
    const deps = fakeDeps()
    const backend = createLocalBackend(deps)
    const ref = await backend.uploadPhoto(new Blob(['abc'], { type: 'image/webp' }))
    expect(ref).toBe('idb:foto-1')
    expect(deps.blobs.has('foto-1')).toBe(true)
    expect(await backend.loadPhotoUrls()).toEqual({ 'idb:foto-1': 'blob:fake/3' })
  })

  it('backup e restauração levam as mudanças e as fotos para outro aparelho', async () => {
    const origin = fakeDeps()
    const backend = createLocalBackend(origin)
    const ref = await backend.uploadPhoto(new Blob(['abc'], { type: 'image/webp' }))
    await backend.save('items', 'novo-picole', { created: true, drawer: 'picoles-e-sorvetes', name: 'Picolé trufado', priceCents: 300, image: ref })
    const json = await backend.exportBackup()
    // v2 desde o cardápio dinâmico (2026-11-21); sem cardápio passado, sem o campo.
    expect(JSON.parse(json)).toMatchObject({ app: 'acai-doce-sabor', v: 2 })
    expect(JSON.parse(json)).not.toHaveProperty('catalog')

    const target = fakeDeps()
    const restored = await createLocalBackend(target).importBackup(json)
    expect(restored.items['novo-picole']).toMatchObject({ name: 'Picolé trufado', image: 'idb:foto-1' })
    expect(target.blobs.get('foto-1')?.size).toBe(3)
  })

  it('backup inválido é recusado sem apagar nada', async () => {
    const deps = fakeDeps()
    const backend = createLocalBackend(deps)
    await backend.save('items', 'sundae', { priceCents: 950 })
    await expect(backend.importBackup('{"app":"outro"}')).rejects.toThrow('Arquivo de backup inválido')
    expect(backend.loadSync().items.sundae).toEqual({ priceCents: 950 })
  })

  it('sem nada guardado, sem mudanças', () => {
    expect(createLocalBackend(fakeDeps()).loadSync()).toEqual(NO_CHANGES)
  })
})

describe('fotos do aparelho que ninguém usa mais (pedido de 2026-11-17)', () => {
  const HOUR = 3_600_000
  const NOW = Date.parse('2026-11-17T20:00:00Z')
  /** Id de foto com a hora em que foi enviada, como o navegador gera. */
  const photoId = (msAgo: number, tail: string) => `foto-${(NOW - msAgo).toString(36)}-${tail}`

  it('apaga só as sem uso e com mais de 1 hora; devolve as referências apagadas', async () => {
    const deps = fakeDeps()
    const backend = createLocalBackend(deps)
    const usada = photoId(5 * HOUR, 'usada')
    const velha = photoId(2 * HOUR, 'velha')
    const nova = photoId(10 * 60_000, 'nova')
    for (const id of [usada, velha, nova, 'formato-estranho']) await deps.images.put(id, new Blob(['x']))
    await backend.save('items', 'jujuba', { image: `idb:${usada}` })
    expect(await backend.pruneUnusedPhotos!(NOW)).toEqual([`idb:${velha}`])
    expect([...deps.blobs.keys()].sort()).toEqual([usada, nova, 'formato-estranho'].sort())
  })

  it('a foto de um complemento ou de um produto também conta como usada', async () => {
    const deps = fakeDeps()
    const backend = createLocalBackend(deps)
    const a = photoId(3 * HOUR, 'a')
    const b = photoId(3 * HOUR, 'b')
    for (const id of [a, b]) await deps.images.put(id, new Blob(['x']))
    await backend.save('toppings', 'granola', { image: `idb:${a}` })
    await backend.save('products', 'acai-oca', { image: `idb:${b}` })
    expect(await backend.pruneUnusedPhotos!(NOW)).toEqual([])
  })
})

describe('backup com o cardápio (v2, 2026-11-21)', () => {
  it('leva o cardápio e as fotos que ele usa; o arquivo v1 continua valendo', async () => {
    const origin = fakeDeps()
    const backend = createLocalBackend(origin)
    const ref = await backend.uploadPhoto(new Blob(['xyz'], { type: 'image/webp' }))
    const json = await backend.exportBackup({ data: { products: [{ id: 'coxinha', image: ref }] }, photos: new Set([ref]) })
    const backup = parseBackup(json)
    expect(backup.v).toBe(2)
    expect(backup.catalog).toEqual({ products: [{ id: 'coxinha', image: ref }] })
    expect(Object.keys(backup.photos)).toEqual([ref])
    const v1 = JSON.stringify({ app: 'acai-doce-sabor', v: 1, createdAt: '', changes: {}, photos: {} })
    expect(parseBackup(v1)).not.toHaveProperty('catalog')
    expect(() => parseBackup(JSON.stringify({ app: 'acai-doce-sabor', v: 3 }))).toThrow('inválido')
  })
})
