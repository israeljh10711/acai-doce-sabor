/**
 * "Ver pedido" num aviso de itens acrescentados (2026-11-20): o painel de pedidos mostra o cartão.
 * O aviso pode estar em outra página: o pedido fica guardado até o painel abrir e pegar.
 */
type Listener = (code: string) => void

let pending: string | null = null
const listeners = new Set<Listener>()

/** Pede que o painel mostre o cartão do pedido (agora, ou quando ele abrir). */
export function requestOrderFocus(code: string): void {
  if (listeners.size === 0) {
    pending = code
    return
  }
  for (const listener of listeners) listener(code)
}

/** O painel escuta os pedidos de "mostrar o cartão" (e pega o que ficou guardado). */
export function onOrderFocus(listener: Listener): () => void {
  listeners.add(listener)
  if (pending !== null) {
    const code = pending
    pending = null
    queueMicrotask(() => listener(code))
  }
  return () => listeners.delete(listener)
}

/** Rola até o cartão (espera a lista desenhar, até uns 3 s) e põe o foco nele. */
export function scrollToOrderCard(code: string, tries = 180): void {
  const card = document.querySelector<HTMLElement>(`[data-order-card="${CSS.escape(code)}"]`)
  if (!card) {
    if (tries > 0) window.requestAnimationFrame(() => scrollToOrderCard(code, tries - 1))
    return
  }
  card.scrollIntoView({ block: 'center', behavior: 'smooth' })
  card.focus({ preventScroll: true })
}
