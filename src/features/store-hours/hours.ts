/**
 * Horário de funcionamento do Açaí Doce Sabor, informado pelo proprietário (briefing de
 * 2026-11-12): todos os dias, de segunda a domingo, das 13:00 às 21:00, no horário de Brasília.
 *
 * Funções puras: recebem o instante (milissegundos desde 1970, UTC) e devolvem o estado.
 * O fuso vem do nome oficial (`America/Sao_Paulo`), então o resultado não depende do fuso
 * configurado no aparelho. A hora certa vem de `serverClock.ts`.
 */
export const STORE_HOURS = {
  timeZone: 'America/Sao_Paulo',
  /** 13:00, em minutos desde a meia-noite. */
  opensAt: 13 * 60,
  /** 21:00. Às 21:00 em ponto a loja já está fechada. */
  closesAt: 21 * 60,
} as const

const MINUTES_PER_DAY = 24 * 60
const MS_PER_MINUTE = 60_000

const clock = new Intl.DateTimeFormat('en-US', {
  timeZone: STORE_HOURS.timeZone,
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
  hourCycle: 'h23',
})

/** Hora local de Brasília no instante dado: minutos desde a meia-noite e segundos. */
export function brasiliaTime(ms: number): { minutes: number; seconds: number } {
  const parts = Object.fromEntries(clock.formatToParts(ms).map((part) => [part.type, part.value]))
  return { minutes: Number(parts.hour) * 60 + Number(parts.minute), seconds: Number(parts.second) }
}

export type StoreStatus = {
  open: boolean
  /** Texto principal do selo, como pedido no briefing. */
  title: 'ABERTO AGORA' | 'FECHADO AGORA'
  /** Complemento: entrega quando aberto; quando reabre, quando fechado. */
  detail: string
  /** Instante (ms) em que o estado muda: a hora de fechar ou de abrir. */
  changesAt: number
}

const OPEN_DETAIL = 'Entrega rápida em Teixeira'
const hourLabel = (minutes: number) => `${Math.floor(minutes / 60)}h`

/** Estado da loja no instante dado. */
export function storeStatusAt(ms: number): StoreStatus {
  const { minutes, seconds } = brasiliaTime(ms)
  const { opensAt, closesAt } = STORE_HOURS
  const startOfMinute = ms - seconds * 1000 - (ms % 1000)
  const inMinutes = (target: number) => startOfMinute + target * MS_PER_MINUTE

  if (minutes >= opensAt && minutes < closesAt) {
    return { open: true, title: 'ABERTO AGORA', detail: OPEN_DETAIL, changesAt: inMinutes(closesAt - minutes) }
  }
  if (minutes < opensAt) {
    return {
      open: false,
      title: 'FECHADO AGORA',
      detail: `Abrimos hoje às ${hourLabel(opensAt)}`,
      changesAt: inMinutes(opensAt - minutes),
    }
  }
  // Depois das 21h, a próxima abertura é no dia seguinte (abre todos os dias).
  return {
    open: false,
    title: 'FECHADO AGORA',
    detail: `Abrimos amanhã às ${hourLabel(opensAt)}`,
    changesAt: inMinutes(MINUTES_PER_DAY - minutes + opensAt),
  }
}

/** "Todos os dias, das 13h às 21h": para rodapé e informações da loja. */
export const HOURS_TEXT = `Todos os dias, das ${hourLabel(STORE_HOURS.opensAt)} às ${hourLabel(STORE_HOURS.closesAt)}`
