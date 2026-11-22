# Redesenho "Tropical Editorial Premium" — direção visual

Data: 2026-11-22. Aprovado pelo responsável: plano em 5 etapas, opção A para o início, prévia da Vercel num ramo separado antes de `main`.

## Intenção

O site tem de parecer uma açaiteria de marca, cuidada e confiável, e não um modelo de delivery. A foto do produto é a protagonista. Cada tela tem um foco e uma ação principal. Menos coisas ao mesmo tempo, e nenhuma repetida.

## Referência

Seis artes de divulgação de açaí do Pinterest, enviadas na conversa de 2026-11-22. A imagem não entra no repositório.

- Fundos orquídea com blocos berinjela de formas orgânicas (abas e arcos arredondados).
- Fotos grandes de tigelas, vistas de cima e cortadas pela borda.
- Folhas de palmeira desfocadas nas bordas.
- Títulos em fonte arredondada, em caixa normal.
- Pílulas pequenas lilás ou berinjela para as ações.
- Uma palavra "Açaí" gigante ao fundo.
- Faixa de rodapé berinjela.

Não é para copiar as artes: o site é uma loja inspirada nessa direção de arte.

## Auditoria (antes)

56 fotos em 5 larguras, mais um levantamento de estilos.

- O início tem o cardápio inteiro: 16.812 px no celular e mais de 120 botões. O mesmo cardápio se repete em `/monte-seu-pedido`.
- O logo aparece duas vezes na primeira tela. "Fechado" aparece três vezes.
- Toda página abre com uma faixa roxa de título. No cardápio do celular, nenhum produto aparece sem rolar.
- O amarelo é a cor de ação, mas não existe no logo.
- A oferta flutuante aparece em 5 s e cobre a foto principal no celular.
- Em `/pedidos`, o primeiro pedido fica a uns 740 px, abaixo de 3 faixas.
- Já é consistente e fica: cores, cantos e sombras vêm de tokens (2 sombras, uns 6 cantos).

## Paleta (medida na referência e no logo)

Cores dominantes medidas:
- referência: berinjela `#371336` (25%), orquídea `#BF5DC4` e `#AB54B1`, lavanda `#785881`, ameixa `#572E56`, verde tropical `#1A6D50`;
- logo: roxo `#68054F`, tigela magenta `#9B3D83`, verde `#288A24`.

| Nome | Hex | Papel | Contraste conferido (AA) |
|---|---|---|---|
| Berinjela | `#371336` | Superfícies de marca, rodapé, títulos | branco 16,0 |
| Orquídea | `#CB71D0` | Acento: seleção, anéis, texto sobre berinjela, selos com texto escuro | em berinjela 5,20; tinta nele 5,51; em branco 3,08 (borda) |
| Orquídea clara | `#E29BE8` | Texto e ícones sobre berinjela | em berinjela 7,71 |
| Orquídea profunda | `#A045A6` | Botão principal (texto branco) | branco 5,39 |
| Orquídea escura | `#86338C` | Botão principal ao passar e ao apertar; links | em branco 7,33 |
| Lilás | `#F6E6F7` | Superfícies suaves, pílulas, avisos | tinta 14,4 |
| Fundo | `#FFFAFC` | Página | — |
| Tinta | `#28152D` | Texto | — |
| Texto secundário | `#6E5F72` | Texto de apoio | no fundo 5,60 |
| Folha | `#1A6D50` | Só pequenos detalhes tropicais | em branco 6,27 |

O amarelo sai de todo o site. Ficam o verde e o vermelho de situação (aberto ou fechado, erro, sucesso).

## Tipografia

- **Nunito** (variável, arredondada como os títulos da referência) para títulos, em caixa normal, peso 800.
- **Inter** para textos, botões, campos e preços (`tabular-nums`).
- Sem caixa alta em títulos e rótulos.
- No máximo três pesos por tela: 400, 600 e 800.

## Componentes e princípios

- **Botão principal:** pílula orquídea profunda com texto branco e sombra discreta. Retorno ao toque em até 200 ms. Sem a "beirada" 3D do botão amarelo.
- **Botão secundário:** pílula lilás ou contorno. Um só botão principal por área.
- Sem "→" acrescentado ao texto dos botões. Sem emojis no lugar de ícones (lucide).
- **Folhas de palmeira e formas orgânicas:** só no destaque do início, em seções promocionais escolhidas e, discretas, no rodapé. Nunca atrás de cartões de produto.
- **A ousadia fica num lugar só por tela:** a foto grande ou o "Açaí" gigante. O resto, quieto.
- **Modo Vendedor:** mesmas cores e fontes, sem folhas e sem destaques promocionais. Tela de trabalho, densa e legível.

## Mantido (regras oficiais e pedido do responsável)

- A barra lateral fixa no computador, com a seção atual marcada ao rolar.
- Fotos quadradas, foto ampliada e ícones lucide.
- Um só cartão de "loja fechada", com mapa e WhatsApp.
- Toda a lógica, as rotas e os marcadores `data-*` dos testes.
- Os 750+ testes, `check:estouro` e o contraste WCAG.

## Arquitetura do início (opção A, escolhida)

O início vira uma vitrine curta:
- o destaque principal com "Peça agora";
- as categorias, que levam direto à seção certa do cardápio;
- as ofertas;
- um único cartão de horário, endereço e WhatsApp.

O cardápio completo fica só em `/monte-seu-pedido`.

## Regras de skills afastadas (e por quê)

- **baseline-ui** proíbe degradês e degradê roxo. O responsável pediu degradês roxo/orquídea: usados com moderação, só em superfícies de marca.
- **baseline-ui** pede o utilitário `cn` e primitivos Radix/Base UI. O projeto não usa nenhum dos dois, e trocar a base de componentes está fora do escopo (a skill `fixing-accessibility` também pede para não migrar bibliotecas). Os diálogos continuam os nativos, já conferidos.
- **ui-ux-pro-max:** a busca de sistema de design sugeriu escuro + dourado, "liquid glass" e Cormorant. É o contrário do pedido (tirar o amarelo; aspecto tropical), então foi descartada. A busca de tipografia trouxe a Nunito, que foi usada.
- **21st:** a busca só trouxe componentes shadcn genéricos. O projeto não usa shadcn, então a montagem é com os componentes do próprio projeto. A ideia do rodapé com uma palavra gigante ao fundo veio dessa busca.

## Etapas

1. Base visual (tokens, fontes, botões), topo e rodapé.
2. Início (opção A), cardápio e ofertas.
3. Personalizador.
4. Carrinho, finalização e acompanhamento.
5. Modo Vendedor e `/pedidos`.

Cada etapa vai para o ramo `redesign/tropical-premium` (prévia da Vercel), com fotos de antes e depois em 1440, 1024, 768, 390 e 360 px. Ela só vai para `main` com a aprovação do responsável.
