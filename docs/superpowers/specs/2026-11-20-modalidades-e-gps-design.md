# Três modalidades de pedido e GPS na entrega — desenho

Data: 2026-11-20. Pedido do proprietário: "IMPLEMENTAÇÃO PROFISSIONAL — 3 MODALIDADES DE PEDIDO,
GEOLOCALIZAÇÃO GPS…" (texto completo na conversa de 2026-11-20). Combinado em duas etapas
(opção B): **esta etapa** traz as modalidades, o GPS, a comanda, o banco e a função `pedido`. A aba
"📋 Pedidos" do Modo Vendedor, que ainda não existe, fica para a etapa seguinte.

## Por quê

O cliente hoje escolhe só entre entrega e retirada. A loja quer separar quem vai **levar** de
quem vai **comer na sorveteria**, e quer que a entrega possa levar o ponto exato do GPS, sem
deixar de lado o endereço digitado. Tudo tem de chegar igual ao carrinho, à comanda do WhatsApp e
ao banco.

## Metas

- Três modalidades no carrinho: 🛵 Entrega ("Receber em casa"), 🛍️ Retirar ("Pegar na loja e
  levar") e 🍨 Comer no Local ("Consumir na sorveteria").
- Na entrega, o botão "📍 Usar minha localização atual" (opcional), com carregamento, sucesso
  ("✅ Localização GPS anexada ao pedido", "Conferir pino no mapa", "Remover GPS") e erro amigável.
  Depois de capturar, uma consulta ao Nominatim sugere rua, número e bairro, sem apagar o que o
  cliente escreveu.
- Retirar e Comer no Local: sem campos de endereço, frete R$ 0,00 ("Grátis") e cartões próprios
  com o endereço da loja e o link do Google Maps.
- Comanda com "• *Modalidade:*", o local ou o endereço, a linha do GPS (só na entrega com GPS) e a
  linha de frete de cada modalidade, com os textos exatos do pedido.
- Banco: a modalidade e o GPS gravados no pedido, com as regras também no banco.

## Fora desta etapa

- A aba "📋 Pedidos" do Modo Vendedor (etapa 2).
- Mesa, número de mesa ou reserva (o pedido proíbe).
- Cupons e descontos: não existem no projeto; o total continua subtotal + frete.

## Anti-metas

- GPS obrigatório, pedido automático de localização ao abrir a página, coordenadas fixas ou GPS
  de outra sessão.
- Frete positivo em Retirar ou Comer no Local, em qualquer camada.
- Comanda, banco e carrinho com valores ou modalidades diferentes.

## Decisões

1. **Valores da modalidade.** O banco já tem a coluna `fulfillment` com `entrega` e `retirada`, e
   todo o código usa esses nomes. A terceira modalidade entra como `local`. O tipo central se chama
   `DeliveryType = 'entrega' | 'retirada' | 'local'` (em `delivery.ts`): delivery → `entrega`,
   pickup → `retirada`, dine_in → `local`. Uma só coluna; os pedidos antigos continuam certos sem
   conversão. Proposto em 2026-11-20 e aceito pelo proprietário.
2. **Colunas novas** em `orders`: `customer_lat`, `customer_lng` (double precision) e `maps_url`
   (text), todas opcionais. Regras no banco: as três juntas ou nenhuma; latitude e longitude nos
   intervalos válidos; GPS só em `entrega`; em `retirada` e `local`, frete `retirada`/`local`,
   R$ 0,00 e sem endereço.
3. **Uma fonte para o pedido.** O carrinho manda o rascunho do cliente (com o GPS) à função; a função
   confere com `checkCustomer` e monta a linha do banco e a comanda a partir do mesmo `Customer`.
   Sem o Supabase, o aparelho monta a comanda com as mesmas funções.
4. **GPS só na memória.** O rascunho continua guardado na aba (`sessionStorage`) para quem volta
   ao cardápio, mas o GPS é apagado ao guardar: nunca volta de outra sessão. A função ignora o GPS
   fora da entrega e descarta coordenadas inválidas.
5. **Precisão.** Coordenadas com 6 casas decimais (cerca de 11 cm). Validação: números finitos,
   latitude entre −90 e 90, longitude entre −180 e 180, e (0, 0) recusado (valor típico de erro).
6. **Link do mapa**: `https://www.google.com/maps?q=LAT,LNG`, montado pela mesma função no carrinho,
   na comanda e na linha do banco.
7. **Geolocalização**: só no toque do cliente; `enableHighAccuracy`, tempo limite de 15 s e sem
   posição guardada (`maximumAge: 0`). Um toque de cada vez. Sem suporte, página sem https
   (exceto localhost), permissão negada, GPS desligado ou tempo esgotado: a mesma mensagem amigável.
8. **Nominatim**: uma consulta por captura, `format=json`, `addressdetails=1`,
   `accept-language=pt-BR`, tempo limite de 6 s. Resposta atrasada (de uma captura já removida ou
   trocada) é ignorada. Só preenche campo vazio: rua, número (quando vier) e bairro. Com a lista de
   bairros do vendedor, escolhe o bairro de mesmo nome (sem acento e sem diferença de maiúsculas)
   só se nenhum estiver escolhido. Sem bairro igual, não escolhe nada.
9. **Endereço da loja**: uma fonte só, `settings.contact` ("Horários e Contato"). O texto
   "Rua Francisco Tota, 12 — Teixeira, PB" sai de `storePlaceText(contact)`. O link do mapa sai de
   `mapsUrl(storeAddressText(contact))`, com a codificação certa.
10. **Ícones**: os ícones do próprio site (Scooter, Bag, IceCreamBowl), sem biblioteca nova. Os textos
    com emoji seguem o pedido onde ele fixa o texto (cartões, GPS, comanda).
11. **Emoji da retirada na comanda**: 🛍️, como no pedido de 2026-11-20 (substitui o 🏪 de 2026-11-17).
12. **Sem modalidade pré-escolhida**: como hoje, o cliente escolhe. O aviso pede a escolha.

## Ordem de publicação (não automática)

1. Rodar `supabase/migrations/20261120120000_modalidades_gps.sql` no SQL Editor.
2. `npm run build:pedido` e colar `supabase/functions/pedido/index.ts` na função `pedido`.
3. Publicar o site.

Se o site novo for ao ar antes da função nova, pedidos "Comer no Local" são recusados como dados
inválidos. Se a função nova for ao ar antes do SQL, o registro falha e o cliente vê "Enviar mesmo
assim pelo WhatsApp".

## Fica para quem constrói

Layout fino dos cartões, textos de apoio que o pedido não fixa e a forma dos testes no navegador.
