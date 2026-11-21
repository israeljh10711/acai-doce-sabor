/**
 * O valor do Pix no acompanhamento (2026-11-21), só com o que o pedido gravado comprova:
 * - o total atual do pedido (o servidor soma cada acréscimo ao total, sem frete de novo);
 * - quanto disso veio de itens acrescentados depois (a soma dos lotes em `additions`);
 * - o valor de antes dos acréscimos (o total menos os acréscimos).
 *
 * O sistema não registra pagamento recebido. Por isso nunca diz que algo já foi pago: mostra o
 * total e, quando há acréscimos, a diferença para quem já pagou o valor de antes.
 */
import type { OrderView } from './orderView.ts'

export type PixDue = {
  /** O total atual do pedido. */
  totalCents: number
  /** O total antes dos itens acrescentados. */
  beforeAdditionsCents: number
  /** A soma dos itens acrescentados depois. */
  additionsCents: number
  /** A entrega ainda vai ser combinada (não está no total). */
  feePending: boolean
}

/** `null`: o pedido não é no Pix, ou foi cancelado (nada a pagar). */
export function pixDue(view: Pick<OrderView, 'paymentMethod' | 'status' | 'totalCents' | 'additions' | 'fee'>): PixDue | null {
  if (view.paymentMethod !== 'pix' || view.status === 'cancelado') return null
  const additionsCents = view.additions.reduce((sum, addition) => sum + addition.subtotalCents, 0)
  return {
    totalCents: view.totalCents,
    beforeAdditionsCents: Math.max(0, view.totalCents - additionsCents),
    additionsCents,
    feePending: view.fee.kind === 'combinar',
  }
}
