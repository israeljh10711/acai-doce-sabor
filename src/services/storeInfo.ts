/**
 * Dados públicos da loja, informados pelo proprietário.
 * Instagram corrigido para @acaiidocesabor (com dois "i") no briefing de 2026-11-12.
 *
 * Por enquanto ficam fixos aqui. Quando o banco de dados entrar (Fase 6),
 * passam a ser lidos das tabelas `stores` e `store_settings`.
 */
export const storeInfo = {
  name: 'Açaí Doce Sabor',
  whatsapp: '(83) 99699-9980',
  instagramHandle: 'acaiidocesabor',
  instagramUrl: 'https://www.instagram.com/acaiidocesabor/',
  address: {
    street: 'Rua Francisco Tota, 12',
    city: 'Teixeira',
    state: 'Paraíba',
  },
  /**
   * Chave Pix mostrada no carrinho. Para trocar, edite só aqui.
   * Dados do pedido de 2026-11-14 (vieram como exemplo): o proprietário precisa confirmar a
   * chave e o nome do titular que o banco mostra ao cliente.
   */
  pix: {
    key: '83996999980',
    type: 'Celular',
    holder: 'Açaí Doce Sabor',
  },
} as const
