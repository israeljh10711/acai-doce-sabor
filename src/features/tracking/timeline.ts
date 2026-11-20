/**
 * A linha do tempo do acompanhamento (pedido 100% no site, 2026-11-20): as etapas reais do pedido,
 * com os textos amigáveis, a partir da mesma situação que o painel do vendedor grava. Os horários
 * vêm do histórico do banco (`order_events`): etapa sem horário registrado fica sem horário, e
 * etapa futura nunca aparece como feita. Cancelado encerra a linha com destaque próprio.
 */
import type { DeliveryType } from '../checkout/delivery.ts'
import type { OrderStatus } from '../orders/ordersPanel.ts'

export type StepState = 'done' | 'current' | 'pending' | 'cancelled'
export type TimelineStep = { key: 'recebido' | 'preparando' | 'pronto' | 'fim'; label: string; state: StepState; at: string | null }
export type Timeline = { steps: TimelineStep[]; cancelled: boolean; finished: boolean; headline: string; description: string }

/** Em que etapa cada situação está (0 recebido, 1 preparando, 2 saiu/pronto, 3 concluído). */
const LEVEL: Record<OrderStatus, number> = {
  novo: 0,
  confirmado: 0,
  preparando: 1,
  pronto: 2,
  pronto_retirada: 2,
  pronto_consumo: 2,
  saiu_para_entrega: 2,
  concluido: 3,
  cancelado: -1,
}

export function readyLabel(fulfillment: DeliveryType | null): string {
  switch (fulfillment) {
    case 'entrega':
      return '🛵 Seu pedido saiu para entrega'
    case 'retirada':
      return '🛍️ Seu pedido está pronto para retirada'
    case 'local':
      return '🍨 Seu pedido está pronto para consumo'
    default:
      return 'Seu pedido está pronto'
  }
}

const DESCRIPTION: Record<string, string> = {
  novo: 'A loja já recebeu o seu pedido e vai confirmar em instantes.',
  confirmado: 'A loja confirmou o seu pedido e já vai começar a preparar.',
  preparando: 'Seu pedido está sendo preparado com carinho.',
  entrega: 'O entregador já está a caminho do endereço informado.',
  retirada: 'Pode vir buscar no balcão da loja.',
  local: 'Pode chegar: está tudo pronto para você na sorveteria.',
  pronto: 'Seu pedido está pronto.',
  concluido: 'Pedido entregue. Obrigado pela preferência!',
  cancelado: 'Este pedido foi cancelado pela loja. Em caso de dúvida, fale com a gente.',
}

export function timelineFor(view: { status: OrderStatus; fulfillment: DeliveryType | null; createdAt: string; events: { kind: string; status: string; at: string }[] }): Timeline {
  const statusEvents = view.events.filter((event) => event.kind === 'status')
  const firstAt = (level: number) => statusEvents.find((event) => LEVEL[event.status as OrderStatus] === level)?.at ?? null
  const cancelled = view.status === 'cancelado'
  // Até onde o pedido chegou: a situação atual, ou (cancelado) a última etapa registrada antes.
  const reached = cancelled ? Math.max(0, ...statusEvents.map((event) => LEVEL[event.status as OrderStatus] ?? 0).filter((level) => level >= 0)) : LEVEL[view.status]
  const labels = ['✅ Pedido recebido — Aguardando confirmação', '🍨 Preparando seu pedido', readyLabel(view.fulfillment), '✅ Pedido concluído']
  const keys = ['recebido', 'preparando', 'pronto', 'fim'] as const

  const steps: TimelineStep[] = keys.map((key, index) => {
    let state: StepState
    if (cancelled) state = index <= reached ? 'done' : 'pending'
    else if (index < reached || (index === reached && reached === 3)) state = 'done'
    else state = index === reached ? 'current' : 'pending'
    const at = state === 'pending' ? null : index === 0 ? (firstAt(0) ?? view.createdAt) : firstAt(index)
    return { key, label: index === 0 && view.status === 'confirmado' ? '✅ Pedido confirmado pela loja' : labels[index], state, at }
  })

  if (cancelled) {
    // As etapas que não aconteceram saem; o cancelamento fecha a linha.
    const done = steps.filter((step) => step.state === 'done')
    done.push({ key: 'fim', label: '❌ Pedido cancelado', state: 'cancelled', at: statusEvents.findLast((event) => event.status === 'cancelado')?.at ?? null })
    return { steps: done, cancelled: true, finished: true, headline: '❌ Pedido cancelado', description: DESCRIPTION.cancelado }
  }

  const current = steps[Math.min(reached, 3)]
  const descriptionKey = reached === 2 ? (view.fulfillment ?? 'pronto') : view.status
  return { steps, cancelled: false, finished: reached === 3, headline: current.label, description: DESCRIPTION[descriptionKey] ?? '' }
}

/** A situação em poucas palavras, do jeito do cliente (a faixa e a lista de pedidos). */
export const CUSTOMER_STATUS_LABEL: Record<OrderStatus, string> = {
  novo: 'Recebido',
  confirmado: 'Confirmado',
  preparando: 'Preparando',
  pronto: 'Pronto',
  pronto_retirada: 'Pronto para retirada',
  pronto_consumo: 'Pronto para consumo',
  saiu_para_entrega: 'Saiu para entrega',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
}
