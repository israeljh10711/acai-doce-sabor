/**
 * O modo "adicionar itens a um pedido" (pedido 100% no site, 2026-11-20): enquanto ligado, o
 * cardápio e o carrinho servem para escolher o que acrescentar ao pedido #ADS-…, e o carrinho
 * troca a finalização por "Confirmar adição ao pedido". Fica no `localStorage` (sobrevive a
 * recarregar e vale nas outras abas, como o carrinho). Só guarda o id e o código do pedido:
 * quem decide se ainda dá para acrescentar é o banco.
 */

export type AddMode = { orderId: string; code: string; startedAt: number }

export const ADD_MODE_KEY = 'acai_doce_sabor_adicionar_v1'
/** Esquecido ligado por muito tempo: desliga sozinho (o pedido já deve ter saído). */
export const ADD_MODE_MAX_MS = 3 * 60 * 60 * 1000

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

function parseAddMode(raw: unknown): AddMode | null {
  if (!isRecord(raw) || typeof raw.orderId !== 'string' || typeof raw.code !== 'string' || typeof raw.startedAt !== 'number') return null
  return { orderId: raw.orderId, code: raw.code, startedAt: raw.startedAt }
}

export function createAddMode(storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null, now: () => number) {
  let memory: AddMode | null = null
  let cache: { raw: string | null; memory: AddMode | null; value: AddMode | null } | null = null
  const listeners = new Set<() => void>()

  const readRaw = (): string | null => {
    try {
      return storage?.getItem(ADD_MODE_KEY) ?? null
    } catch {
      return null
    }
  }
  const notify = () => {
    cache = null
    for (const listener of listeners) listener()
  }
  const write = (value: AddMode | null) => {
    memory = value
    try {
      if (value) storage?.setItem(ADD_MODE_KEY, JSON.stringify(value))
      else storage?.removeItem(ADD_MODE_KEY)
    } catch {
      // Sem armazenamento: vale nesta tela.
    }
    notify()
  }

  return {
    /** O pedido que está recebendo itens (ou `null`). A mesma referência enquanto nada muda. */
    get(): AddMode | null {
      const raw = readRaw()
      if (cache && cache.raw === raw && cache.memory === memory) return cache.value
      let value: AddMode | null = memory
      if (raw !== null) {
        try {
          value = parseAddMode(JSON.parse(raw))
        } catch {
          value = null
        }
      }
      if (value && now() - value.startedAt > ADD_MODE_MAX_MS) value = null
      cache = { raw, memory, value }
      return value
    },
    start(order: { id: string; code: string }) {
      write({ orderId: order.id, code: order.code, startedAt: now() })
    },
    stop() {
      write(null)
    },
    /** Outra aba mudou: avisa quem está olhando. */
    changed: notify,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

export type AddModeStore = ReturnType<typeof createAddMode>
