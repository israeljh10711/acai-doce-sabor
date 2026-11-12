# Fase 3 — Personalizadores e imagens ilustrativas

Desenho aprovado pelo proprietário em 2026-11-12 (Opção A, logo original). Base: o
cardápio e as regras confirmados em 2026-11-11, já em `src/features/catalog/menu.ts`
e `selection.ts`, com testes.

## Intenção

O cliente monta o açaí ou o milk-shake do jeito dele e vê, na hora, o produto se
formando: só com o que escolheu, com o preço sempre certo. É a peça central do site e
o que o diferencia de um cardápio comum de delivery. Nesta fase a prévia é uma
ilustração 2D animada; na Fase 4 ela é trocada pelo 3D feito no Blender, sem mudar o
resto da tela.

## Objetivos

- Três personalizadores: Açaí Oca, Açaí Tradicional e Milk-shake, na rota
  `/monte-seu-pedido/:categoria`.
- Açaí: tamanho; adicionais com contador do limite gratuito ("2 de 3 grátis") e
  repetição; frutas e coberturas à vontade, uma vez cada; adicionais pagos com
  quantidade, cobrados por unidade.
- Milk-shake: tamanho e sabor (13), coberturas e adicionais pagos opcionais, e o aviso
  "Favor verificar com a nossa atendente a disponibilidade de sabores."
- Preço em tempo real: tamanho, cada adicional pago (quantidade x preço) e total.
- Prévia ilustrada que mostra somente o que foi escolhido; cada ingrediente entra e
  sai com animação.
- Página inicial com as ilustrações dos produtos nos cartões de categoria.
- Aviso legal junto de toda ilustração: "Imagens meramente ilustrativas. A
  apresentação visual pode variar em relação ao produto real."

## Fora do escopo

Carrinho e finalização (Fase 5), banco e pedidos (Fase 6), 3D (Fase 4), painel
(Fase 7). A montagem não é guardada ao sair da página.

## O que não pode acontecer

- Botão que parece funcionar e não funciona. Sem carrinho, não há "Adicionar ao
  carrinho": o personalizador termina no resumo com o total e uma nota de que o
  carrinho chega na próxima etapa.
- Ingrediente, tamanho, sabor ou preço que não estejam no cardápio.
- A prévia mostrar algo que o cliente não escolheu.
- Cobrar item gratuito, ou deixar passar do limite gratuito.
- Tela pesada ou travando no celular.

## Restrições

- Celular primeiro; conferir em 320, 360, 390, 768, 1024 e 1280 px, sem rolagem lateral.
- Alvos de toque com 44 px ou mais; contraste AA; foco de teclado visível.
- Quem pediu menos movimento no aparelho vê as mudanças sem animação.
- Texto em português do Brasil; cores e fontes do sistema já aprovado.
- Uma dependência nova: `motion` (Framer Motion), pedida nas instruções do
  proprietário para microinterações.

## Abordagens consideradas

| | Abordagem | Resultado |
|---|---|---|
| **A** | Ilustração 2D desenhada em código (SVG), com uma camada por ingrediente | **Escolhida.** Dinâmica, grátis, leve; serve na prévia e na página inicial. Visual de ilustração, não de foto. |
| B | Imagens renderizadas no Blender | Mais realistas, mas fixas e mais demoradas. Fica para a Fase 4, como 3D interativo. |
| C | Fotos geradas por IA | Fixas, gastam créditos e não servem para a prévia. |

## Decisões do desenho

**Tela no computador (1024 px ou mais):** três colunas, como nas referências do
proprietário. À esquerda, o tamanho (e o sabor, no milk-shake). No centro, a prévia,
que acompanha a rolagem. À direita, os ingredientes e o resumo com o total.

**Tela no celular:** uma coluna. A prévia fica no topo, compacta e fixa enquanto o
cliente rola as opções; abaixo vêm os passos, numerados. Uma barra fixa no rodapé
mostra o total.

```
celular                        computador
┌────────────────────┐         ┌──────────┬─────────────┬──────────────┐
│  prévia (fixa)     │         │ 1 Tamanho│   prévia    │ 2 Adicionais │
│  aviso legal       │         │  Pote    │  (fixa)     │ 3 Frutas     │
├────────────────────┤         │  Copo    │ aviso legal │ 4 Coberturas │
│ 1 Tamanho          │         │  Isopor  │             │ 5 Pagos      │
│ 2 Adicionais 2 de 3│         │          │             │ Resumo/total │
│ 3 Frutas ...       │         └──────────┴─────────────┴──────────────┘
├────────────────────┤
│ Total R$ 12,00     │ (fixa)
└────────────────────┘
```

**Controles:**
- Tamanho e sabor: opções de escolha única, como cartões, com o preço no tamanho.
- Adicionais e adicionais pagos: contador com − e +; o + desabilitado diz o motivo
  ("Limite de 3 grátis atingido").
- Frutas e coberturas: botões que ligam e desligam.
- Antes do tamanho, os ingredientes ficam desabilitados com "Escolha o tamanho primeiro".
- Trocar para um tamanho menor tira os adicionais que passam do limite e avisa quais
  saíram.
- Cada mudança é anunciada para leitores de tela.

**Prévia ilustrada:** uma função pura monta as camadas a partir do produto e da
escolha (recipiente, base, ingredientes na ordem de baixo para cima), sempre igual
para a mesma escolha; um componente desenha essas camadas em SVG. O açaí usa o roxo
do açaí; o milk-shake muda de cor pelo sabor e tem copo próprio. Antes do tamanho,
aparece um recipiente vazio em contorno.

**Página inicial:** cada cartão de categoria ganha uma ilustração montada com itens
reais do cardápio, e o aviso legal fica logo abaixo dos cartões.

## Deixado para quem constrói

Os traços exatos da ilustração, as posições dos ingredientes, os tempos das
animações e os espaçamentos, dentro do sistema visual aprovado.
