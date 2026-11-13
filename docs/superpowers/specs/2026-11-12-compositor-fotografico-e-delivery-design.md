# Redesenho comercial: compositor fotográfico, Açaí Batido, carrinho e horário

Data: 2026-11-12. Pedido: briefing "MISSÃO PRINCIPAL: REDESIGN COMPLETO, COMPOSITOR FOTOGRÁFICO E EXPERIÊNCIA PREMIUM DE DELIVERY". O usuário pediu execução direta, sem rodada de perguntas.

## Intenção

O site vai ser apresentado ao dono da açaiteria para fechar contrato. Precisa parecer uma loja de delivery de verdade, com fotos de comida e compra simples. O 3D feito no Blender saiu de vez porque parecia brinquedo.

## Objetivos

1. Trocar o 3D por um compositor de fotos em camadas, montado conforme as escolhas.
2. Nova página inicial: vitrine com o Açaí Oca em destaque, o selo de aberto/fechado e o atalho para o cardápio.
3. Nova categoria Açaí Batido, funcionando de ponta a ponta.
4. Carrinho com itens independentes, salvo no aparelho.
5. Selo de funcionamento pelo horário de Brasília, das 13h às 21h, todos os dias.
6. Instagram corrigido para @acaiidocesabor; WhatsApp oficial em todos os contatos.

## Fora do escopo

- Envio do pedido. As regras do projeto exigem gravar o pedido no banco antes de abrir o WhatsApp ([[Pedidos]]), e o banco (Supabase) ainda não existe. Fica a estrutura pronta e o aviso claro na tela.
- Pagamento, taxa de entrega e regiões. Ainda não foram informados.

## Decisões tomadas na auditoria

| Tema | Decisão | Motivo |
|---|---|---|
| Copo 500 ml a R$ 23,00 no briefing | Mantido R$ 20,00 (Oca). | O valor do briefing veio da captura de tela antiga: era o total do Copo 500 ml (R$ 20) mais um adicional pago de R$ 3. O cardápio foi conferido pelo proprietário item a item (D-020). O próprio briefing manda manter os valores validados. Há teste reproduzindo os R$ 23,00. |
| Adicionais secos repetidos (2x leite em pó) | Mantido. | Regra confirmada em D-016. A seção 9.1 do briefing fala de frutas e coberturas, que já entram uma vez cada. |
| "Batom" na lista de miniaturas | Não entra no cardápio. | Não existe no cardápio confirmado; incluir seria inventar item. |
| Arte oficial do Oca com asas e auréola | Não usada. | O arquivo nunca foi anexado. Nada foi desenhado no lugar para não imitar a arte oficial. |
| Geração de imagens | Não usada. | O Higgsfield da conta está no plano gratuito, que põe marca d'água e não libera uso comercial; o Kairogen está sem créditos. Contratar plano pago depende de autorização. |
| Origem das fotos | Bancos com licença comercial (Pexels e outros), registrados em `public/images/CREDITOS.md`. | O briefing permite fontes devidamente licenciadas quando a loja não fornece fotos. |
| Texto do selo depois das 21h | "Abrimos amanhã às 13h". | "Abrimos hoje às 13h" fica errado à noite; o briefing proíbe informação desatualizada. |
| Emojis do selo (🟢, 🔴, 👑, 🔥) | Viram ícones desenhados no site. | Emojis mudam de aparência em cada aparelho. O texto pedido continua igual. |

## Abordagens consideradas para a prévia

1. **Foto inteira por combinação.** Impossível: as combinações passam de milhares.
2. **Recortes de cada ingrediente sobre um copo visto de lado.** Precisa de fotos feitas sob medida, todas com a mesma luz e o mesmo ângulo. Os bancos gratuitos não têm. Mal feito, parece montagem.
3. **Vista de cima, com setores de ingredientes (escolhida).** Imita a foto real do isopor que o proprietário enviou: cada ingrediente ocupa um setor sobre o açaí. As texturas são fotos reais de cada ingrediente; o recipiente muda o aro, o tamanho e o fundo. Funciona com fotos de banco e continua verossímil. A sensação de profundidade vem do efeito de inclinação.

Limite registrado: a vista lateral do copo com as camadas por dentro depende de fotos feitas sob medida (da loja ou geradas em plano pago). A estrutura de camadas aceita trocar as imagens sem mudar código.

## Arquitetura

- `features/catalog`: dados (categorias, cardápio) e regras de preço, sem mudança de comportamento. Ganha o Açaí Batido.
- `features/photo-composer`: dados das imagens, a função pura que decide as camadas (`composeLayers`) e os componentes `ProductPhotoComposer` (desenha as camadas) e `TiltStage` (inclinação com o ponteiro ou o dedo).
- `features/cart`: funções puras do carrinho, armazenamento local e a página `/carrinho`.
- `features/orders`: texto da mensagem do pedido e o ponto único de envio, desligado até o banco existir.
- `features/store-hours`: horário de Brasília com relógio do servidor e o selo.
- `public/images/{products,ingredients,containers,toppings,creams,backgrounds,branding}`: imagens locais otimizadas.

## Regras que continuam valendo

Preços, tamanhos, limites grátis e pagos, 10 unidades por adicional pago, frutas e coberturas uma vez cada, aviso de imagens ilustrativas e aviso de sabores do milk-shake.

## Testes

Unitários para o batido, o carrinho, o horário, as camadas do compositor e as referências de preço do briefing. Conferências no navegador (páginas, contraste e personalizadores) atualizadas para o compositor.
