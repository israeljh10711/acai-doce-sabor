/**
 * "💬 Dúvidas? Falar no WhatsApp" (pedido 100% no site, 2026-11-20): só um atalho opcional para
 * conversar com a loja. O pedido já está registrado no site; a conversa não envia comanda nem
 * dados do cliente, só o código do pedido para a loja achar.
 */
import { buildWhatsAppUrl } from '../../utils/whatsapp.ts'
import { getStoreSettings } from '../catalog/catalogStore.ts'

export function supportMessage(code: string | null): string {
  return code ? `Olá! Tenho uma dúvida sobre o pedido #${code}.` : 'Olá! Tenho uma dúvida sobre o meu pedido.'
}

/** O WhatsApp da loja (o de "Horários e Contato") com a mensagem de dúvida já escrita. */
export function supportWhatsAppUrl(code: string | null): string {
  return buildWhatsAppUrl(getStoreSettings().contact.whatsapp, supportMessage(code))
}
