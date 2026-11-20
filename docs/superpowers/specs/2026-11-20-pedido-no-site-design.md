# Pedido 100% no site, acompanhamento ao vivo e itens a mais — desenho

Aprovado pelo proprietário em 2026-11-20 (opção A completa, com o gancho que só aceita cadastro anônimo e o modo de demonstração no mesmo caminho). Pedido original: "Redesign do fluxo de pedidos — checkout 100% no site, acompanhamento Realtime e adição de itens ao mesmo pedido".

## Por quê

O cliente finaliza, acompanha e complementa o pedido sem sair do site. O WhatsApp passa a ser só um canal opcional de atendimento. A confirmação aparece apenas depois que o servidor gravou o pedido.

## Situação encontrada (auditoria, só leitura)

- A finalização abre o WhatsApp com a comanda. Se o registro falha, o site oferece "Enviar mesmo assim pelo WhatsApp".
- A função `pedido` é pública, sem identidade do cliente. A chave de tentativa vem do conteúdo do pedido: o mesmo carrinho reenviado dias depois devolve o pedido antigo.
- No Supabase de verdade (endereços públicos):
  - cadastros bloqueados;
  - login anônimo desligado;
  - tokens assinados com chave ES256.

  No Supabase Auth, o login anônimo é recusado enquanto os cadastros estiverem bloqueados.
- Todas as permissões de usuário logado exigem `is_seller()` ou o próprio registro.
- Não existem descontos, cupons, gatilhos nem histórico de situação.

## Decisões

1. **Identidade do cliente: sessão anônima do Supabase Auth.**
   - O site cria uma sessão anônima ao finalizar e guarda-a no `localStorage` com chave própria (separada da sessão do vendedor).
   - A função confere o token pelo `/auth/v1/user` e grava `orders.customer_user_id`. O banco não guarda segredo nenhum. O código ADS-0001 nunca autoriza nada.
   - Se a sessão não puder ser criada (opção desligada), o pedido é registrado do mesmo jeito, sem acompanhamento, e a tela avisa. Assim nenhuma venda se perde.
2. **Gancho `before-user-created`** (`public.antes_de_criar_usuario`): aceita só `is_anonymous = true` e recusa os outros cadastros com 403. Para criar outra conta de vendedor, desliga-se o gancho por um instante (documentado).
3. **`order_events`** (pedido, dono, tipo `status` ou `itens`, situação, origem, horário real), alimentada por gatilho em `orders` e pela função de acréscimo.
   - RLS: o cliente lê só os eventos dele; o vendedor lê todos.
   - Entra na publicação do Realtime. O cliente nunca lê `orders` direto.
4. **Função `pedido` com operações:**
   - `criar` (padrão, compatível com o site antigo);
   - `consultar` (visão reduzida, sem telefone, nome nem GPS);
   - `meus` (os pedidos da sessão dos últimos 30 dias);
   - `adicionar`.

   A chave de tentativa vem do site (um id por finalização, reaproveitado nas novas tentativas). Sem ele, vale o resumo do conteúdo, como antes.
5. **Acréscimo:** a função SQL `adicionar_itens_pedido` faz tudo numa transação:
   - trava a linha e confere dono, situação (`novo` ou `preparando`) e repetição;
   - acrescenta o lote a `orders.additions` (JSONB) e soma subtotal e total, sem frete de novo;
   - confere o troco;
   - registra o evento.

   Os preços vêm do cardápio no servidor. O site manda só os itens e o valor que viu, para detectar mudança de preço.
6. **Realtime do cliente:** `postgres_changes` em `order_events` com o token anônimo (o RLS filtra). Cada aviso faz uma nova `consultar`. Reserva: consulta a cada 20 s sem conexão, ao reconectar e ao voltar para a aba.
7. **Telas:**
   - `/acompanhar` (lista dos pedidos do aparelho) e `/acompanhar/:codigo`, com linha do tempo, resumo, "➕ Adicionar mais itens a este pedido" e "💬 Dúvidas? Falar no WhatsApp";
   - "📦 Acompanhar pedido" no cabeçalho quando há pedido em andamento;
   - modo de adição com faixa no cardápio e no carrinho ("Pedido original" + "Novos itens", "Confirmar adição ao pedido", "Cancelar adição").
8. **Finalização:** botão "Finalizar pedido". Em caso de sucesso, guarda o pedido no aparelho, esvazia o carrinho e abre o acompanhamento com "✅ Pedido recebido com sucesso!". Em caso de falha, mostra o aviso e "Tentar de novo" com a mesma chave. Sem WhatsApp em nenhuma etapa.
9. **Vendedor:** o cartão mostra os lotes acrescentados ("➕ Novos itens adicionados pelo cliente", horário, +R$). O acréscimo chega como `UPDATE`: sem bipe e sem contar como pedido novo.
10. **Modo de demonstração** (sem Supabase): o mesmo caminho com o `localStorage`, sempre marcado como demonstração. Nunca é usado com o Supabase configurado.

## Fora

- Pagamento online.
- Conta obrigatória para o cliente.
- Recuperação do acompanhamento em outro aparelho (a alternativa é falar com a loja informando o código).

## Ordem de publicação

1. SQL `20261120200000_acompanhamento_cliente.sql`.
2. Em Authentication, ligar "Allow new users to sign up" e "Allow anonymous sign-ins", e ligar o gancho "Before User Created" com `public.antes_de_criar_usuario`.
3. `npm run build:pedido` e colar a função.
4. Publicar o site.
