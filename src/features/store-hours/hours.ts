/**
 * Horário de funcionamento do Açaí Doce Sabor. Padrão do briefing de 2026-11-12: todos os dias,
 * das 13:00 às 21:00, no horário de Brasília. Desde 2026-11-17 o vendedor muda o horário
 * ("Horários e Contato") e abre ou fecha a loja fora dele pelo interruptor (opção 1A):
 * - "Fechar" vale até a abertura do dia seguinte (o dia da loja vira às 5h);
 * - "Abrir" antes da abertura vale até o fechamento; depois do fechamento, até as 5h;
 * - passado o prazo do interruptor, volta a valer o horário.
 *
 * Funções puras: recebem o instante (milissegundos desde 1970, UTC) e devolvem o estado.
 * O fuso vem do nome oficial (`America/Sao_Paulo`), então o resultado não depende do fuso
 * configurado no aparelho. A hora certa vem de `serverClock.ts`.
 */
import {
  DAY_START,
  DEFAULT_STORE_SETTINGS,
  MINUTES_PER_DAY,
  type StoreHours,
  type StoreOverride,
  type StoreSettings,
  WEEKDAY_NAMES,
  type WeekSchedule,
} from '../store/storeSettings.ts'

export const STORE_HOURS = {
  timeZone: 'America/Sao_Paulo',
  /** 13:00, em minutos desde a meia-noite. */
  opensAt: DEFAULT_STORE_SETTINGS.hours.opensAt,
  /** 21:00. Às 21:00 em ponto a loja já está fechada. */
  closesAt: DEFAULT_STORE_SETTINGS.hours.closesAt,
} as const

const MS_PER_MINUTE = 60_000
const MS_PER_DAY = MINUTES_PER_DAY * MS_PER_MINUTE

const clock = new Intl.DateTimeFormat('en-US', {
  timeZone: STORE_HOURS.timeZone,
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
  hourCycle: 'h23',
})

/** Hora local de Brasília no instante dado: minutos desde a meia-noite e segundos. */
const weekdayClock = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'short' })
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Dia da semana em Brasília: 0 é domingo. */
export function brasiliaWeekday(ms: number): number {
  return WEEKDAYS.indexOf(weekdayClock.format(ms))
}

/**
 * Os períodos de um dia da semana (cardápio dinâmico, 2026-11-21): os do dia, com o horário por
 * dia; sem ele, o horário de todos os dias.
 */
export function periodsOn(weekday: number, hours: StoreHours, week: WeekSchedule | null): readonly StoreHours[] {
  if (!week) return [hours]
  const day = week[weekday]
  return day?.open ? day.periods : []
}

export function brasiliaTime(ms: number): { minutes: number; seconds: number } {
  const parts = Object.fromEntries(clock.formatToParts(ms).map((part) => [part.type, part.value]))
  return { minutes: Number(parts.hour) * 60 + Number(parts.minute), seconds: Number(parts.second) }
}

/** Meia-noite de Brasília do dia do instante (o Brasil não tem horário de verão desde 2019). */
function localMidnight(ms: number): number {
  const { minutes, seconds } = brasiliaTime(ms)
  return ms - (ms % 1000) - seconds * 1000 - minutes * MS_PER_MINUTE
}

export type StoreStatus = {
  open: boolean
  /** Texto principal do selo, como pedido no briefing. */
  title: 'ABERTO AGORA' | 'FECHADO AGORA'
  /** Complemento: a entrega quando aberto; quando reabre, quando fechado. */
  detail: string
  /** Instante (ms) em que o estado pode mudar: a hora de abrir ou fechar, ou o fim do interruptor. */
  changesAt: number
}

const OPEN_DETAIL = 'Entrega rápida em Teixeira'

/** "13h", "13h30"; a meia-noite do fim do dia (1440) vira "0h". */
const hourLabel = (minutes: number) => {
  const hour = Math.floor(minutes / 60) % 24
  const minute = minutes % 60
  return minute ? `${hour}h${String(minute).padStart(2, '0')}` : `${hour}h`
}

/** Estado da loja pelo horário, no instante dado. */
export function storeStatusAt(ms: number, hours: StoreHours = STORE_HOURS, week: WeekSchedule | null = null): StoreStatus {
  const { minutes, seconds } = brasiliaTime(ms)
  const weekday = brasiliaWeekday(ms)
  const startOfMinute = ms - seconds * 1000 - (ms % 1000)
  const inMinutes = (target: number) => startOfMinute + target * MS_PER_MINUTE
  const today = periodsOn(weekday, hours, week)

  const current = today.find((period) => minutes >= period.opensAt && minutes < period.closesAt)
  if (current) return { open: true, title: 'ABERTO AGORA', detail: OPEN_DETAIL, changesAt: inMinutes(current.closesAt - minutes) }
  const later = today.find((period) => period.opensAt > minutes)
  if (later) {
    return { open: false, title: 'FECHADO AGORA', detail: `Abrimos hoje às ${hourLabel(later.opensAt)}`, changesAt: inMinutes(later.opensAt - minutes) }
  }
  // A próxima abertura num dos próximos dias (todo dia, sem o horário por dia).
  for (let ahead = 1; ahead <= 7; ahead++) {
    const [first] = periodsOn((weekday + ahead) % 7, hours, week)
    if (!first) continue
    const when = ahead === 1 ? 'amanhã' : WEEKDAY_NAMES[(weekday + ahead) % 7]
    return {
      open: false,
      title: 'FECHADO AGORA',
      detail: `Abrimos ${when} às ${hourLabel(first.opensAt)}`,
      changesAt: inMinutes(ahead * MINUTES_PER_DAY - minutes + first.opensAt),
    }
  }
  // Nenhum dia aberto: fechada até o vendedor mudar o horário.
  return { open: false, title: 'FECHADO AGORA', detail: 'Sem horário de abertura', changesAt: inMinutes(7 * MINUTES_PER_DAY) }
}

/** "hoje", "amanhã" ou "no dia 19/11": o dia de `at` visto do instante `now`. */
function dayWord(now: number, at: number): string {
  const days = Math.round((localMidnight(at) - localMidnight(now)) / MS_PER_DAY)
  if (days === 0) return 'hoje'
  if (days === 1) return 'amanhã'
  const date = new Intl.DateTimeFormat('pt-BR', { timeZone: STORE_HOURS.timeZone, day: '2-digit', month: '2-digit' }).format(at)
  return `no dia ${date}`
}

/** "hoje às 21h", "amanhã às 13h": quando `at` acontece, visto de `now`. */
export function atText(now: number, at: number): string {
  return `${dayWord(now, at)} às ${hourLabel(brasiliaTime(at).minutes)}`
}

export type EffectiveStatus = StoreStatus & {
  /** O estado veio do interruptor do vendedor, e não do horário. */
  manual: boolean
  /** Fechada: o instante em que reabre. Aberta: `null`. */
  reopensAt: number | null
  /** Fechada: "amanhã a partir das 13h", para o aviso de loja fechada. Aberta: `null`. */
  reopenText: string | null
}

function closedStatus(now: number, reopensAt: number, changesAt: number, manual: boolean): EffectiveStatus {
  const time = hourLabel(brasiliaTime(reopensAt).minutes)
  const day = dayWord(now, reopensAt)
  return {
    open: false,
    title: 'FECHADO AGORA',
    detail: `Abrimos ${day} às ${time}`,
    changesAt,
    manual,
    reopensAt,
    reopenText: `${day} a partir das ${time}`,
  }
}

/** Estado que o cliente vê: o interruptor do vendedor enquanto vale; depois, o horário. */
export function effectiveStatus(ms: number, settings: StoreSettings): EffectiveStatus {
  const { override, hours, week, deliveryTime } = settings
  const openDetail = `Entrega: ${deliveryTime}`

  if (override && ms < override.until) {
    if (override.state === 'open') {
      return { open: true, title: 'ABERTO AGORA', detail: openDetail, changesAt: override.until, manual: true, reopensAt: null, reopenText: null }
    }
    // Reabre quando o interruptor acaba, ou na abertura seguinte se o horário mudou nesse meio-tempo.
    const after = storeStatusAt(override.until, hours, week)
    return closedStatus(ms, after.open ? override.until : after.changesAt, override.until, true)
  }

  const byHours = storeStatusAt(ms, hours, week)
  if (byHours.open) return { ...byHours, detail: openDetail, manual: false, reopensAt: null, reopenText: null }
  return closedStatus(ms, byHours.changesAt, byHours.changesAt, false)
}

/**
 * O que o interruptor grava quando o vendedor toca em "Fechar" ou "Abrir" no instante `ms`.
 * `null`: abrir dentro do horário apenas volta ao horário.
 */
export function overrideFor(action: 'open' | 'close', ms: number, hours: StoreHours, week: WeekSchedule | null = null): StoreOverride | null {
  const { minutes } = brasiliaTime(ms)
  const midnight = localMidnight(ms)
  // Começo do dia da loja (5h): de madrugada, ainda é o dia anterior.
  const dayStart = midnight + DAY_START * MS_PER_MINUTE - (minutes < DAY_START ? MS_PER_DAY : 0)

  if (action === 'close') {
    // Fechada até a abertura seguinte depois de hoje (amanhã ou o próximo dia aberto).
    const tomorrow = dayStart + MS_PER_DAY
    const next = storeStatusAt(tomorrow, hours, week)
    return { state: 'closed', until: next.open ? tomorrow : next.changesAt }
  }
  if (storeStatusAt(ms, hours, week).open) return null
  const later = minutes >= DAY_START ? periodsOn(brasiliaWeekday(ms), hours, week).find((period) => period.opensAt > minutes) : undefined
  if (later) return { state: 'open', until: midnight + later.closesAt * MS_PER_MINUTE }
  return { state: 'open', until: dayStart + MS_PER_DAY }
}

/** "Todos os dias, das 13h às 21h" (ou "das 14h à meia-noite"): para rodapé e informações da loja. */
export function hoursText({ opensAt, closesAt }: StoreHours): string {
  const end = closesAt === MINUTES_PER_DAY ? 'à meia-noite' : `às ${hourLabel(closesAt)}`
  return `Todos os dias, das ${hourLabel(opensAt)} ${end}`
}

/** O horário padrão em texto (o atual vem das configurações da loja: `hoursText`). */
export const HOURS_TEXT = hoursText(STORE_HOURS)

const SHORT_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

/**
 * O horário em texto: "Todos os dias, das 13h às 21h" ou, com o horário por dia, os dias iguais
 * juntos ("Seg a Sex: 13h às 21h · Sáb e Dom: 14h às 22h").
 */
export function scheduleText(settings: Pick<StoreSettings, 'hours' | 'week'>): string {
  const { week, hours } = settings
  if (!week) return hoursText(hours)
  const label = (day: (typeof week)[number]) =>
    day.open ? day.periods.map((period) => `${hourLabel(period.opensAt)} às ${period.closesAt === MINUTES_PER_DAY ? '0h' : hourLabel(period.closesAt)}`).join(' e ') : 'fechado'
  // Segunda primeiro, domingo no fim (como nos cartazes).
  const order = [1, 2, 3, 4, 5, 6, 0]
  const labels = order.map((index) => label(week[index]))
  if (labels.every((text) => text === labels[0])) return labels[0] === 'fechado' ? 'Sem horário de abertura' : `Todos os dias, das ${labels[0].replace(' às ', ' às ')}`
  const runs: { from: number; to: number; text: string }[] = []
  order.forEach((_day, at) => {
    const last = runs[runs.length - 1]
    if (last && last.text === labels[at] && last.to === at - 1) last.to = at
    else runs.push({ from: at, to: at, text: labels[at] })
  })
  return runs
    .map((run) => {
      const first = SHORT_DAYS[order[run.from]]
      const last = SHORT_DAYS[order[run.to]]
      const days = run.from === run.to ? first : run.to === run.from + 1 ? `${first} e ${last}` : `${first} a ${last}`
      return `${days}: ${run.text}`
    })
    .join(' · ')
}
