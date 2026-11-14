# Confirmação do item, pagamento e pedido pelo WhatsApp

Pedido do responsável em 2026-11-14: "Modal de confirmação pré-carrinho, checkout com pagamento/troco/Pix e pedido completo no WhatsApp".

## Fluxo

1. No personalizador, "Adicionar ao carrinho" abre a janela **"Confirme seu item antes de adicionar"**. Ela mostra:
   - o produto, o recipiente e o tamanho, com a foto;
   - o sabor, quando houver;
   - cada grupo de ingredientes escolhido (Adicionais, Frutas, Caldas e cremes, Adicionais pagos), com o preço dos que custam;
   - o valor do item.

   Os botões:
   - **Adicionar e ir para o carrinho**: adiciona e abre `/carrinho`.
   - **Adicionar e continuar comprando**: adiciona e volta ao Cardápio (`/monte-seu-pedido`), com o aviso "X adicionado ao carrinho". O personalizador recomeça vazio, porque a montagem não fica salva fora da tela.
   - **Voltar e editar**: fecha sem adicionar e mantém todas as escolhas. Esc e o toque fora da janela fazem o mesmo.
2. Editar um item que já está no carrinho continua com "Salvar alterações", direto, sem a janela: não é um item novo.
3. No carrinho, abaixo do total, ficam a **forma de pagamento** e o botão **Confirmar e Enviar Pedido no WhatsApp**. As opções, uma por vez:
   - **Pix**: cartão com a chave, o tipo, o titular e o botão "Copiar chave Pix", que mostra "✓ Chave Pix copiada!" por 2,5 s. No celular pela rede local (http) não existe `navigator.clipboard`; nesse caso a cópia usa o método antigo do navegador e, se ainda assim falhar, a tela pede para segurar o dedo sobre a chave.
   - **Cartão de crédito** e **Cartão de débito**.
   - **Dinheiro**: campo "Troco para quanto?" ou a opção "Não preciso de troco (valor exato)". O troco aparece na hora. Um valor menor que o total mostra o aviso e bloqueia o envio. Sem valor e sem a opção marcada, o envio também fica bloqueado, com aviso: a loja precisa saber se leva troco.
4. Enviar: confere a forma de pagamento e, se for dinheiro, o troco. Depois monta a mensagem e abre `wa.me/5583996999980` em outra aba. A tela não diz que o pedido foi enviado: diz que o WhatsApp foi aberto e que o pedido só chega quando o cliente toca em Enviar. O carrinho continua salvo, e o botão "Já enviei, esvaziar o carrinho" limpa quando o cliente quiser.

## Decisões

- **Regra "gravar no banco antes do WhatsApp"** (briefing original): ainda não há banco (Supabase), e o pedido de 2026-11-14 manda ligar o envio pelo WhatsApp agora. O envio fica ligado sem banco. `orderService.ts` continua sendo o ponto em que a gravação entra quando o banco existir, antes de abrir o WhatsApp. Antes de publicar o site, o proprietário decide se aceita assim.
- **Chave Pix**: os dados vieram no pedido como exemplo ("83996999980", Celular, "Açaí Doce Sabor") e ficam em `storeInfo.pix`. Precisam ser confirmados pelo proprietário, inclusive o nome do titular que o banco mostra.
- **Troco**: calculado sobre o total dos itens. A taxa de entrega ainda não foi informada; se existir, o troco precisa somá-la.
- **Dados de entrega**: o pedido não pede nome, endereço nem retirada; a mensagem segue o modelo enviado. A loja pergunta no WhatsApp.
- **Grupos**: Kit Kat e Cereja aparecem em "Adicionais pagos", como no cardápio. Os cremes de ninho e avelã aparecem em "Caldas e cremes", com o preço.

## Arquivos

- Novos: `features/checkout/payment.ts` (regras puras e testes), `features/checkout/copyText.ts`, `features/checkout/CheckoutPanel.tsx`, `features/configurator-core/ConfirmItemDialog.tsx`.
- Alterados:
  - `cart.ts`: `selectionSections`, lista de escolhas por grupo, usada na janela e na mensagem;
  - `orderMessage.ts`: modelo do pedido;
  - `OrderSummary.tsx`: abre a janela;
  - `CartPage.tsx`: usa o `CheckoutPanel`;
  - `BuildOrderPage.tsx`: aviso de item adicionado;
  - `storeInfo.ts`: dados do Pix;
  - `icons.tsx`;
  - `index.css`: página parada atrás da janela.
- Testes:
  - unitários: pagamento, troco, leitura de valores em reais, mensagem e grupos;
  - no navegador: os três botões da janela, Esc, foco, pagamento obrigatório, troco, Pix e o texto que vai para o WhatsApp.
