import { describe, expect, it } from 'vitest'
import { NO_CHANGES } from '../features/catalog/catalogChanges.ts'
import { CATALOG_KEY, type LocalDeps, createLocalBackend } from './sellerCatalogStore.ts'

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
  it('a senha inicial do pedido entra; uma errada não; a sessão fica até "Sair"', async () => {
    const backend = createLocalBackend(fakeDeps())
    expect(backend.kind).toBe('local')
    expect(backend.isSignedIn()).toBe(false)
    expect(await backend.signIn('1234')).toBe(false)
    expect(backend.isSignedIn()).toBe(false)
    expect(await backend.signIn('2026')).toBe(true)
    expect(backend.isSignedIn()).toBe(true)
    await backend.signOut()
    expect(backend.isSignedIn()).toBe(false)
  })

  it('trocar a senha: a nova entra e a antiga deixa de entrar; senha curta é recusada', async () => {
    const deps = fakeDeps()
    const backend = createLocalBackend(deps)
    await backend.signIn('2026')
    expect(await backend.changePassword('12')).toBe(false)
    expect(await backend.changePassword('acai2027')).toBe(true)
    await backend.signOut()
    expect(await backend.signIn('2026')).toBe(false)
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
    expect(JSON.parse(json)).toMatchObject({ app: 'acai-doce-sabor', v: 1 })

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
