import { describe, expect, it } from 'vitest'
import { changesFromRows, createSupabaseBackend } from './supabaseBackend.ts'

describe('linhas do Supabase → mudanças', () => {
  it('lê as configurações da loja (tipo "settings", id "loja")', () => {
    const changes = changesFromRows([
      { kind: 'settings', id: 'loja', data: { deliveryTime: '20–35 min', closedOrders: 'bloquear' } },
      { kind: 'items', id: 'jujuba', data: { available: false } },
    ])
    expect(changes.settings).toEqual({ loja: { deliveryTime: '20–35 min', closedOrders: 'bloquear' } })
    expect(changes.items).toEqual({ jujuba: { available: false } })
  })
})

describe('cópia das configurações em dia (auditoria E2E, 2026-11-21)', () => {
  type Row = { kind: 'settings'; id: string; data: unknown }
  const settings = (name: string): Row[] => [{ kind: 'settings', id: 'loja', data: { identity: { name } } }]
  function fakeRest(initial: Row[]) {
    let rows = initial
    let release: (() => void) | null = null
    let holdNext = false
    const rest = {
      readChanges: async () => {
        const snapshot = rows
        if (holdNext) {
          holdNext = false
          await new Promise<void>((resolve) => (release = resolve))
        }
        return snapshot
      },
      upsert: async (_kind: string, id: string, data: unknown) => void (rows = [{ kind: 'settings', id, data }]),
      remove: async () => undefined,
      upload: async () => '',
    }
    return { rest, hold: () => (holdNext = true), release: () => release?.() }
  }
  const memoryStore = () => {
    const data = new Map<string, string>()
    return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => void data.set(key, value) }
  }
  const nameOf = (changes: { settings: Record<string, unknown> }) => (changes.settings.loja as { identity?: { name?: string } } | undefined)?.identity?.name

  it('uma leitura que começou antes de salvar e chega depois não volta a cópia velha', async () => {
    const fake = fakeRest(settings('Antes'))
    const backend = createSupabaseBackend(fake.rest as never, memoryStore())
    await backend.load()
    fake.hold()
    const slowRead = backend.load()
    await backend.save('settings', 'loja', { identity: { name: 'Depois' } } as never)
    fake.release()
    expect(nameOf(await slowRead)).toBe('Depois')
    expect(nameOf(backend.loadSync())).toBe('Depois')
  })

  it('o backup lê o banco na hora (nunca sai com a cópia velha do aparelho)', async () => {
    const fake = fakeRest(settings('Velho'))
    const store = memoryStore()
    const backend = createSupabaseBackend(fake.rest as never, store)
    await backend.load()
    // Outro aparelho mudou o banco; este aparelho ainda tem a cópia velha.
    await fake.rest.upsert('settings', 'loja', { identity: { name: 'Novo' } })
    const backup = JSON.parse(await backend.exportBackup())
    expect(backup.changes.settings.loja.identity.name).toBe('Novo')
  })
})
