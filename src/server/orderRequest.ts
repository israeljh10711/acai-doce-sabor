/**
 * As operações da função `pedido` (pedido 100% no site, 2026-11-20). `op` escolhe:
 * - `criar` (ou nada: o site antigo): confere e grava o pedido, ligado à sessão do cliente;
 * - `consultar`: o próprio pedido, na visão reduzida, com o histórico;
 * - `meus`: os próprios pedidos dos últimos 30 dias;
 * - `adicionar`: itens a mais num pedido em `novo` ou `preparando`.
 *
 * A sessão do cliente chega no `Authorization` e é conferida pelo servidor de login; o token nunca
 * vai para log nem para a resposta.
 */
import { type PedidoDeps, addItems, listOrders, lookupOrder } from './customerOrders.ts'
import { handleOrder } from './orderServer.ts'

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

export async function handleRequest(raw: unknown, deps: PedidoDeps, token: string | null): Promise<unknown> {
  const op = isRecord(raw) && typeof raw.op === 'string' ? raw.op : 'criar'
  const customerId = token ? await deps.verifyCustomer(token) : null
  switch (op) {
    case 'criar':
      if (isRecord(raw) && raw.requireSession === true && !customerId) return { ok: false, reason: 'sem-sessao' }
      return handleOrder(raw, deps, customerId)
    case 'consultar':
      return lookupOrder(raw, deps, customerId)
    case 'meus':
      return listOrders(deps, customerId)
    case 'adicionar':
      return addItems(raw, deps, customerId)
    default:
      return { ok: false, reason: 'pedido-invalido' }
  }
}
