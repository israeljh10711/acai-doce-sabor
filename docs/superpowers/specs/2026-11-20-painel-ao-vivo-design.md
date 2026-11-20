# Painel de pedidos ao vivo — desenho (complemento de 2026-11-20)

Aprovado pelo proprietário em 2026-11-20. Complementa a etapa 2 (`2026-11-20-painel-de-pedidos.md`) com o pedido "Painel de pedidos ao vivo, Supabase Realtime e notificações".

## Por quê

A equipe precisa ver o pedido no instante em que ele é registrado e ouvir o aviso sem recarregar a página. Também precisa seguir um fluxo de situação próprio de cada modalidade e chamar o cliente pelo WhatsApp. O fluxo completo tem de poder ser testado mesmo sem o Supabase.

## Decisões aprovadas

1. **Fluxo de situação** (substitui o da etapa 2):
   - **Novo** → "Aceitar / Preparar" → **Preparando**;
   - de Preparando, o passo depende da modalidade:
     - Entrega: "🛵 Saiu para Entrega" → `saiu_para_entrega` (out_for_delivery);
     - Retirar: "🛍️ Pronto para Retirada" → `pronto_retirada` (ready_for_pickup);
     - Comer no Local: "🍨 Pronto para Consumo" → `pronto_consumo` (ready_for_dine_in);
   - de qualquer um desses três, "✅ Concluir" → **Concluído**;
   - "❌ Cancelar" com confirmação → **Cancelado**;
   - concluído e cancelado não têm mais ações; o registro nunca é apagado.

   Os valores continuam em português, como os pedidos que já existem. `confirmado` e `pronto` (da etapa 2) continuam válidos para pedidos antigos.
2. **SQL novo:**
   - a regra da situação ganha `pronto_retirada` e `pronto_consumo`;
   - nova regra que liga a situação à modalidade: "saiu para entrega" só na entrega, os dois "pronto" só na própria modalidade;
   - a tabela `orders` entra na publicação `supabase_realtime`;
   - as permissões não mudam.
3. **Realtime:** o cliente oficial `@supabase/realtime-js` (versão fixa 2.119.0), só no código do vendedor (carregado sob demanda).
   - Inscrição em `INSERT` e `UPDATE` da tabela `orders`, com o login do vendedor, para valer o RLS.
   - A consulta a cada 15 s fica como reserva quando a conexão cai e passa a 60 s com a conexão ativa.
4. **Contador e som em qualquer página:**
   - o botão "📋 Pedidos" da faixa mostra um selo vermelho pulsante com os pedidos "Novo";
   - a escuta roda enquanto o vendedor estiver logado, em qualquer página, e para ao sair do Modo Vendedor;
   - o som toca em qualquer página.
5. **Som:**
   - só para `INSERT` recebido depois da carga inicial;
   - nunca para os pedidos da carga, para `UPDATE` ou para eventos repetidos (sempre conferido pelo `id`);
   - controle "🔔 Som Ativo" / "🔕 Silenciar"; o painel só diz "Som Ativo" quando o navegador já liberou o áudio (antes, pede o toque);
   - a escolha fica no aparelho.
6. **Modo de demonstração local (sem Supabase):**
   - o pedido enviado pelo carrinho também é guardado no `localStorage` daquele navegador, com o código `DEMO-0001`;
   - o painel mostra esses pedidos com a marca "Modo de demonstração local";
   - a situação também muda e fica guardada no aparelho;
   - outras abas do mesmo navegador são avisadas;
   - o mesmo pedido mandado de novo não é duplicado;
   - a comanda do WhatsApp não muda;
   - com o Supabase configurado e uma falha, nada vai para o modo local (continua o "Enviar mesmo assim" de 2026-11-17);
   - os pedidos de demonstração nunca são migrados para o Supabase.
7. **Segurança:**
   - no Supabase, o desbloqueio é o login do vendedor (Supabase Auth), e o RLS protege leitura, mudança e Realtime;
   - no modo local, a senha `vendedor2026` é conferida só no navegador e protege apenas dados daquele navegador. Isso fica documentado como limite.

## Cartão (ajustes)

- **Cabeçalho:** `#ADS-0001` (ou `#DEMO-0001`), HH:MM no horário da loja, o nome do cliente e o selo "🛵 Entrega" / "🛍️ Retirar" / "🍨 Comer no Local".
- **Itens:** lidos da comanda gravada, organizados:
  - quantidade, nome, tamanho e sabor;
  - "✨ COMPLETO";
  - "🚫 SEM: …" em destaque;
  - extras pagos destacados;
  - acompanhamentos;
  - "📝 Observação: …" numa caixa.

  Comanda que não dá para ler: a lista simples gravada.
- **Valores:**
  - endereço completo e bairro (só na entrega), frete, subtotal e total como gravados;
  - pagamento: "💠 Pix", "💵 Dinheiro", "💵 Dinheiro — Troco para R$ XX" ou "💳 Cartão de crédito/débito".
- **Ações:**
  - "📍 Abrir GPS no Mapa" só na entrega com GPS;
  - "💬 Chamar Cliente no WhatsApp" com o telefone do cliente (wa.me), só quando ele informou.

## Filtros

- Todos (inclui os cancelados);
- 🆕 Novos;
- 🍨 Preparando (inclui `confirmado`);
- 🛵 Saiu / Pronto (saiu para entrega e os prontos);
- ✅ Concluídos.

Os pedidos do dia da loja e os de antes ainda em andamento, os mais novos primeiro.
