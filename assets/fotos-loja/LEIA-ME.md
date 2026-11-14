# Fotos enviadas pela loja em 2026-11-14

## Fotos dos produtos (`produtos/`)

Enviadas no pedido "Correção crítica: fotos reais dos produtos principais", com a regra de usar
exatamente estas fotos. `scripts/fotos/preparar.mjs produtos` gera `public/images/produtos/<nome>.png`
e as cópias WebP de 480 e 960 px. A única mudança é a margem: tira o branco em volta e devolve uma
borda branca igual nos quatro lados (o pote do Oca e a tigela encostavam na borda). Nada do produto
é cortado.

Cada foto foi ligada ao produto pelo conteúdo: no pedido, a 1ª foto descrita era o Oca e a 3ª o
milk-shake, mas a ordem dos anexos veio trocada (o copo com o rótulo "Oca do Açaí" veio em 3º).

| Arquivo | Produto | O que mostra |
|---|---|---|
| `produtos/acai-oca.jpg` | Açaí Oca | Pote em camadas com o rótulo "Oca do Açaí", sucrilhos, morango, granola e amendoim |
| `produtos/acai-tradicional.jpg` | Açaí Tradicional | Tigela de isopor com morango, gotas de chocolate, confete, banana, amendoim e chocoball |
| `produtos/acai-batido.jpg` | Açaí Batido | Duas garrafas com o rótulo Açaí Doce Sabor |
| `produtos/milkshake.jpg` | Milk-shake | Milk-shake de chocolate no copo com tampa |

Observações para o proprietário conferir: o rótulo das garrafas mostra o Instagram como
`@acaidocesabor` (um "i"; o site usa `@acaiidocesabor`), e a garrafa da direita mostra o WhatsApp
com DDD (63), a da esquerda com (83). O rótulo do pote do Oca diz "Oca do Açaí".

## Fotos de ingredientes e embalagens

Originais recebidos do responsável pelo site, com o pedido de usar exatamente estes produtos nos
cartões do personalizador: as embalagens que a loja usa (Ninho, Farinha Láctea, Italac, coberturas
Du Porto) e fotos dos ingredientes. `scripts/fotos/preparar.mjs loja` limpa e copia cada um para
`public/images/ingredientes/` com o mesmo nome.

As fotos não vieram com autoria nem licença. As de embalagem mostram marcas de terceiros
(Nestlé, Italac, Du Porto). Três delas tinham o ícone do Google Lens no canto, sinal de que vieram
de uma busca de imagens: o ideal é trocá-las por fotos feitas na própria loja.

| Arquivo | Ingrediente no site | Enquadramento |
|---|---|---|
| `leite-condensado.png` | Leite condensado (adicional) e cobertura de leite condensado (milk-shake) | inteira (embalagem) |
| `leite-em-po.png` | Leite em pó | inteira (embalagem) |
| `farinha-lactea.png` | Farinha láctea | inteira (embalagem) |
| `marshmallow.png` | Marshmallow | recorte |
| `amendoim.png` | Amendoim | recorte |
| `chocoball.png` | Chocoball | recorte |
| `pacoca.png` | Paçoca | recorte |
| `disquete-confete.png` | Disquete (confete) | recorte |
| `banana.png` | Banana | recorte |
| `creme-ninho.png` | Creme de ninho (açaí e açaí batido) | recorte |
| `creme-avela.png` | Creme de avelã (açaí e açaí batido) | recorte |
| `cobertura-frutas-vermelhas.png` | Cobertura de frutas vermelhas | inteira (embalagem) |
| `cobertura-doce-de-leite.png` | Cobertura de doce de leite | inteira (embalagem) |
| `cobertura-acai.png` | Cobertura de açaí | inteira (embalagem) |
| `cobertura-banana-caramelada.png` | Cobertura de banana caramelada | inteira (embalagem) |
| `cobertura-chocolate.png` | Cobertura de chocolate | inteira (embalagem) |
| `cobertura-morango.png` | Cobertura de morango | inteira (embalagem) |
