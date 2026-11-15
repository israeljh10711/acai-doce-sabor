# Mais opções do cardápio: busca, atalhos, 5 gavetas e itens novos

Pedido do responsável em 2026-11-15: "Expansão completa do cardápio: barra de pesquisa, atalhos rápidos, 5 gavetas retráteis (38 produtos) e unificação da capa do Açaí Oca".

## Onde aparece

O cardápio aparece em duas páginas, que usam o mesmo bloco (`MenuBrowser`):

- **Início (`/`):** topo roxo, depois o cardápio e as informações da loja.
- **Cardápio (`/monte-seu-pedido`):** cabeçalho roxo "Cardápio", depois o cardápio.

O bloco tem, em ordem:

1. **Busca:** logo abaixo do cabeçalho roxo e acima da barra fixa de atalhos.
2. **Barra fixa de atalhos:** os 4 produtos e as 5 gavetas.
3. **Vitrine:** o Açaí Oca em destaque e os outros 3 em cartões.
4. **"Mais opções do cardápio":** as 5 gavetas.
5. **Aviso de imagens ilustrativas.**

## Itens

- **Quantidade:** a lista enviada tem **43 itens**, não 38 (5 + 10 + 12 + 2 + 14). Todos entram.
- **Fonte dos dados:** nomes, descrições, preços, preços antigos, selos, sabores e palavras-chave são os do pedido. Os preços ficam em centavos, como no resto do site.
- **Sinônimos:** o pedido lista sinônimos ("sacolé", "cascão", "2l"). Quando um item precisava deles e não os tinha nas palavras-chave, foram acrescentados nas palavras-chave dele.
- **Fotos:** nenhum item tem foto (`image: null`). O cartão mostra um emblema: o ícone da gaveta (desenhos do Lucide), um selo curto e fundo lilás, ou dourado nas ofertas. Não há `<img>` sem arquivo.
- **Tipos de ação:**
  - `direct_confirm`: vai direto para a janela de confirmação.
  - `flavor_modal`: abre a escolha de sabor (um ou dois grupos). Alguns grupos aceitam "Outro sabor", com texto de até 40 caracteres, limpo de símbolos de formatação. O aviso "Favor verificar com a nossa atendente a disponibilidade de sabores." aparece junto, como no milk-shake.
  - **Personalizadores:** Pote de Açaí 1 Litro Montado e Barca de Açaí viram produtos do personalizador.
    - **Pote 1 Litro Montado:** tamanho único, "Pote 1 litro", R$ 30,00, com 7 adicionais grátis, frutas, caldas e cremes e adicionais pagos, como os outros açaís.
    - **Barca de Açaí:** R$ 30,00. A escolha obrigatória é a cobertura inclusa, entre as 6 coberturas do cardápio. Os opcionais são só os adicionais pagos do cardápio (Cereja e Kit Kat), porque o pedido não diz quais outros adicionais a barca aceita nem o preço deles.

## Busca

- **Normalização:** ignora acentos e maiúsculas. "1,5" vale "1.5", e "Pippo's" vale "pippos".
- **O que entra na busca:**
  - **Produtos principais:** nome, frase, resumo, palavras-chave, tamanhos, sabores e ingredientes que o produto oferece.
  - **Itens das gavetas:** nome, descrição, palavras-chave, sabores e palavras da gaveta. As palavras de cada gaveta são escolhidas à mão: "bebida" acha as bebidas, mas "picolé" não traz a gaveta inteira de sorvetes.
- **Regra:** a frase digitada precisa aparecer no começo de uma palavra de algum desses textos. Uma busca com várias palavras e sem números também vale se cada palavra aparecer em algum texto. Com número, vale só a frase inteira, para "1 litro" não achar "1,5 litro" nem "2 litros + 1 cobertura".
- **Gavetas durante a busca:** as gavetas com resultado abrem sozinhas, com "N encontrados". As outras saem da tela. Sem nenhum resultado, aparece "Nenhum produto encontrado para “termo”" com "Limpar busca".
- **Atalhos durante a busca:** um atalho para algo escondido pela busca limpa a busca antes de rolar.

## Fluxo de compra

- **Itens das gavetas:** passam pela mesma janela de confirmação do personalizador, generalizada. Os três botões são os mesmos.
  - **Itens com sabor:** "Voltar e editar" volta à escolha de sabor com tudo marcado.
  - **Itens sem escolha:** o terceiro botão se chama "Voltar", porque não há o que editar.
- **"Adicionar e continuar comprando":** fica na página e mostra um aviso fixo embaixo ("X adicionado ao carrinho" + "Ver carrinho"). O mesmo aviso aparece ao voltar do personalizador.
- **Carrinho:** ganha itens de gaveta (`kind: 'extra'`), com quantidade e Remover.
  - **Junção:** o mesmo item com o mesmo sabor soma na quantidade.
  - **Formato:** passa a ser a versão 2, e carrinhos da versão 1 continuam sendo lidos.
  - **Conferência:** tudo é conferido de novo ao ler (item que não existe mais, sabor inválido).
- **Mensagem do WhatsApp:** cada item com quantidade, nome, sabor ou sabores, adicionais (Barca e Pote 1 L) e valor. Entra no total, no troco e no Pix.

## Açaí Oca

O cartão de destaque já usa `produtos/acai-oca.png`, a foto com o adesivo, desde o commit `194d7d9`. É a mesma do personalizador. A conferência no navegador passa a verificar isso.

## Pontos para o proprietário

- **Quantidade:** 43 itens, não 38.
- **Kits:** "Kit Completo Casquinha" e "Kit Completo" têm o mesmo preço e quase o mesmo conteúdo.
- **Preço por volume:** o pote de sorvete de 1,5 L (R$ 30,00) custa mais que os de 2 L (R$ 26,00 e R$ 28,00).
- **Descrições a esclarecer:**
  - "Combo de Sorvete" ("potes variados") não diz o que vem;
  - a da pipoca diz "doce/salgada" e "sabor manteiga".
- **Brownie:** de R$ 6,00 por R$ 5,99.
- **Sabores:** as listas precisam ser confirmadas.
- **Barca:** confirmar quais adicionais ela aceita.
- **Fotos:** os 43 itens ainda não têm foto.
