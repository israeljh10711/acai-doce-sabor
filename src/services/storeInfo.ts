/**
 * Dados públicos da loja, informados pelo proprietário.
 *
 * Por enquanto ficam fixos aqui. Quando o banco de dados entrar (Fase 6),
 * passam a ser lidos das tabelas `stores` e `store_settings`.
 */
export const storeInfo = {
  name: 'Açaí Doce Sabor',
  whatsapp: '(83) 99699-9980',
  instagramHandle: 'acaidocesabor',
  address: {
    street: 'Rua Francisco Tota, 12',
    city: 'Teixeira',
    state: 'Paraíba',
  },
} as const
