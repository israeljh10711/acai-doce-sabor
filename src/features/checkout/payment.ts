/**
 * Forma de pagamento e troco: regras puras, testadas sem tela.
 * Pedido de 2026-11-14: Pix, cartão de crédito, cartão de débito ou dinheiro (com troco).
 */
import { formatBRL } from '../../utils/money.ts'

export type PaymentMethod = 'pix' | 'credito' | 'debito' | 'dinheiro'

export const PAYMENT_METHODS: readonly { id: PaymentMethod; label: string }[] = [
  { id: 'pix', label: 'Pix' },
  { id: 'credito', label: 'Cartão de crédito' },
  { id: 'debito', label: 'Cartão de débito' },
  { id: 'dinheiro', label: 'Dinheiro' },
]

export function paymentLabel(method: PaymentMethod): string {
  return PAYMENT_METHODS.find((candidate) => candidate.id === method)?.label ?? method
}

/** O que o cliente marcou e digitou no carrinho. */
export type PaymentDraft = {
  method: PaymentMethod | null
  /** Campo "Troco para quanto?", do jeito que foi digitado. */
  changeFor: string
  /** "Não preciso de troco (valor exato)". */
  exact: boolean
}

export const EMPTY_PAYMENT: PaymentDraft = { method: null, changeFor: '', exact: false }

/** Pagamento conferido, pronto para a mensagem. No dinheiro, `null` é "sem troco". */
export type Payment =
  | { method: 'pix' | 'credito' | 'debito' }
  | { method: 'dinheiro'; changeForCents: number | null }

/**
 * Lê um valor em reais digitado pelo cliente e devolve centavos, ou `null` se não der para ler.
 * Aceita "50", "50,00", "50,5", "50.00", "1.000", "1.000,00" e "R$ 50,00".
 */
export function parseReais(text: string): number | null {
  const clean = text.replace(/R\$/gi, '').replace(/\s/g, '')
  let normalized: string
  if (/^\d{1,3}(\.\d{3})*,\d{0,2}$|^\d+,\d{0,2}$/.test(clean)) {
    // Vírgula separa os centavos; pontos antes dela separam os milhares.
    normalized = clean.replaceAll('.', '').replace(',', '.')
  } else if (/^\d+\.\d{1,2}$/.test(clean)) {
    normalized = clean
  } else if (/^\d{1,3}(\.\d{3})+$/.test(clean)) {
    normalized = clean.replaceAll('.', '')
  } else if (/^\d+$/.test(clean)) {
    normalized = clean
  } else {
    return null
  }
  const cents = Math.round(Number(normalized) * 100)
  return Number.isSafeInteger(cents) ? cents : null
}

/** Escreve centavos do jeito que o campo mostra: 5000 -> "50,00". */
export const reaisText = (cents: number) => formatBRL(cents).replace('R$', '').trim()

export type PaymentProblem = 'no-method' | 'change-missing' | 'change-invalid' | 'change-too-low'

export type PaymentCheck = { ok: true; payment: Payment } | { ok: false; problem: PaymentProblem }

/** Confere o pagamento antes do envio: forma escolhida e, no dinheiro, o troco. */
export function checkPayment(draft: PaymentDraft, totalCents: number): PaymentCheck {
  if (!draft.method) return { ok: false, problem: 'no-method' }
  if (draft.method !== 'dinheiro') return { ok: true, payment: { method: draft.method } }
  if (draft.exact) return { ok: true, payment: { method: 'dinheiro', changeForCents: null } }
  if (!draft.changeFor.trim()) return { ok: false, problem: 'change-missing' }
  const changeFor = parseReais(draft.changeFor)
  if (changeFor === null) return { ok: false, problem: 'change-invalid' }
  if (changeFor < totalCents) return { ok: false, problem: 'change-too-low' }
  return { ok: true, payment: { method: 'dinheiro', changeForCents: changeFor } }
}

/**
 * Troco a levar, em centavos, enquanto o cliente digita. `null` quando ainda não há valor
 * válido, quando o valor é menor que o total ou quando o cliente não precisa de troco.
 */
export function changeDueCents(draft: PaymentDraft, totalCents: number): number | null {
  if (draft.method !== 'dinheiro' || draft.exact) return null
  const changeFor = parseReais(draft.changeFor)
  return changeFor !== null && changeFor >= totalCents ? changeFor - totalCents : null
}

/** Problema que aparece já durante a digitação (os outros só ao tentar enviar). */
export function liveChangeProblem(draft: PaymentDraft, totalCents: number): PaymentProblem | null {
  if (draft.method !== 'dinheiro' || draft.exact || !draft.changeFor.trim()) return null
  const changeFor = parseReais(draft.changeFor)
  if (changeFor === null) return 'change-invalid'
  return changeFor < totalCents ? 'change-too-low' : null
}

export function paymentProblemText(problem: PaymentProblem, totalCents: number): string {
  switch (problem) {
    case 'no-method':
      return 'Selecione uma forma de pagamento para continuar'
    case 'change-missing':
      return 'Informe para quanto precisa de troco ou marque "Não preciso de troco".'
    case 'change-invalid':
      return 'Digite o valor em reais, por exemplo 50,00.'
    case 'change-too-low':
      return `O valor informado é menor que o total do pedido (${formatBRL(totalCents)})`
  }
}
