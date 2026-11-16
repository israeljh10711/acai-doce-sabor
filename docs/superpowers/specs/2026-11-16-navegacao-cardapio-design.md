# Navegação do cardápio: barra lateral, menu do celular, destaques e seções abertas

Pedido de 2026-11-16, em duas mensagens:
1. "Redesign de navegação e amplitude visual: barra lateral fixa (sidebar desktop), menu lateral slide-over (mobile), central de busca no topo e vitrine aberta sem gavetas escondidas". Antes de construir, o desenho foi apresentado em resumo no chat.
2. "Pode fazer", que aprovou o desenho e detalhou cada parte.

## Por quê

Hoje o cardápio mostra a busca, uma barra de atalhos, os 4 produtos e, no fim, 5 gavetas, das quais só a de Combos começa aberta. As outras 4 categorias ficam escondidas no fim da página. O cliente precisa ver todas as categorias e os principais combos, barcas e potes assim que abre o cardápio, sem rolar até o fim nem abrir gavetas.

## Objetivos

- **No computador (a partir de 1024 px):** duas colunas.
  - À esquerda, uma barra lateral fixa com as 9 seções do cardápio em 2 grupos, com contagem e com a seção à vista marcada.
  - À direita: busca, faixa de destaques, os 4 produtos e as 5 categorias abertas.
- **No celular e no tablet (até 1023 px):**
  - uma barra fixa com o botão "Categorias" e a busca;
  - logo abaixo, os botões das 9 seções;
  - um menu que desliza da esquerda.
- **Faixa "Mais pedidos & ofertas do dia":** 5 itens com foto, preço e "Pedir".
- **As 5 gavetas viram seções abertas:** cada uma com "Recolher" e cartões maiores, com foto quadrada, selo "N sabores", preço (riscado quando há) e o botão de hoje.
- **A busca filtra tudo:** atualiza as contagens e mostra "N resultados encontrados para '…'" com "Limpar busca".
- **A mesma experiência no início e na página Cardápio**, porque o componente é um só (`MenuBrowser`).

## Fora do escopo

- **Modo administrador** (botões "Editar", selo "Esgotado"): ainda não existe e depende da decisão D-053. Os cartões ficam com `data-product-id` e um canto livre para receber os botões depois.
- **Preços, sabores, descrições e fotos:** não mudam. As fotos continuam as mesmas; só muda o enquadramento no cartão.
- **Cabeçalho, rodapé e as outras páginas.**

## O que não pode acontecer

- **Item escondido:** nenhum dos 44 itens pode ficar escondido (só se o cliente recolher a seção).
- **Fluxos quebrados:** personalizador, escolha de sabor, confirmação, carrinho, WhatsApp, foto ampliada e notificações de oferta precisam continuar funcionando.
- **Camadas por cima do que importa:** a notificação de oferta, a barra fixa ou o menu não podem cobrir a busca nem o botão do carrinho.
- **Emojis no lugar de ícones:** mudam de um celular para outro.
- **Dependência nova.**

## Restrições

- **Fotos da loja:** são em pé (proporção altura/largura de 0,70 a 1,82, mediana 1,25).
  - Moldura quadrada com `object-cover`: o corte é de cerca de 20% na foto típica, e as tampas com o nome do sabor continuam à vista (conferido nas 61 fotos).
  - Seis fotos aparecem inteiras (`object-contain` em fundo claro com respiro), porque o corte tiraria texto ou embalagem:
    - as artes do Combo 1 Litro e do Combo de Sorvete;
    - o Kit Completo Casquinha DUO, que tem uma faixa de texto;
    - a tabela dos picolés gourmet;
    - as latas de refrigerante;
    - os pacotes Fini.
  - A lupa abre a foto inteira.
- **Testes:** não há biblioteca de teste de tela (jsdom ou Testing Library), e não vamos instalar.
  - A lógica (entradas da navegação, contagens, destaques, selo de sabores, busca) vai em testes unitários.
  - A tela vai nas conferências do navegador (Edge sem janela, como as outras).
- **Cores:** `acai-800` (#4A0E36) e `gold-400` (#FACC15) são os tokens do tema; o código usa os tokens, não os códigos hex.

## Abordagens consideradas

1. **Refazer o `MenuBrowser` compartilhado (escolhida).**
   - A barra lateral, a barra e o menu do celular, a faixa de destaques e as seções abertas entram no lugar da barra de atalhos (`CategoryNav`) e das gavetas (`MoreOptions`).
   - Busca, fluxos e dados continuam os mesmos.
   - O início e a página Cardápio mudam juntos.
2. **Uma página nova só para o cardápio, com o início como está.** Duplicaria a lógica e deixaria o início com as gavetas, contra o pedido de mesma experiência.
3. **Manter as gavetas, abrir todas e acrescentar a barra lateral.** Mantém os botões grandes de gaveta e o visual antigo, sem os cartões maiores pedidos.

## Desenho

### Estrutura

```
Computador (≥ 1024 px), largura máxima 7xl:
┌──────────────┬──────────────────────────────────────────────┐
│ Barra lateral│ [ busca ................................... ] │
│ (fixa)       │ N resultados para "…"   [Limpar busca]  (busca)│
│ Ver Ofertas  │ MAIS PEDIDOS & OFERTAS DO DIA · PRONTO P/ PEDIR │
│ & Combos     │ [▢][▢][▢][▢][▢]                               │
│ MONTE DO SEU │ Açaí Oca (destaque) · Tradicional · Batido ·  │
│ JEITO (4)    │ Milk-shake                                    │
│ ──────────── │ CATÁLOGO COMPLETO                             │
│ CATÁLOGO     │ (ícone) Combos e Ofertas  5      [Recolher]   │
│ COMPLETO (5) │ [▢ cartão][▢ cartão][▢ cartão]                 │
└──────────────┴──────────────────────────────────────────────┘

Celular (< 1024 px):
┌───────────────────────────────────┐  ← fixa no topo
│ [≡ Categorias] [ busca ......... ]│
│ (Oca)(Tradicional)(Batido)(…) →   │
└───────────────────────────────────┘
```

- O layout fica em `max-w-7xl mx-auto px-4 sm:px-6`, como pedido.
  - O resto do site continua em `max-w-6xl`.
  - A faixa roxa "Cardápio" segue alinhada ao cabeçalho do site.
- **Barra lateral (`CatalogSidebar`):**
  - Fica em `w-72`, `sticky top-4`, com altura até a tela e rolagem própria, fundo branco, `rounded-3xl`, borda `acai-800/12`, sombra e `p-4`.
  - Tem o título "Navegação rápida" e o botão roxo com detalhe dourado "Ver Ofertas & Combos", que leva à seção de Combos.
  - Grupo "Monte do seu jeito", com os 4 produtos e uma dica tirada dos dados:
    - Açaí Oca: "Especialidade da casa";
    - Açaí Tradicional: "A partir de R$ 6,00";
    - Açaí Batido: "300 ml e 500 ml";
    - Milk-shake: "13 sabores".
  - Separador e o grupo "Catálogo completo", com as 5 seções e a contagem.
- **Barra do celular:**
  - `sticky top-0 z-30`, fundo branco translúcido com desfoque, borda e sombra.
  - Linha 1: o botão "Categorias" (roxo, ícone de lista) e a busca.
  - Linha 2: os botões em pílula das 9 seções (ícone, nome curto e contagem), com rolagem para os lados e sem barra de rolagem.
  - Em 1024 px ou mais, a mesma área vira só a linha da busca, sem ficar fixa.
  - A busca é um campo só, sempre `#busca-cardapio`, nas duas larguras.
- **Menu do celular (`MobileCategoryDrawer`):**
  - É um `<dialog>` nativo, como as outras janelas do site: prende o foco, fecha no Esc e devolve o foco ao botão.
  - Fica preso à esquerda (`w-80 max-w-[85vw]`, altura toda), com fundo escuro translúcido e desfoque.
  - Mostra a logo e o nome da loja, o X, o atalho de ofertas e as 9 seções, com ícones e contagens.
  - Fecha ao escolher uma seção (e rola até ela) ou ao tocar fora.
  - Desliza da esquerda (sem animação com "reduzir movimento").

### Seções e âncoras

| Seção | Âncora | Ícone |
|---|---|---|
| Açaí Oca | `#secao-acai-oca` | coroa |
| Açaí Tradicional | `#secao-acai-tradicional` | tigela |
| Açaí Batido | `#secao-acai-batido` | copo com canudo |
| Milk-shake | `#secao-milkshake` | casquinha |
| Combos e Ofertas | `#secao-combos` | presente |
| Barcas e Potes Família | `#secao-barcas-potes` | veleiro (novo) |
| Picolés e Sorvetes | `#secao-picoles-sorvetes` | picolé |
| Bebidas | `#secao-bebidas` | copo d'água (novo) |
| Doces e Bomboniere | `#secao-doces-bomboniere` | bala |

- **Ícones novos:** o veleiro e o copo d'água vêm do Lucide (licença ISC), como os outros ícones do site. Assim nenhum ícone se repete.
- **Endereços antigos:** os links com as âncoras antigas (`#acai-oca`, `#bebidas`, …) continuam levando à seção certa.
- **Seção marcada:** um único observador (`IntersectionObserver`) marca a seção à vista, na barra lateral e nas pílulas.
  - A marcada fica roxa, com ícone e contagem dourados; a marca desliza de uma seção para a outra.
  - As pílulas rolam para a marcada ficar à vista.
- **Ao escolher uma seção:**
  - a busca é limpa, se ela esconder o destino;
  - a seção é aberta, se estiver recolhida;
  - a página rola suavemente até a seção, sem ficar atrás da barra fixa do celular;
  - o cabeçalho da seção ganha um contorno dourado por 1,2 s.

### Faixa de destaques (`TopHighlightsStrip`)

- **Título:** "Mais pedidos & ofertas do dia", com selo dourado "Pronto para pedir".
- **Itens:**
  - Pote de Açaí 1 Litro Montado;
  - Barca de Açaí;
  - Kit Completo Casquinha DUO;
  - Combo 1 Litro;
  - Pote de Açaí 2 Litros (Açaímix Brazil).
- **Dados:** nome, preço e preço antigo vêm do catálogo (R$ 30,00 com R$ 33,00 riscado; R$ 30,00; R$ 41,00; R$ 23,99; R$ 35,00).
- **Grade:** `grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3`.
- **Foto:** quadrada, com a lupa.
- **"Pedir":** abre o caminho de cada item, igual ao das seções:
  - personalizador do Pote 1 L e da Barca;
  - escolha de sabor do Kit e do Combo;
  - confirmação do Pote 2 L.
- **Na busca:** mostra só os destaques encontrados e some se nenhum for encontrado.

### Seções abertas

- **Cabeçalho:**
  - ícone num círculo roxo com o desenho dourado;
  - título (`text-xl sm:text-2xl font-black`, roxo);
  - subtítulo com o que a seção tem (só fatos do cardápio);
  - contagem;
  - "Recolher" / "Expandir" à direita (`aria-expanded`).
- **Grade:** `grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4`.
- **Cartão:**
  - foto quadrada com a lupa;
  - selo "N sabores" quando o item tem escolha de sabor (o número de sabores listados no primeiro grupo de sabor, sem contar "Outro sabor");
  - nome, descrição e preço (riscado em cinza quando há preço antigo: Pote 1 L, Brownie e Trufas);
  - o botão de hoje ("Montar pote", "Montar barca", "Escolher sabor", "Escolher tamanho" ou "Adicionar").
- **Títulos:** um título "Catálogo completo" fica acima das 5 seções, no lugar de "Mais opções do cardápio", na mesma ordem de títulos de hoje.

### Busca

- **Sinônimos:** os pedidos ("batida", "dindin", "refri", "agua", "casquinha", "barca") já funcionam.
- **Na busca:**
  - a faixa de destaques, os 4 produtos e as seções mostram só o que foi encontrado;
  - as contagens da barra lateral, do menu e das pílulas passam a ser as do resultado; seção sem resultado fica com 0 e apagada;
  - no alto aparece "N resultados encontrados para '…'" com "Limpar busca";
  - o resultado continua anunciado para leitores de tela meio segundo depois da última tecla.
- **Sem resultado:** continua a mensagem de hoje.

### Camadas

| Camada | Posição |
|---|---|
| Barra lateral | `z-20` (só no computador) |
| Barra do celular | `z-30` |
| Notificação de oferta e aviso do carrinho | `z-40`, embaixo |
| Menu do celular e foto ampliada | `<dialog>` nativo, acima de tudo |

O botão do carrinho fica no cabeçalho, que não é fixo, e nada flutua sobre a busca.

### Notificações de oferta

- **Pausas:** elas param com o menu do celular aberto, como já param com qualquer janela.
- **"Aproveitar":** continua abrindo o mesmo caminho do item. O foco volta ao botão do item na seção (não ao da faixa).

## Dados

- **`DRAWERS` (`extras.ts`):** ganha `navLabel` (barra lateral e menu), `pillLabel` (pílulas), `subtitle` e `anchor`.
  - Barcas e Potes passa a usar o veleiro, e Bebidas, o copo d'água.
  - O campo `defaultOpen` sai, porque todas começam abertas.
- **`catalogNav.ts` (novo):** as 9 entradas (id, âncora, rótulos, ícone, grupo, contagem, dica), com as contagens do catálogo ou da busca.
- **`highlights.ts` (novo):** os 5 ids dos destaques.
- **Selo:** `flavorCount(item)` dá o número do selo "N sabores".
- **Enquadramento:** `whatsapp.json` ganha `fit: "contain"` nas 6 fotos acima, e `catalogPhotos.json` é refeito pelo `tamanhos-catalogo.mjs`. As fotos não mudam.

## Testes

- **Unitários:**
  - entradas da navegação: 9, em 2 grupos, com âncoras e contagens 5, 11, 12, 2 e 14;
  - contagens na busca;
  - destaques (5 itens existentes, com preços do catálogo e o riscado do Pote 1 L);
  - `flavorCount`;
  - sinônimos da busca;
  - âncoras antigas.
- **No navegador:**
  - `check:navigation` (novo), no celular e no computador:
    - barra lateral com as 9 seções e as contagens;
    - marca da seção à vista ao rolar;
    - clique que rola até a seção e mostra o contorno;
    - menu do celular (abre, foco, Esc, toque fora, escolha que fecha e rola);
    - pílulas;
    - faixa de destaques com "Pedir" nos três caminhos;
    - seções abertas com fotos e preços, "Recolher" e "Expandir";
    - busca com faixa, contagens e "Limpar busca";
    - nada cobrindo a busca nem o carrinho.
  - As conferências existentes trocam as gavetas pelas seções: `check:menu`, `check:e2e`, `check:lightbox`, `check:offers`, `check:contrast`, `check:pages` e `check:configurator`.
- `npm test`, lint, tipos e `npm run build` sem erros.

## Decisões minhas, para conferir

- **Onde ficam os componentes:** em `src/features/catalog/`, junto do resto do cardápio, e não em `src/components/` (pasta das peças do site todo).
- **Largura:** `max-w-7xl` só na área do cardápio. A faixa roxa "Cardápio" continua alinhada ao cabeçalho.
- **Busca no computador:** fica no alto da coluna da direita, sem ficar fixa, como no pedido (rolagem `scroll-mt-6`).
- **Âncoras antigas:** continuam funcionando.
- **Rótulos curtos das pílulas:** Açaí Oca, Tradicional, Batido, Milk-shake, Combos, Barcas e Potes, Picolés e Sorvetes, Bebidas e Doces.

## Decisões tomadas na execução

- **Cartão no celular:** deitado, com a foto quadrada de 112 px ao lado do texto. A partir de 640 px fica em pé, com a foto em cima. Com 44 fotos de largura inteira, o celular teria uns 24 mil px de rolagem.
- **Botão de compra e preço:** ficam em `ItemActions.tsx`, usados pela faixa e pelas seções.
- **Selos do cartão:** a lista se chama "Selos", para não repetir o nome "Destaques" da faixa.
- **Contorno dourado:** 3 px, porque o de 2 px quase some no fundo claro.
- **Foco:** a seção escolhida recebe o foco (sem contorno de foco), para teclado e leitor de tela continuarem dali.
- **Seção à vista:** é a que cruza a linha a 35% da altura da tela, medida a cada quadro de rolagem. O observador anterior só via as seções que mudavam e deixava a marca presa ao rolar para cima.
- **Marca na navegação:** troca com transição de cor, sem deslizar, porque o pacote de animação carregado não tem animação de layout.
- **Destaque do Açaí Oca:** em duas colunas só a partir de 1280 px. Com a barra lateral, em 1024 px o texto ficava apertado.
- **Âncoras dos 4 produtos:** ficam fora do elemento com a animação de entrada, que deslocava a parada da rolagem.
- **Botões da barra do celular:** a lista ganhou `relative`. Os textos só para leitor de tela escapavam do corte e alargavam a página.
