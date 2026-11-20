# Gerenciador de sabores, pendências do modo vendedor e pedidos no Supabase — desenho

Pedido do responsável em 2026-11-17: "Pode seguir com A e 1". Na ordem:
1. Concluir as pendências do modo vendedor, incluindo um gerenciador de sabores para todos os produtos: Açaí Batido, Milk-shake e os demais.
2. Deixar pronto o registro de pedidos no Supabase:
   - **opção A:** função no servidor (Edge Function) conferindo os preços, com código `ADS-0001` e sem pedido duplicado;
   - **opção 1:** "Enviar mesmo assim pelo WhatsApp" se a internet ou o servidor falhar.
3. Dizer onde colar a URL e a chave pública.

Estado: aprovado pela mensagem do pedido; as escolhas abaixo marcadas como "minha escolha" o responsável pode trocar.

## Parte 1 — Pendências do modo vendedor

### Gerenciador de sabores

- **Onde aparece:**
  - no formulário de cada item das seções: todas as escolhas do item (ex.: "Sabor"; ou "Sabor do sorvete" e "Sabor da cobertura" no Kit Completo), cada uma com a lista de opções;
  - no formulário do Açaí Batido e do Milk-shake: a lista de sabores.
- **Em cada opção:** nome, "Disponível / Esgotado" e excluir. Embaixo, "+ Adicionar sabor".
- **No item, também:** renomear a escolha, "+ Adicionar outra escolha" (até 3) e excluir uma escolha.
- **Sabor esgotado para o cliente:**
  - aparece desligado, com "Esgotado", e não pode ser escolhido;
  - no personalizador, o vendedor também esgota um sabor em 1 toque, como nos complementos;
  - se esgotar com o cliente no carrinho, o item fica marcado e o envio espera.
- **Minhas escolhas:**
  - **Açaí Oca e Açaí Tradicional** continuam sem sabores: ganhar um "Sabor" obrigatório mudaria o pedido desses açaís;
  - **Barca:** as coberturas são as caldas do personalizador. Esgotar ou renomear uma calda vale também na Barca, sem lista própria;
  - **sabor novo:** sem foto própria (usa a do item); os sabores com foto continuam com ela;
  - **os ids** dos sabores que já existem não mudam, para não quebrar carrinhos guardados;
  - **o campo de sabores separados por vírgula** sai do formulário; os sabores gravados por ele continuam valendo.

### Duplicar com todas as escolhas

"Duplicar" passa a copiar todas as escolhas do item (sabores e tamanhos), não só a primeira.

### Fotos do aparelho

- Foto que nenhuma mudança usa mais (item excluído, foto trocada) é apagada do aparelho.
- O endereço temporário dela também é liberado.
- Só apaga fotos com mais de 1 hora, para não pegar uma foto que outra aba acabou de enviar e ainda vai gravar.

## Parte 2 — Pedidos no Supabase (A e 1)

### Caminho do pedido

1. O cliente toca em "Confirmar e Enviar Pedido no WhatsApp". O site confere os dados no aparelho, como hoje.
2. Com o Supabase ligado, o site envia à função `pedido`:
   - o carrinho (só ids, escolhas, quantidades e observações);
   - os dados do cliente e o pagamento;
   - o total que o cliente viu;
   - um identificador daquela tentativa.
3. A função lê as mudanças do vendedor no banco e refaz tudo com as mesmas regras do site:
   - itens e escolhas válidos;
   - esgotados (itens, complementos, sabores);
   - loja aberta ou fechada (antecipado ou bloqueio);
   - dados do cliente e frete do bairro;
   - pagamento e troco;
   - subtotal, frete e total.
4. **Recusa:** se algo não bate, nada é gravado e o site mostra o motivo:
   - esgotou X;
   - a loja fechou;
   - os preços mudaram (o site relê o cardápio, mostra o total novo e o cliente envia de novo).
5. **Tudo certo:** grava o pedido com o código seguinte (`ADS-0001`, `ADS-0002`...) e devolve a comanda pronta, feita no servidor e com "🔖 *Pedido:* ADS-0001". O site abre o WhatsApp com ela e mostra "Pedido ADS-0001 registrado. Falta enviar a mensagem no WhatsApp."
6. **Sem duplicar:** tocar de novo, ou recarregar e tocar, com o mesmo pedido devolve o mesmo código. Pedido mudado é tentativa nova.
7. **Falha de internet ou servidor (opção 1):** "Não foi possível registrar o pedido", com "Tentar de novo" e "Enviar mesmo assim pelo WhatsApp". Este último abre a comanda feita no aparelho, com "⚠️ *Pedido não registrado no sistema*" logo abaixo da data.
8. **Sem o Supabase ligado:** como hoje (só o WhatsApp).

### Segurança

- **Chaves:**
  - o site continua só com a chave pública;
  - a função usa a chave de servidor que o próprio Supabase põe no ambiente dela (nunca no site).
- **Acesso à tabela `orders`:**
  - nenhum acesso direto para visitantes;
  - só o vendedor (tabela `sellers`) lê e muda a situação;
  - a função grava.
- **A função é pública** (qualquer cliente faz pedido): a verificação de JWT fica desligada nela. Limites contra abuso:
  - tamanho do pedido;
  - até 20 unidades por item;
  - identificador de tentativa único.
- **Dados pessoais:** o pedido guarda nome, telefone e endereço só para a loja atender. Apagar pedidos antigos fica com o responsável, no painel.

### O que o responsável faz no Supabase

1. Roda o SQL novo: `supabase/migrations/20261117120000_pedidos.sql`.
2. Cria a função `pedido`: Edge Functions → criar pelo editor → cola todo o arquivo `supabase/functions/pedido/index.ts` → publicar.
3. Na aba de detalhes da função, desliga a verificação de JWT.
4. Os pedidos aparecem em Table Editor → `orders`.

**Quando o cardápio do código mudar**, `npm run build:pedido` gera o arquivo de novo e ele é colado de novo na função. As mudanças do modo vendedor não precisam disso.

### Como é testado sem um Supabase de verdade

- **Testes de unidade** da função:
  - pedido certo;
  - repetido;
  - preço adulterado;
  - esgotado;
  - loja fechada com bloqueio;
  - cliente ou pagamento inválidos.
- **Conferência no navegador** com um Supabase de mentira na própria máquina. Ele roda o arquivo da função de verdade (o mesmo que vai ser colado) e um banco na memória, com um segundo site ligado a ele.
- **Não testado:** o Supabase de verdade, porque faltam as chaves.

## Fora desta etapa

- **Lista de pedidos para o vendedor** (situações novo, confirmado, preparando...): é o passo seguinte. Até lá, os pedidos ficam no painel do Supabase.
- **Avisos que ficaram para depois e não são do modo vendedor:**
  - observação em outra aba;
  - "fechada" três vezes no celular;
  - tamanho do pacote.

## Decisões tomadas na construção

- **Chave de repetição do pedido:** calculada no servidor (SHA-256 do carrinho, do cliente e do pagamento), e não um identificador mandado pelo site. Assim ninguém lê um pedido gravado sem saber o conteúdo inteiro dele (que inclui ids sorteados no aparelho). Pedido mudado (por exemplo, a observação editada) é pedido novo.
- **Pedido já gravado:** mandado de novo, mesmo com outro total, volta o pedido gravado, com o código dele.
- **Numeração:** o número sai de uma sequência do banco antes de gravar. Duas tentativas iguais ao mesmo tempo gastam um número, e a sequência pula um código (raro).
- **"Os preços mudaram":** além de "Tentar de novo", o carrinho oferece "Enviar mesmo assim pelo WhatsApp". Se a função colada estiver com o cardápio antigo, o total nunca bateria e a venda se perderia.
- **Aba do WhatsApp:** abre em branco no toque e recebe o endereço depois do registro (fecha se não der). O navegador bloquearia uma janela aberta depois de esperar o servidor.
- **Toque duplo no botão de enviar:** o segundo toque, enquanto o pedido é registrado, é ignorado (abria duas abas; o banco já gravava uma vez só).
- **Código da função:** fica em `src/server/` e passa pelo TypeScript do site. O arquivo gerado (`supabase/functions/pedido/index.ts`) leva `// @ts-nocheck` e fica fora do lint; a conferência `check:pedido-funcao` confere se ele está atualizado.
- **Chaves de servidor:** a função aceita a nova (`SUPABASE_SECRET_KEYS`) e a antiga (`service_role`).
- **Pedidos no banco:** o vendedor logado lê os pedidos e muda só a situação; o resto fica como a função gravou.
- **Sabores:** o campo antigo "sabores separados por vírgula" saiu do formulário (o gerenciador cobre). O que ele gravou continua valendo.

