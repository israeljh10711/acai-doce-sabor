# Fotos dos 43 itens das gavetas e bateria de testes de ponta a ponta

Pedido de 2026-11-15 (noite): "Curadoria de imagens padrão anúncio/cinema para todos os itens sem foto
+ auditoria e testes total end-to-end".

## O que muda

- Os 43 itens de "Mais opções do cardápio" deixam o emblema e passam a ter foto (`image` em
  `src/features/catalog/extras.ts`, sempre `images/catalogo/<arquivo>`, e `imageAlt`).
- As fotos enviadas pela loja (produtos e ingredientes) continuam intocadas. A regra de 2026-11-14
  ("nunca fotos da internet") muda só para os itens que não têm foto da loja, a pedido do responsável.
- Os ingredientes do personalizador já tinham todos foto: nada mudou ali.

## Fontes e licenças

- Só bancos com licença que permite uso comercial e recorte: Pexels (Licença Pexels), Wikimedia
  Commons (CC0, domínio público, CC BY, CC BY-SA) e Open Food Facts (CC BY-SA 3.0, embalagens reais).
  Nada de Shutterstock, iStock, Getty, Depositphotos ou Alamy, nada com marca d'água, nada gerado
  por IA e nenhum desenho feito por código.
- `scripts/fotos/catalogo.json` guarda, para cada arquivo: item, origem, título, autor, licença,
  página, endereço de download e o recorte. Os créditos aparecem em `/creditos` e em
  `public/images/CREDITOS.md`. As derivadas de fotos CC BY-SA seguem a mesma licença.
- Busca: Pexels pelo buscador da web (o site do Pexels bloqueia acesso automático), Commons e
  Open Food Facts pelas APIs abertas, e Openverse. Cada candidata foi vista numa folha de contato
  antes da escolha.

## Preparo (`node scripts/fotos/preparar.mjs catalogo [arquivo...]`)

- `recorte`: foto de comida recortada em quadrado (preenche o quadro).
- `inteira`: embalagem inteira sobre fundo branco, com margem (as balas em rolo, giradas).
- `composicao`: os dois kits e o Combo 1 Litro, montados com fotos recortadas (pote de sorvete e
  casquinhas do Pexels, frasco de cobertura enviado pela loja), vistos de cima sobre fundo de
  estúdio, com sombra suave. 800x800, PNG.
- Saída: arquivo de referência (JPG de 1000 px ou PNG de 800 px) e as cópias que o site usa,
  `<nome>-480.webp` e `<nome>-960.webp`. Os originais ficam em `scripts/fotos/.originais/catalogo/`
  (fora do Git), com um resumo do endereço no nome (trocar a fonte baixa a foto nova).

## Desvios do pedido

- Fotos de comida em JPG, não PNG, em 9 arquivos que o pedido nomeou `.png` (refrigerante, água,
  Pippo's, Batom, as duas pipocas, Docile, jujuba e cobertura Sterbom): em PNG cada uma pesaria
  de 0,7 a 1,7 MB. PNG ficou nas embalagens inteiras (Trident, Mentos, Halls, Fini e Nucita) e nas
  montagens.
- A regra "mais de 15 KB" vale para as 43 fotos de referência. As cópias WebP de fotos com muito
  fundo branco ficam menores (4,7 a 14,4 KB) e são válidas: decodificam por inteiro e têm o tamanho
  certo. Inflar o arquivo só deixaria o site mais lento.
- Na notificação, o Açaí Oca e o Açaí Batido usam a foto da loja inteira (`contain`), como em todo
  o site. As outras 10 preenchem a miniatura (`cover`).
- Sem foto livre do produto exato em vários itens de marca ou regionais (Garrafinha, Roscão Mel,
  Cascão DUO, Copo Diamante Negro, Cobertura Sterbom, Pippo's, Batom, Pipoca Kigarot): a foto é de
  um produto parecido e o aviso "Imagens meramente ilustrativas" já aparece no cardápio.

## Interface

- Cartão da gaveta: foto quadrada de 96 px, `object-cover`, decorativa (o nome está ao lado).
  O emblema ficou só no botão de cada gaveta.
- Escolha de sabor e confirmação: a mesma foto. Carrinho: a foto do item.
- Personalizador do Pote 1 L Montado e da Barca: a foto da gaveta, com texto alternativo,
  "Ver foto" e o aviso de imagem ilustrativa, como nos outros produtos.
- Notificação de oferta: miniatura de 48 px, `rounded-xl`, no lugar do ícone.
- `/creditos`: nova seção "Fotos do cardápio" e carregamento só quando a página abre.

## Testes

- `tests/assets.test.ts`: cada item com a foto e as duas cópias, cabeçalho válido (JPEG, PNG ou
  WebP), quadradas, foto de referência com mais de 15 KB, nada sobrando na pasta, fonte com autor
  e licença comercial, miniaturas das 12 ofertas.
- `extras.test.ts`: o arquivo de cada um dos 43 itens, local, com texto alternativo, sem repetir.
- `npm run check:images`: decodifica por inteiro cada imagem do site.
- `npm run check:menu`: as 43 fotos carregam no navegador (96 px, `cover`, locais).
- `npm run check:offers`: a miniatura de 48 px em cada oferta, `contain` no Oca e no Batido.
- `npm run check:e2e` (novo): vitrine, busca (com e sem acento, sinônimos), as 5 gavetas, os 9
  atalhos, os 41 itens sem montagem até o carrinho e a mensagem do WhatsApp (crédito e débito), os
  2 de montagem abrindo o personalizador, o troco do pedido (R$ 48,00 com troco para R$ 50,00 leva
  R$ 2,00), mais e menos no carrinho e o personalizador zerado depois de "continuar comprando".
