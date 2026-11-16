# Fotos e dados do catálogo do WhatsApp da loja

Pedido de 2026-11-16: "Importação em lote da pasta 'fotos produtos', recorte automático das 73 capturas
do WhatsApp e atualização completa do catálogo (preços, sabores, lightbox e notificações)".

O pedido chegou cortado. A lista termina no item 8 da gaveta 2, em "pote-1l-n", e tudo o que vinha
depois não chegou: as gavetas 3 a 5, o resto da gaveta 2 e as seções seguintes.

## O que foi feito

- **Pasta e cópia:**
  - `scripts/fotos/importar-whatsapp.mjs` acha a pasta "fotos produtos" na ordem do pedido e, se
    precisar, numa busca na pasta do usuário. A busca segue o atalho da pasta do OneDrive e aceita o
    nome com dois espaços.
  - Neste computador a pasta é `C:\Users\johra\OneDrive\Imagens\Screenshots\fotos  produtos`, com 73
    capturas, todas `.png`. O pedido escreveu `.jpg` em algumas, e o vínculo é feito pelo horário no
    nome do arquivo.
  - As 73 foram copiadas para `assets/fotos-loja/whatsapp/`, com um LEIA-ME.
- **Recorte (`recorte-whatsapp.mjs`):**
  - acha a foto pelo cinza do WhatsApp (22, 23, 23);
  - tira o bloco de texto de baixo (15 ou mais linhas de fundo), as bordas, a barrinha de rolagem do
    carrossel (59, 60, 60) e o pedaço da foto vizinha do carrossel;
  - ajuste manual só na Napolitano 1 L: 48 px da direita, por causa da seta do carrossel.
- **Tratamento:**
  - luz +3%, cor +7%, contraste +5% e nitidez leve;
  - nada disso nas artes com texto (Combo 1 Litro, Combo de Sorvete e a tabela dos picolés gourmet);
  - JPEG 90 com cor sem subamostragem, até 900 px de largura, nunca ampliada (as capturas têm de 287
    a 451 px);
  - cópias `-480.webp` e `-960.webp` no tamanho da foto.
- **Vínculo das fotos:**
  - Gavetas 1 e 2: as 30 fotos da lista do pedido, com nomes, descrições, preços e sabores do pedido.
  - Outros 29 itens: a foto que a captura identifica pelo nome e pelo preço escritos nela. Só a foto
    mudou; os dados continuam os de 2026-11-15.
  - O Pote de Sorvete 1 Litro (Tradicional) ficou de fora, porque a captura mostra outro produto (Ster
    Bom Dueto).
  - 13 capturas ficaram sem uso, cada uma com o motivo anotado em `whatsapp.json`.
- **Fotos substituídas:** as fotos de banco de 2026-11-15 saíram do site e foram guardadas em
  `assets/catalogo-banco-anteriores/`, sem apagar.
- **Tamanhos:** `src/features/catalog/catalogPhotos.json` guarda o tamanho de cada cópia (para o
  `srcset` e a foto ampliada) e o enquadramento. A tabela dos picolés gourmet aparece inteira no
  cartão; as outras fotos preenchem o quadro.

## Dados das gavetas 1 e 2 (do pedido)

- **Kit Completo Casquinha DUO e Kit Completo:**
  - os 12 sabores do pote 2 L Qbombom;
  - as 5 coberturas Ster Bom (Uva, Morango, Chocolate, Caramelo e Leite condensado);
  - descrições do pedido.
- **Combo 1 Litro:** R$ 23,99, com os 4 sabores do pote 1 L Qbombom.
- **Combo de Sorvete:** R$ 20,00, com os 6 sabores do Ster Bom Dueto; agora tem escolha de sabor.
- **Barca de Açaí:** 1 cobertura, 2 frutas e 7 adicionais grátis.
  - `groupLimits: { fruit: 2 }` e um tamanho com 7 grátis.
  - A terceira fruta fica bloqueada (`group-limit`), e uma montagem antiga com 3 frutas volta com 2.
  - Os adicionais pagos continuam à parte, como antes.
- **Pote de Açaí 2 Litros e Açaí de 1 Litro:** nome "(Açaímix Brazil)" e descrições do pedido.
- **Açaí do Oca (Pote Pronto)**, item novo: 500 ml a R$ 17,00 ou 1 Litro a R$ 33,00.
  - A escolha "Tamanho" tem preço por opção (`prices`), e o cartão mostra "a partir de R$ 17,00".
  - O preço do carrinho, da confirmação, da mensagem e da foto ampliada é o do tamanho escolhido.
- **Pote de Sorvete 1,5 Litro (Qbombom):** 6 sabores, cada um com a foto do pote.
  - "Iogurte grego" está escrito como na embalagem; o catálogo diz "Iorgute grego".
- **Pote de Sorvete 2 Litros (Qbombom Premium):** 12 sabores; 10 têm a foto do pote (Toffee e Brownie
  não têm).
- **Pote de Sorvete 2 Litros (Ster Bom Clássicos 4 em 1):** sem escolha, porque os 4 sabores vêm no
  mesmo pote.
- **Pote de Sorvete 1 Litro (Qbombom Premium):** 4 sabores, cada um com a foto do pote.
- **"Outro sabor":** continua onde já existia (kits, 1,5 L e 2 L).
- **Foto do sabor:** a janela de escolha, a confirmação, o carrinho e a foto ampliada mostram a foto
  do sabor escolhido (`extraPhoto`).
- **Notificação de oferta:** o pote 2 L voltou ao texto do pedido de 2026-11-15 ("Sensação,
  Napolitano e Chocolate"), porque o sabor "Chocolate Trufado" saiu. O Combo 1 Litro aparece a
  R$ 23,99.

## Divergências para o responsável confirmar

Estes itens têm, no catálogo do WhatsApp, dados diferentes dos do site. A lista de 2026-11-16 que
trataria deles chegou cortada.

| Item | No site (2026-11-15) | No catálogo do WhatsApp |
|---|---|---|
| Pote de Sorvete 1 Litro (Tradicional), R$ 16 | Napolitano, Chocolate, Morango, Flocos, Creme | Ster Bom Dueto: 6 fotos (azul com creme, nata com uva, abacaxi com coco, nata com morango, nata com chocolate, morango com chocolate) |
| Açaí com Creme Ninho | açaí, creme de Ninho e amendoim | creme ninho, açaí, amendoim, jujuba, granola, frutas e leite condensado |
| Copão 400 ml | Napolitano, Chocolate, Morango, Flocos | Napolitano e Trio; há também um "Copão" Ster Bom Copo Mais a R$ 9,50 |
| Sundae | Morango, Chocolate, Caramelo | Morango, Chocolate |
| Moreninha | sem escolha | 10 sabores |
| Picolé Trufado | Mousse de Maracujá, Chocolate, Morango, Ninho com Nutella | Mousse de maracujá, Chocolate branco, Ninho trufado, Napolitano, Trufa de morango, Brigadeiro, Morango, Chocolate |
| Picolé Gourmet | Nutella, Paçoca, Morango com Chocolate, Iogurte, Maracujá | legenda: Nutella, Abacaxi, Coco, Morango com chocolate, Maracujá; tabela: também Paçoca, Iogurte, Maracujá com chocolate e Coco queimado |
| Roscão Mel | sem escolha | 14 sabores ("Chocolate" duas vezes) |
| Picolé Comum | Coco, Chocolate, Morango, Uva, Limão, Maracujá | Chiclete, Leite condensado, Castanha, Coco, Morango, Amendoim, Blue Ice, Uva, Flocos, Tentação… |
| Cremosinho | Chocolate, Morango, Coco, Maracujá, Ninho | Uva, Açaí, Morango, Graviola, Frutas tropicais, Leite condensado, Pedacinho do céu |
| Refrigerante 350 ml | Coca-Cola, Guaraná Antarctica, Fanta Laranja, Fanta Uva, Sprite | sem lista; a foto mostra Fanta Uva, Fanta Laranja, Guaraná Antarctica Zero e Coca-Cola |
| Pippo's | sem escolha (churrasco) | Churrasco, Cachorro quente, Queijo |
| Trufas | Chocolate 50%, Beijinho, Maracujá, Coco | dois anúncios: "Beijinho, chocolate e Dois amores" e "chocolate 50%, beijinho e maracujá" (este com "2,00" escrito na foto) |
| Halls | Extra Forte, Menta, Cereja, Morango, Melancia | sem lista; fotos de Morango, Extra Forte e Uva Verde |
| Nucita | "creme doce Napolitano Nucita" | a foto mostra Ducrem Napolitano |
| Combo de Sorvete | R$ 20,00 (pedido) | a arte diz R$ 19,99 |

As ofertas do Picolé Trufado, do Picolé Gourmet e do Cremosinho citam sabores que não estão nas
listas do WhatsApp: Ninho com Nutella; Paçoca e Iogurte; Ninho, Chocolate e Coco. Se as listas do
WhatsApp forem adotadas, esses textos precisam mudar.

## Testes

- **Unitários:**
  - dados das gavetas 1 e 2;
  - fotos dos sabores e `extraPhoto`;
  - preço por tamanho (`extraPriceCents`) no carrinho e na mensagem;
  - regra das 2 frutas e dos 7 grátis da Barca;
  - busca com as marcas e os sabores novos;
  - foto ampliada com sabor e tamanho.
- **`tests/assets.test.ts`:**
  - cada foto da loja vem de uma captura guardada e cada captura é usada uma vez só;
  - 60 em uso e 13 de fora somam 73;
  - `catalogPhotos.json` bate com os arquivos;
  - as fotos de banco que saíram estão guardadas.
- **No navegador:**
  - `check:images`, com as fotos da loja em pé;
  - `check:menu`, com 44 fotos, "a partir de" e "Escolher tamanho", e as 2 frutas da Barca;
  - `check:e2e`, com 44 itens (42 até o carrinho);
  - `check:lightbox`, com 44 lupas;
  - `check:offers` e `check:contrast`, que passam a usar o pote de 2 L Açaímix como item direto.
