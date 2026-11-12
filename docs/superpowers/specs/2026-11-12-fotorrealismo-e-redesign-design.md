# Correção da Fase 4: fotorrealismo no 3D e visual comercial

Data: 2026-11-12. Pedido do proprietário com seis imagens: quatro referências reais do produto
(copos transparentes com camadas, açaí puro no copo, isopor visto de cima com os adicionais em
setores), uma referência de visual comercial (roxo, amarelo, títulos fortes em caixa alta) e a
tela atual, que ele achou artificial ("desenho animado" no 3D, fonte e layout genéricos).

O proprietário pediu execução imediata, sem rodada de perguntas. As escolhas abaixo marcadas
como "decisão do executor" podem ser corrigidas por ele depois.

## Intenção

- O 3D tem de parecer comida de verdade, não brinquedo: copo de PET transparente, açaí escuro e
  cremoso, isopor branco texturizado, adicionais orgânicos e generosos, luz de estúdio.
- O site tem de ter cara de açaiteria comercial, vibrante e apetitosa, e não de modelo genérico.

## Regras que continuam valendo

- O 3D mostra **somente** o que o cliente escolheu. Camadas de creme dentro do copo só aparecem
  quando um creme ou o leite condensado foi escolhido.
- Nada de cardápio inventado: confeitos coloridos (tipo M&M's) não estão no cardápio e não entram.
  Nada de combos ou promoções sem dados reais.
- Sem imagens de banco de imagens no site. As referências (uma delas tem marca d'água da Designi)
  servem só de modelo visual.
- Aviso legal sempre visível junto das imagens.

## O que muda no 3D

| Parte | Como fica |
|---|---|
| Copo de PET | Material físico transparente (`transmission` 0,92, `ior` 1,49, rugosidade 0,12), parede com espessura real, borda enrolada e dois anéis estruturais abaixo dela, gotas leves de condensação (mapa de relevo) |
| Pote de PP | Translúcido fosco, como o polipropileno real |
| Isopor | Branco, com a textura das bolinhas do isopor (mapa de relevo), borda arredondada e manchas de açaí na borda de dentro |
| Copo de vidro do milk-shake | Vidro com refração, parede e fundo grossos |
| Açaí | Roxo bem escuro (#2A081D a #3B0D2B), superfície granulada e cremosa (mapa de relevo), marcas de espátula no topo; na parede do copo, veios e bolhas de ar |
| Camadas no copo | Faixas de creme encostadas na parede do copo, visíveis pelo plástico, só para os cremes e o leite condensado escolhidos (no máximo duas) |
| Adicionais | Em setores, como no isopor da referência, cobrindo o topo com fartura; granola com flocos, castanhas e uvas-passas; amendoim triturado; rodelas de banana com fibras; fatias de morango com sementes e brilho úmido |
| Caldas e cremes | Fios brilhantes com verniz (clearcoat) escorrendo; cremes espalhados no próprio setor |
| Luz | Estúdio montado no código com painéis de luz (sem baixar imagem de terceiros), luz principal neutra-quente, luz de recorte para o copo, sombra de contato suave, ACESFilmic |
| Desempenho | Pedaços repetidos desenhados de uma vez (instâncias); resolução da transparência menor no celular; texturas pequenas em WebP dentro dos GLB |

Decisão do executor: o `preset="studio"` do drei baixa a imagem de iluminação de
raw.githack.com a cada visita. O estúdio é montado com `Lightformer`, com o mesmo efeito e sem
dependência externa.

Decisão do executor: os cremes e o leite condensado viram faixas dentro do copo e também aparecem
por cima. É ilustração; o aviso legal cobre a diferença.

## O que muda no site

- Fontes: Montserrat (títulos, 800 e 900, caixa alta) e Inter (textos e preços com `tabular-nums`).
  Saem Fraunces e Figtree.
- Cores: Roxo Açaí #4A0E36 e #5E1245; Amarelo Ouro #FACC15 e #EAB308 com texto #2A081D nos botões
  principais, nas seleções e nos selos de preço e de grátis; fundos #FFFFFF e #F8F6F9. Substitui a
  paleta do guia em PDF aplicada na Fase 2. A logo original continua.
- Miniaturas de cada ingrediente nos personalizadores, renderizadas no Blender com os mesmos
  modelos 3D (sem fotos de terceiros).
- Imagens dos cartões e do destaque renderizadas de novo no Cycles, no novo visual.
- Componentes inspirados em padrões consultados no 21st.dev, adaptados ao projeto (sem shadcn),
  com microinterações em Framer Motion.

## Limites conhecidos

- Tempo real no navegador do celular não fica idêntico a uma foto. As imagens renderizadas no
  Cycles chegam mais perto; a cena 3D fica o mais próxima possível sem travar o celular.
- Sem celular real para medir a fluidez: fica para o teste do proprietário.
