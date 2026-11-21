/**
 * O "Tempo" de entrega da loja (`deliveryTime`, botão "Tempo" da faixa do vendedor), lido em
 * minutos (2026-11-21): a previsão no acompanhamento do cliente e o alerta de atraso do painel usam
 * esta mesma leitura, sem outra configuração. Aceita o que o vendedor escolhe ("30–45 min") e o
 * que costuma digitar ("1 hora", "50 min", "1h30", "1 a 2 horas"). O que não der para ler com
 * segurança vira `null`: nada de inventar número.
 */
export type DeliveryWindow = { min: number; max: number }

const MAX_MINUTES = 600

export function deliveryWindow(text: string): DeliveryWindow | null {
  const value = text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
  if (!value) return null
  // "1h30" / "1 h 30": uma hora e trinta minutos.
  const hourMinutes = /^(\d{1,2})\s*h\s*(\d{1,2})(?:\s*min)?$/.exec(value)
  if (hourMinutes) {
    const total = Number(hourMinutes[1]) * 60 + Number(hourMinutes[2])
    return total > 0 && total <= MAX_MINUTES ? { min: total, max: total } : null
  }
  // "30–45 min", "30 a 45 min", "50 min", "1 hora", "1 a 2 horas", "30-45".
  const range = /^(\d{1,3})(?:\s*(?:–|—|-|a|até)\s*(\d{1,3}))?\s*(min|mins|minutos?|h|horas?)?$/.exec(value)
  if (!range) return null
  const factor = range[3]?.startsWith('h') ? 60 : 1
  const min = Number(range[1]) * factor
  const max = Number(range[2] ?? range[1]) * factor
  if (min <= 0 || max < min || max > MAX_MINUTES) return null
  return { min, max }
}
