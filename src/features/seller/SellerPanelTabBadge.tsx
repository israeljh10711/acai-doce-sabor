import { useOrders } from '../orders/ordersRuntime.ts'
import { PanelLink } from './SellerPanelTab.tsx'

/** A aba "Painel" com o selo dos pedidos novos (carregada sob demanda, só com o Modo Vendedor). */
export default function SellerPanelTabBadge() {
  const { newCount } = useOrders()
  return <PanelLink count={newCount} />
}
