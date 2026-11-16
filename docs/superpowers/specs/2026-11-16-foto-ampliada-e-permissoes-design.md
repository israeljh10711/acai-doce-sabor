# Foto ampliada (lightbox) e permissões com edição ao vivo

Pedido de 2026-11-16: "Visualizador de imagens em tela cheia (lightbox zoom) + sistema de permissões
(cliente, vendedor e administrador) com edição ao vivo de preços e imagens".

## Parte 1: foto ampliada (feita)

- **Onde:** vitrine (os 4 produtos), os 43 itens das gavetas, personalizador (foto do produto, cada
  adicional, fruta, calda e creme, e as coberturas da Barca), escolha de sabor, confirmação,
  carrinho e a miniatura da notificação de oferta.
- **Como abre:** a lupa (botão `[data-zoom]`, `aria-label="Ampliar foto: <nome>"`) cobre a foto, com
  o ícone no canto. É sempre irmã do botão do cartão, nunca dentro dele (um botão dentro de outro
  botão ou de um rótulo é HTML inválido):
  - fruta, calda e creme: o botão de marcar virou uma camada sobre o cartão, e a foto fica acima
    dela (`z-10`);
  - produtos da vitrine: a lupa fica acima do link que cobre o cartão;
  - coberturas da Barca: a lupa fica sobre a amostra, fora do rótulo;
  - oferta: o botão de aceitar cobre o cartão pelo `::after`, e a miniatura fica acima.
- **Visualizador** (`src/features/lightbox/`): um só para o site (`LightboxProvider` no
  `AppLayout`), feito com `<dialog>` nativo, como as outras janelas do site, sem biblioteca nova. As
  referências do 21st.dev (Image Preview, Zoomable Image) seguem o mesmo padrão. Tem:
  - fundo escuro com desfoque;
  - nome, selo de preço dourado e X de 44 px (`aria-label="Fechar imagem"`);
  - a foto em até 92% da largura e 75% da altura da tela;
  - "Ampliar"/"Reduzir" (2x) e toque duplo; ampliada, a foto rola com o dedo e arrasta com o mouse;
  - a descrição e o aviso de imagem ilustrativa;
  - fecha no X, no Esc e no fundo escuro, e o foco volta para quem abriu.
- **Nitidez:** a foto nunca aparece maior que o dobro do tamanho real.
  - As 9 fotos de banco dos ingredientes (256 px) ganharam a cópia `-grande.webp`, de até 800 px,
    feita dos originais.
  - As fotos de ingrediente enviadas pela loja são pequenas (a banana tem 201 px) e aparecem no
    tamanho que têm.
- **Oferta:** abrir a foto da oferta segura a oferta na tela (a contagem para). Abrir uma foto em
  outro lugar esconde a oferta, como qualquer janela.
- **"Ver foto" do personalizador** (celular): abre o mesmo visualizador, que substitui a janela
  própria que havia.
- **Fora:**
  - a montagem do topo da página inicial, que é decorativa (as mesmas fotos ampliam na vitrine,
    logo abaixo);
  - as bolinhas sobrepostas do Açaí Batido (as fotos de leite condensado, amendoim e paçoca), que
    formam uma amostra do sabor.
- **Testes:**
  - unitários: `lightboxFit.test.ts` (tamanhos e rolagem) e `lightboxImages.test.ts` (nome, preço e
    foto de cada tipo);
  - `tests/assets.test.ts`: as cópias grandes;
  - `npm run check:lightbox`: no navegador, cada lugar, sem disparar a ação do cartão, zoom, os três
    jeitos de fechar, o foco e a oferta segura.
  - Não há `ImageLightbox.test.tsx`, porque o projeto não tem jsdom nem Testing Library (decisão
    T-091).

## Partes 2 e 3: permissões, edição ao vivo e armazenamento (aguardando decisão)

O pedido guarda senhas, preços, fotos e "esgotado" só no navegador (`localStorage` e `IndexedDB`).
Assim, o resultado não faz o que o pedido promete ("aplica imediatamente em todo o site"):

1. **Cada aparelho tem a sua cópia.** O dono muda o preço no celular dele, mas os clientes, nos
   celulares deles, continuam vendo o preço, a foto e a disponibilidade antigos. O backup (.json)
   só leva as mudanças para outro aparelho do próprio dono, não para os clientes.
2. **Senha no código do site.** O código do site vai inteiro para o navegador de qualquer
   visitante: as senhas "2026" e "1111" (e as trocadas depois, guardadas no aparelho) podem ser
   lidas ou contornadas mexendo no armazenamento do navegador. Isso vai contra a regra do projeto
   "não inserir chaves secretas no frontend".
3. **Desconto de balcão.** Quem entrar como vendedor (o PIN está no código) poderia mandar pelo
   WhatsApp um pedido com desconto. A regra "validar preços no servidor, nunca confiar só no
   navegador" existe por isso.

Para funcionar de verdade, as partes 2 e 3 precisam de um servidor: o Supabase previsto desde o
início (Fase 6), no plano gratuito. Com ele:

- login do dono e dos vendedores com e-mail e senha guardados no servidor, nunca no código, e
  troca de senha;
- preços, textos, "esgotado", Pix, horário e itens novos no banco, vistos por todos os clientes;
- fotos enviadas do celular, reduzidas no próprio celular (800 px, cerca de 100 KB) e guardadas no
  armazenamento do Supabase;
- regras no banco: só o administrador altera; o vendedor registra pedido, observação e desconto,
  que ficam gravados;
- o pedido gravado antes do WhatsApp, o que destrava a decisão D-039.

Criar a conta do Supabase depende do dono (é a conta dele, e a regra é não contratar serviço sem
autorização). Para começar, basta o endereço do projeto e a chave pública ("publishable"). A chave
"service_role" nunca deve ser enviada.

Opções levadas ao responsável:

- **A (recomendada):** criar o Supabase gratuito e fazer as partes 2 e 3 no servidor.
- **B:** um protótipo que vale só no aparelho em que for usado, com o aviso escrito na tela, para o
  dono testar as telas. Depois, migrar para o Supabase (a parte de armazenamento seria refeita).
