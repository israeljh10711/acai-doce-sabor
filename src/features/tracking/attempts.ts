/**
 * A chave de cada tentativa (pedido 100% no site, 2026-11-20): finalizar o pedido ou acrescentar
 * itens manda um id que o servidor usa para não gravar duas vezes. O id é o mesmo enquanto o
 * conteúdo não muda (o "Tentar de novo" depois de uma falha de internet reaproveita), e outro
 * quando o cliente muda o carrinho, os dados ou o pagamento. Depois de confirmado, o id sai:
 * o mesmo carrinho montado de novo amanhã é outro pedido.
 *
 * Fica no `sessionStorage` (vale para a aba, sobrevive a recarregar a página). Não é segredo nem
 * autoriza nada: só identifica a tentativa.
 */

export const ATTEMPTS_KEY = 'acai_doce_sabor_tentativas_v1'

type Entry = { key: string; id: string }

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

/** Um id aceito pelo servidor (letras, números e hífen, de 16 a 64). */
export function newAttemptId(random: () => string): string {
  const id = random().replace(/[^A-Za-z0-9-]/g, '')
  return id.padEnd(16, '0').slice(0, 64)
}

export function createAttempts(storage: Pick<Storage, 'getItem' | 'setItem'> | null, random: () => string) {
  let memory: Record<string, Entry> = {}

  const read = (): Record<string, Entry> => {
    try {
      const raw: unknown = JSON.parse(storage?.getItem(ATTEMPTS_KEY) ?? 'null')
      if (!isRecord(raw)) return memory
      return Object.fromEntries(
        Object.entries(raw).flatMap(([scope, entry]) => (isRecord(entry) && typeof entry.key === 'string' && typeof entry.id === 'string' ? [[scope, { key: entry.key, id: entry.id }]] : [])),
      )
    } catch {
      return memory
    }
  }
  const write = (next: Record<string, Entry>) => {
    memory = next
    try {
      storage?.setItem(ATTEMPTS_KEY, JSON.stringify(next))
    } catch {
      // Sem armazenamento: vale nesta tela.
    }
  }

  return {
    /** O id da tentativa de `scope` com este conteúdo (`key`): o mesmo enquanto o conteúdo não muda. */
    idFor(scope: string, key: string): string {
      const all = read()
      const current = all[scope]
      if (current && current.key === key) return current.id
      const id = newAttemptId(random)
      write({ ...all, [scope]: { key, id } })
      return id
    },
    /** A tentativa deu certo: a próxima, mesmo igual, é outra. */
    done(scope: string) {
      const rest = { ...read() }
      delete rest[scope]
      write(rest)
    },
  }
}

export type Attempts = ReturnType<typeof createAttempts>
