/**
 * Contas do formulário do vendedor (pedido de 2026-11-16), sem tela: preço digitado em reais,
 * sabores separados por vírgula, tamanho da foto e id dos itens novos.
 */
import { foldText } from '../../utils/text.ts'

/** "3,00", "3.5", "R$ 12,90" e "1.234,56" em centavos; `null` quando não é um preço. */
export function parsePriceInput(raw: string): number | null {
  let text = raw.replace(/R\$/i, '').replace(/\s/g, '')
  if (!text) return null
  // "1.234,56": ponto de milhar e vírgula decimal.
  if (text.includes(',')) text = text.replace(/\./g, '').replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null
  return Math.round(Number(text) * 100)
}

/** Centavos no campo do formulário: "3,00". */
export function formatPriceInput(cents: number): string {
  return `${Math.floor(cents / 100)},${String(cents % 100).padStart(2, '0')}`
}

/** "Chocolate, Morango" em lista, sem espaços sobrando nem repetidos (sem diferenciar maiúsculas). */
export function parseFlavors(raw: string): string[] {
  const seen = new Set<string>()
  return raw
    .split(',')
    .map((flavor) => flavor.trim().replace(/\s+/g, ' '))
    .filter((flavor) => {
      const key = flavor.toLocaleLowerCase('pt-BR')
      if (!flavor || seen.has(key)) return false
      seen.add(key)
      return true
    })
}

/** A foto cabe em 800 px no lado maior, sem ampliar. */
export function fitWithin(width: number, height: number, max = 800): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height))
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

/** Id de item ou complemento novo: "novo-picole-trufado-ab12". */
export function newId(name: string, suffix: () => string = () => Math.random().toString(36).slice(2, 6)): string {
  const slug = foldText(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  return `novo-${slug || 'item'}-${suffix()}`
}
