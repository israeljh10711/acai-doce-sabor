# Notificações flutuantes de ofertas

Pedido do responsável em 2026-11-15: "Sistema de notificações flutuantes de ofertas aleatórias".

## O que é

Um cartão flutuante que mostra, de tempos em tempos, um dos 12 produtos escolhidos pelo responsável. Ele aparece no cardápio, igual no início e na página Cardápio. Tocar no cartão leva direto à compra daquele produto.

## Dados

- **Arquivo:** `src/features/offers/offerNotifications.ts`. As 12 ofertas apontam para o item do catálogo (gavetas) ou para a categoria (Oca e Batido).
- **Preços e textos:** preço, preço antigo e os valores no meio dos textos vêm do catálogo. Mudar um preço no cardápio muda também a notificação, e a notificação nunca mostra um preço diferente do carrinho.
- **"promoPrice":** não há preço de oferta separado. Para um "preço relâmpago", o preço do item muda no catálogo, com o preço antigo riscado. Assim cartão, notificação, carrinho e mensagem do WhatsApp mudam juntos. Um preço só da notificação mostraria ao cliente um valor que o carrinho não cobra.
- **Exclusões:** os itens proibidos (bomboniere de baixo valor e água) ficam numa lista própria. Os testes garantem que nenhum deles entra.
- **Textos corrigidos para bater com o cardápio:**
  - Pote de Sorvete 2 L Especiais: "Chocolate Trufado", e não "Chocolate";
  - Moreninha: "banhada na cobertura crocante de chocolate", como na descrição do item.
- **Selos:** os emojis dos selos aparecem como enfeite e não são lidos pelo leitor de tela. A seta de "Aproveitar" é o ícone do site.

## Tempo

- **Primeira notificação:** 4 s depois de abrir a página.
- **Na tela:** cada uma fica 8 s. A barra dourada mostra o tempo.
- **Intervalo:** 12 a 18 s, sorteado, entre uma e outra.
- **Sorteio:** em "saco", passa pelas 12 em ordem aleatória antes de repetir. Nunca repete a mesma duas vezes seguidas, nem na virada do saco.
- **Pausa com o cartão:** o tempo para enquanto o ponteiro está sobre o cartão, enquanto o dedo segura e enquanto o foco do teclado está nele. Isso atende à regra de acessibilidade de tempo ajustável (WCAG 2.2.1).
- **Bloqueio:** com uma janela aberta (escolha de sabor ou confirmação), com texto na busca, com o aviso "Adicionado ao carrinho" na tela ou com a aba escondida, a notificação some e o relógio para.
  - Se uma notificação estava na tela, a próxima vem depois de um intervalo novo.
  - Se estava no intervalo, ele continua de onde parou.
- **Fechamentos:** depois de 3 fechamentos no X na mesma visita (`sessionStorage`), as notificações param e fica só o botão "Ver ofertas" no canto. Ele mostra uma oferta na hora e retoma o ciclo.

## Clique

- **Pote 1 L Montado e Barca:** abrem o personalizador.
- **Itens com sabor:** abrem a escolha de sabor do item.
- **Pote de Açaí 2 L e Moreninha:** abrem a confirmação.
- **Açaí Oca e Açaí Batido:** abrem o personalizador. É a "tela de montagem"; rolar até o cartão antes de abrir não acrescenta nada.

## Visual

- **Cartão:** branco, com borda esquerda dourada, borda e sombra suaves e cantos arredondados.
- **Topo:** selo dourado e X (44 px de toque, acima dos 32 px pedidos, que é o padrão do site).
- **Corpo:** um botão só, com ícone, título, subtítulo, preço e "Aproveitar".
- **Posição no celular:** embaixo, de lado a lado (`bottom-24`).
- **Posição no computador e no tablet:** canto inferior direito, com 390 px de largura.
- **Animação:** entra e sai deslizando, com o motion. Quem pede menos movimento no aparelho vê só o fade, e a barra de tempo some.
- **Leitor de tela:** a notificação não é anunciada (seria uma interrupção a cada 15 s). Fica num `aside` nomeado "Oferta".

## Testes

- **Unitários (Vitest, sem DOM):** dados, exclusões, textos, sorteio sem repetição e o relógio completo, com tempo simulado.
  - O projeto não tem jsdom nem Testing Library, e instalar só para isso seria dependência nova.
- **No navegador (`check:offers`):** aparição, fechar, pausas e cada tipo de clique, num navegador de verdade.
