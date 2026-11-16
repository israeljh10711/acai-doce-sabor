# Créditos das fotos

- `produtos/`: as fotos dos produtos enviadas pela loja em 2026-11-14 (Açaí Oca, Açaí Tradicional,
  Açaí Batido e Milk-shake), em PNG e em cópias WebP mais leves. Originais e observações em
  `assets/fotos-loja/LEIA-ME.md`.
- `ingredientes/*.png`: fotos de ingredientes e embalagens enviadas em 2026-11-14 (originais e
  observações em `assets/fotos-loja/LEIA-ME.md`). Sem autoria nem licença informadas; as marcas
  (Nestlé, Italac, Du Porto) pertencem aos seus donos.
- `ingredientes/*.webp`: recortes de fotos de banco com licença de uso comercial, feitos por
  `scripts/fotos/preparar.mjs`. As derivadas de fotos CC BY-SA seguem a mesma licença.
- `branding/`: a logo oficial enviada pelo proprietário.
- `catalogo/`: as fotos dos itens das gavetas (ver a seção "Fotos do cardápio", abaixo).

O site mostra estes créditos em `/creditos`.

| Foto | Autor | Licença | Origem |
|---|---|---|---|
| granola | Miskatonic | CC BY 2.5 | [Granola03242006.JPG](https://commons.wikimedia.org/wiki/File:Granola03242006.JPG) |
| gotas-de-chocolate | Editor at Large | CC BY-SA 2.5 | [Semi-sweet chocolate chips.jpg](https://commons.wikimedia.org/wiki/File:Semi-sweet_chocolate_chips.jpg) |
| canudinho | Omar hoftun | CC BY-SA 4.0 | [Ülker Rulokat Fındık Kremalı..JPG](https://commons.wikimedia.org/wiki/File:%C3%9Clker_Rulokat_F%C4%B1nd%C4%B1k_Kremal%C4%B1..JPG) |
| bis | Evan-Amos | CC0 | [Cadbury-Snack-Wafer-Split.jpg](https://commons.wikimedia.org/wiki/File:Cadbury-Snack-Wafer-Split.jpg) |
| sucrilhos | Famartin | CC BY-SA 4.0 | [2020-05-03 09 27 12 A sample of Kellogg's Frosted Flakes cereal in the Franklin Farm section of Oak Hill, Fairfax County, Virginia.jpg](https://commons.wikimedia.org/wiki/File:2020-05-03_09_27_12_A_sample_of_Kellogg%27s_Frosted_Flakes_cereal_in_the_Franklin_Farm_section_of_Oak_Hill,_Fairfax_County,_Virginia.jpg) |
| kiwi | Kyle McDonald from Brooklyn, New York, USA | CC BY 2.0 | [Kiwi (3443101132).jpg](https://commons.wikimedia.org/wiki/File:Kiwi_(3443101132).jpg) |
| morango | Marc-Lautenbacher | CC BY-SA 4.0 | [Sliced fresh strawberries for making strawberry punch.jpg](https://commons.wikimedia.org/wiki/File:Sliced_fresh_strawberries_for_making_strawberry_punch.jpg) |
| cereja | WindyWinters | CC BY 2.0 | [Maraschino cherries.jpg](https://commons.wikimedia.org/wiki/File:Maraschino_cherries.jpg) |
| kit-kat | Evan-Amos | Public domain | [Kit-Kat-Type-Variations.jpg](https://commons.wikimedia.org/wiki/File:Kit-Kat-Type-Variations.jpg) |

## Fotos do cardápio (`catalogo/`)

Pedido de 2026-11-15: uma foto para cada um dos 43 itens das gavetas, de bancos com licença de uso
comercial (Pexels, Wikimedia Commons e Open Food Facts) ou montada com fotos recortadas (os dois kits e o
Combo 1 Litro, com o frasco de cobertura enviado pela loja). São ilustrativas e não são da loja. Fontes,
recortes e endereços de download em `scripts/fotos/catalogo.json`; refeitas por
`node scripts/fotos/preparar.mjs catalogo` e conferidas por `npm run check:images`. Cada foto tem o arquivo
de referência (JPG de 1000 px ou PNG de 800 px, quadrado) e as cópias `-480.webp` e `-960.webp` que o site
usa. As derivadas de fotos CC BY-SA seguem a mesma licença. As marcas dos produtos pertencem aos seus donos.

| Arquivo | Item | Autor | Licença | Origem |
|---|---|---|---|---|
| kit-completo-casquinha.png | Kit Completo Casquinha | Montagem feita para o site com: pote (Alisha Mishra, Licença Pexels, [Pexels](https://www.pexels.com/photo/scooped-chocolate-ice-cream-in-black-container-1346341/)); casquinhas (Karol D, Licença Pexels, [Pexels](https://www.pexels.com/photo/pile-of-ice-cream-cone-787666/)); cobertura-chocolate (Açaí Doce Sabor, Foto da loja) | | |
| kit-completo.png | Kit Completo | Montagem feita para o site com: pote (Alisha Mishra, Licença Pexels, [Pexels](https://www.pexels.com/photo/scooped-chocolate-ice-cream-in-black-container-1346341/)); casquinhas (Karol D, Licença Pexels, [Pexels](https://www.pexels.com/photo/pile-of-ice-cream-cone-787666/)); cobertura-morango (Açaí Doce Sabor, Foto da loja) | | |
| pote-acai-1l-montado.jpg | Pote de Açaí 1 Litro Montado | Saskia | Licença Pexels | [Pexels](https://www.pexels.com/photo/close-up-of-an-acai-bowl-6637835/) |
| combo-1-litro.png | Combo 1 Litro | Montagem feita para o site com: pote (Alisha Mishra, Licença Pexels, [Pexels](https://www.pexels.com/photo/scooped-chocolate-ice-cream-in-black-container-1346341/)); casquinhas (Karol D, Licença Pexels, [Pexels](https://www.pexels.com/photo/pile-of-ice-cream-cone-787666/)) | | |
| combo-sorvete.jpg | Combo de Sorvete | Teejay | Licença Pexels | [Pexels](https://www.pexels.com/photo/two-ice-cream-cups-1362534/) |
| barca-acai.jpg | Barca de Açaí | Rodrigo Ortega | Licença Pexels | [Pexels](https://www.pexels.com/photo/refreshing-acai-bowl-with-fresh-kiwi-and-strawberry-29173451/) |
| pote-acai-2l.jpg | Pote de Açaí 2 Litros (Açaímix) | Túllio F | CC BY-SA 4.0 | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:A%C3%A7a%C3%AD_do_Par%C3%A1.jpg) |
| acai-1-litro.jpg | Açaí de 1 Litro (Açaímix) | Melsj | CC BY-SA 4.0 | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:A%C3%A7a%C3%AD_na_tigela_2.jpg) |
| pote-sorvete-1-5l.jpg | Pote de Sorvete 1,5 Litro | Valeria Boltneva | Licença Pexels | [Pexels](https://www.pexels.com/photo/scoops-of-different-ice-cream-on-plate-1683546/) |
| pote-sorvete-2l-especiais.jpg | Pote de Sorvete 2 Litros (Sabores Especiais) | David Disponett | Licença Pexels | [Pexels](https://www.pexels.com/photo/ice-cream-dessert-on-marble-surface-2161643/) |
| pote-sorvete-2l-tradicional.jpg | Pote de Sorvete 2 Litros (Tradicional) | DS stories | Licença Pexels | [Pexels](https://www.pexels.com/photo/ice-cream-in-small-ceramic-bowls-9227979/) |
| pote-sorvete-1l-especiais.jpg | Pote de Sorvete 1 Litro (Sabores Especiais) | Alisha Mishra | Licença Pexels | [Pexels](https://www.pexels.com/photo/ice-cream-on-bowl-beside-spoon-1343504/) |
| pote-sorvete-1l-tradicional.jpg | Pote de Sorvete 1 Litro (Tradicional) | Saher Suthriwala | Licença Pexels | [Pexels](https://www.pexels.com/photo/scoop-of-chocolate-chip-ice-cream-8589559/) |
| acai-creme-ninho-pronto.jpg | Açaí com Creme Ninho (Pronto) | chahayes | CC BY 2.0 | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Acai_bowl_-_A%C3%A7a%C3%AD_na_tigela.jpg) |
| acai-mix-150ml.jpg | Açaí Mix 150 ml | Janine from Mililani, Hawaii, United States | CC BY 2.0 | [Wikimedia Commons](https://commons.wikimedia.org/w/index.php?curid=23234142) |
| copo-diamante-negro.jpg | Copo Diamante Negro | Abdulvahap Demir | Licença Pexels | [Pexels](https://www.pexels.com/photo/chocolate-pudding-in-the-shadow-19806623/) |
| copao-400ml.jpg | Copão 400 ml | Adriel Macedo | Licença Pexels | [Pexels](https://www.pexels.com/photo/ice-cream-scoops-in-bowl-16015237/) |
| sundae.jpg | Sundae | Suman Roy | Licença Pexels | [Pexels](https://www.pexels.com/photo/ice-cream-with-chocolate-syrup-on-clear-glass-bowl-8585804/) |
| cascao-duo.jpg | Cascão DUO | K. | Licença Pexels | [Pexels](https://www.pexels.com/photo/vanilla-ice-cream-on-cone-12635411/) |
| cobertura-sterbom.jpg | Cobertura Sterbom (Frasco) | Geraud pfeiffer | Licença Pexels | [Pexels](https://www.pexels.com/photo/chocolate-syrup-dropping-on-delicious-ice-cream-6542780/) |
| moreninha.jpg | Moreninha | Nick Mayer | Licença Pexels | [Pexels](https://www.pexels.com/photo/a-hand-holding-an-ice-cream-cone-7761774/) |
| picole-trufado.jpg | Picolé Trufado | Polina Tankilevitch | Licença Pexels | [Pexels](https://www.pexels.com/photo/close-up-of-bitten-ice-cream-4725715/) |
| picole-gourmet.jpg | Picolé Gourmet | Polina Tankilevitch | Licença Pexels | [Pexels](https://www.pexels.com/photo/ice-creams-on-white-background-4725706/) |
| garrafinha.jpg | Garrafinha | Obsidian Soul | CC BY-SA 4.0 | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Pineapple_ice_candy_(Philippines)_01.jpg) |
| roscao-mel.jpg | Roscão Mel | ROMAN ODINTSOV | Licença Pexels | [Pexels](https://www.pexels.com/photo/ice-cream-in-paper-cup-decorated-with-cone-and-peanuts-5060292/) |
| picole-comum.jpg | Picolé Comum | Ave Calvar Martinez | Licença Pexels | [Pexels](https://www.pexels.com/photo/colorful-ice-cream-on-blue-background-4705113/) |
| cremosinho.jpg | Cremosinho | Obsidian Soul | CC0 | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Home-made_pineapple_and_chocolate_ice_candy_(Philippines).jpg) |
| refrigerante-350ml.jpg | Refrigerante 350 ml | Hadis Padidaran | Licença Pexels | [Pexels](https://www.pexels.com/photo/close-up-shot-of-a-canned-coca-cola-7429792/) |
| agua-mineral-500ml.jpg | Água Mineral 500 ml | MART PRODUCTION | Licença Pexels | [Pexels](https://www.pexels.com/photo/a-person-holding-a-water-bottle-with-a-blank-label-8217497/) |
| quadradinho-brownie.jpg | Quadradinho de Brownie | Marta Dzedyshko | Licença Pexels | [Pexels](https://www.pexels.com/photo/close-up-photo-of-stacked-brownies-on-chopping-board-2067396/) |
| pippos.jpg | Pippo's | Srattha Nualsate | Licença Pexels | [Pexels](https://www.pexels.com/photo/delicious-potato-chips-13060681/) |
| trufas.jpg | Trufas | Jessica Lewis (thepaintedsquare) | Licença Pexels | [Pexels](https://www.pexels.com/photo/delicious-chocolate-truffles-on-rustic-wood-39889190/) |
| trident.png | Trident | nebenmond (Open Food Facts) | CC BY-SA 3.0 | [Open Food Facts](https://world.openfoodfacts.org/product/7895800304235) |
| batom-ao-leite.jpg | Batom ao Leite | hello aesthe | Licença Pexels | [Pexels](https://www.pexels.com/photo/close-up-photograph-of-broken-chocolate-bars-9045832/) |
| mentos.png | Mentos | duhowpi (Open Food Facts) | CC BY-SA 3.0 | [Open Food Facts](https://world.openfoodfacts.org/product/87108026) |
| halls.png | Halls | kiliweb (Open Food Facts) | CC BY-SA 3.0 | [Open Food Facts](https://world.openfoodfacts.org/product/78938823) |
| pipoca-kigarot-75g.jpg | Pipoca Kigarot 75g | hello aesthe | Licença Pexels | [Pexels](https://www.pexels.com/photo/close-up-shot-of-popcorn-8652508/) |
| pipoca-kigarot-45g.jpg | Pipoca Kigarot 45g | John Booth | Licença Pexels | [Pexels](https://www.pexels.com/photo/popcorn-in-buckets-at-the-cinema-8610548/) |
| fini-gelatinas.png | Fini Gelatinas | foodvisor (Open Food Facts) | CC BY-SA 3.0 | [Open Food Facts](https://world.openfoodfacts.org/product/7898279790639) |
| docile-canudinho.jpg | Docile Canudinho | Fumikas Sagisavas | CC0 | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Four-color_straw_candy.jpg) |
| jujuba.jpg | Jujuba | Polina Tankilevitch | Licença Pexels | [Pexels](https://www.pexels.com/photo/colorful-candy-5469044/) |
| nucita.png | Nucita | vivianasalcedo (Open Food Facts) | CC BY-SA 3.0 | [Open Food Facts](https://world.openfoodfacts.org/product/7702011012401) |
| chocolate-recheado.jpg | Chocolate Recheado | Wilfredor | CC0 | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Rocky_Mountain_chocolates.jpg) |
