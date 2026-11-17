# Operação do modo vendedor e comanda do WhatsApp — desenho

Pedido colado pelo responsável em 2026-11-17: "Atualização operacional do modo vendedor (esgotado em 1 toque, loja aberta/fechada, taxa de entrega editável, duplicar discreto) e nova comanda detalhada do WhatsApp com emojis".

Estado: **aguardando aprovação** (duas perguntas no fim).

## Por que

O vendedor precisa operar a loja no pico sem abrir formulários: esgotar um item num toque, fechar a loja quando acaba o açaí, ajustar o prazo e a taxa de entrega do dia. E a equipe precisa receber um pedido completo (quem é, onde entregar, quanto cobrar, troco) que se leia de relance.

## O que não muda

- O layout atual, as 73 fotos reais em `public/images/`, a barra lateral (computador), o menu deslizante (celular), a lupa das fotos.
- A senha do modo vendedor e a regra do Completo (só adicionais e frutas sem custo; caldas, cremes e pagos somam à parte).
- O cardápio do código continua sendo a base; tudo o que o vendedor muda é uma camada por cima.
- Nada de chave secreta no site; nada de pacote novo.

## Como guardar as configurações da loja

1. **Escolhido:** um tipo novo de mudança, `settings` (id `loja`), no mesmo lugar das mudanças do cardápio: no aparelho enquanto não há Supabase, no Supabase depois. Ganha de graça o backup, a leitura a cada 60 s e a segurança (só o vendedor grava). O SQL só precisa aceitar o tipo novo.
2. Tabela própria `store_settings` com serviço separado: duplicaria login, cache, backup e leitura.
3. Fixo no código: o vendedor não mudaria pela tela. Não atende o pedido.

**Importante:** enquanto o Supabase não estiver ligado, loja fechada, prazo, taxas e esgotados ficam só no aparelho do vendedor. Os clientes veem o padrão: horário 13h–21h, prazo 30–45 min e entrega "a combinar".

## Desenho

### 1. Esgotado em 1 toque

- **Modo vendedor:** pílula no canto de cima, à direita, da foto de cada cartão (faixa de destaques, os 4 produtos, os itens das 5 seções). Nos complementos do personalizador, a foto é pequena demais para "Editar" e a pílula juntos: a pílula fica abaixo do nome.
  - Disponível: verde (`bg-emerald-600`), "Disponível".
  - Esgotado: vermelha (`bg-red-600`), "Esgotado".
  - Um toque alterna e grava na hora (aparelho ou Supabase), sem abrir o formulário.
- **Cliente:**
  - foto esmaecida com a tarja "ESGOTADO" atravessando;
  - botão de compra desligado com "Indisponível no momento";
  - os 4 produtos ganham "disponível/esgotado" (hoje só os itens e os complementos têm);
  - o personalizador de um produto esgotado (inclusive Pote 1 L e Barca, abertos pelo endereço direto) mostra a tarja e não deixa adicionar;
  - complemento esgotado continua bloqueado e o Completo continua pulando ele (já é assim).
- **Carrinho:** item que esgotou depois de entrar no carrinho aparece marcado ("Esgotado: remova para enviar") e o envio fica bloqueado até ele sair.

### 2. Loja aberta/fechada e prazo

- **Na faixa do vendedor:**
  - botão "Loja Aberta" (`bg-emerald-500`) ou "Loja Fechada" (`bg-red-600`), que alterna com um toque;
  - "Tempo": 20–35, 30–45 (padrão), 45–60, 60–80 min ou um prazo digitado;
  - "Com a loja fechada": bloquear o envio, ou aceitar como pedido antecipado (padrão, porque é o que acontece hoje).
- **Cliente:**
  - selo discreto no cabeçalho de todas as páginas: "Aberto agora • Entrega: 30–45 min" ou "Loja fechada no momento". No computador, dentro do cabeçalho; no celular, numa linha fina logo abaixo dele, porque ao lado da logo não cabe;
  - o selo grande que já existe no início e no cardápio passa a seguir o mesmo estado e o mesmo prazo;
  - no carrinho, com a loja fechada: aviso amigável. Se o vendedor bloqueou, o botão de enviar fica desligado e diz quando abre. Se aceita antecipado, a comanda ganha a linha "Pedido antecipado".
- **Relação com o horário 13h–21h:** pergunta 1, no fim.

### 3. Entrega / frete

- **Botão "Entrega / Frete" na faixa do vendedor** abre `DeliverySettingsModal.tsx` com três modos:
  - **Entrega grátis:** R$ 0,00 em qualquer endereço;
  - **Taxa fixa ou lista de bairros/regiões:** nome e valor, com "+ Adicionar bairro/taxa", editar e excluir. Uma linha só ("Toda a cidade — R$ 5,00") é a taxa fixa;
  - **A combinar no WhatsApp:** não soma nada e a comanda diz "A combinar". É o padrão até o vendedor configurar, porque hoje a taxa não é conhecida.
  - Retirada no balcão: sempre disponível e grátis.
- **Carrinho (novo bloco "Seus dados e entrega"):**
  - **Nome** (obrigatório) e **Telefone** (opcional; se escrito, DDD + número);
  - **Entrega** ou **Retirar na loja**, em cartões como os da forma de pagamento;
  - **Entrega:**
    - Rua, Número e Bairro são obrigatórios; Ponto de referência é opcional;
    - com lista de bairros, o Bairro vira a lista com o valor de cada um, mais "Outro bairro (taxa a combinar)" para quem não está nela;
  - **Retirar na loja:** sem endereço, frete "Grátis (R$ 0,00)";
  - **Resumo:** Subtotal, Entrega e Total. O troco em dinheiro passa a contar a entrega. Com entrega a combinar, o total diz "+ entrega a combinar".

### 4. Duplicar

- Botão pequeno e cinza "Duplicar" no rodapé do cartão (longe do "Editar"), só nos itens das seções e da faixa de destaques.
- Pote 1 L e Barca não têm "Duplicar", porque abrem o personalizador.
- Abre o formulário de cadastro com o título "Duplicar Item — [Nome] (Cópia)" e já preenchido:
  - nome "[Nome] (Cópia)";
  - preço, preço antigo, descrição e categoria;
  - tamanhos, sabores e disponibilidade.
- A foto fica vazia, para o vendedor escolher a nova.

### 5. Comanda do WhatsApp

Exemplo com entrega, dinheiro com troco e Completo sem Farinha láctea:

```text
🍧 *NOVO PEDIDO — AÇAÍ DOCE SABOR* 🍧
📅 *Data/Hora:* 17/11/2026 às 15:42

👤 *DADOS DO CLIENTE*
• *Nome:* Maria
• *Telefone:* (83) 99999-0000
• *Tipo de Pedido:* 🛵 Entrega em Domicílio
• *Endereço:* Rua Exemplo, 12, Centro — Ref.: perto da praça

━━━━━━━━━━━━━━━━━━━━
🍨 *ITENS DO PEDIDO*

1️⃣ *1x Açaí Tradicional* (Isopor M) — *R$ 25,00*
   ✨ *Montagem:* COMPLETO
   🚫 *RETIRAR (SEM):* Farinha láctea
   ➕ *Cremes / Extras Pagos:* Creme de ninho (+R$ 3,00), Creme de avelã (+R$ 3,00), Kit Kat (+R$ 4,00)
   🥄 *Acompanhamentos:* Granola, Paçoca, … , Banana, Morango
   📝 *Observação:* pouco gelo

2️⃣ *2x Picolé* (Sabor: Morango) — *R$ 6,00*

━━━━━━━━━━━━━━━━━━━━
🧾 *RESUMO FINANCEIRO*
🛍️ *Subtotal dos itens:* R$ 31,00
🛵 *Frete / Entrega (Centro):* R$ 3,00
💰 *TOTAL A PAGAR:* *R$ 34,00*

━━━━━━━━━━━━━━━━━━━━
💳 *FORMA DE PAGAMENTO*
• *Método escolhido:* 💵 *Dinheiro* — *R$ 34,00*
  🪙 *Troco para:* R$ 50,00 *(Levar R$ 16,00 de troco)*

💜 _Obrigado pela preferência! Açaí Doce Sabor_
```

- **Montagem:**
  - Completo sem nada tirado: "COMPLETO (todos os acompanhamentos)", como no modelo;
  - com algo tirado: "COMPLETO" e, logo abaixo, a linha "RETIRAR (SEM)" em destaque.
- **Itens:**
  - numeração com 1️⃣ a 9️⃣ e 🔟; do 11 em diante, os dígitos em sequência (1️⃣1️⃣);
  - item sem montagem (picolé, bebida) leva só a linha do título, com o tamanho ou o sabor entre parênteses;
  - "Acompanhamentos" lista os itens sem custo, na ordem do cardápio;
  - "Cremes / Extras Pagos" traz cada item pago com o valor.
- **Entrega:**
  - Retirada: "🏪 Retirada na Loja", sem endereço, e no resumo "🏪 *Retirada na loja:* Grátis (R$ 0,00)";
  - Entrega a combinar: "🛵 *Frete / Entrega:* A combinar" e "💰 *TOTAL A PAGAR:* *R$ 31,00* + frete a combinar". Sem o "Levar troco", porque o valor final não é conhecido.
- **Pagamento:**
  - Pix: "💠 *Pix* — *R$ 34,00*", com a linha de enviar o comprovante;
  - Cartão: "💳 *Cartão de crédito*" ou "💳 *Cartão de débito*", mais "📟 _(Levar maquininha)_", só na entrega;
  - Dinheiro sem troco: "✅ *Troco:* Não precisa (valor exato)".
- **Loja fechada, pedido aceito:** a linha "⏰ *Pedido antecipado:* enviado com a loja fechada" logo abaixo da data.
- **Data e hora:** horário de Brasília, pelo relógio corrigido pelo servidor (o mesmo do selo).

## Minhas escolhas (o responsável pode trocar)

- **Ícones e bolinhas no lugar dos emojis na tela, com o mesmo texto e as mesmas cores pedidas:**
  - pílulas, botões da faixa e selo do cabeçalho;
  - é a mesma decisão do selo "ABERTO AGORA" de 2026-11-12, porque o emoji muda de aparência em cada aparelho;
  - na comanda do WhatsApp, os emojis vão exatamente como pedido.
- **Cartão na comanda:** diz se é crédito ou débito, porque o cliente já escolheu um dos dois.
- **"(Levar maquininha)":** só na entrega. Na retirada, o cliente paga no balcão.
- **"Outro bairro (taxa a combinar)":** na lista de bairros, para o cliente de fora da lista não ficar sem pedir.
- **Lista de bairros vazia:** vale como "a combinar".
- **Dados do cliente durante a visita:** nome, telefone, endereço e a escolha de entrega ficam guardados enquanto a aba estiver aberta. Quem volta ao cardápio para pegar mais um item não perde o que já digitou. Ao fechar a aba, somem.

## Perguntas ao responsável

1. **Interruptor e horário:** hoje o site já mostra aberto ou fechado sozinho, pelo horário 13h–21h.
   - **A (recomendado):** o horário continua automático, e o interruptor é para exceções.
     - "Fechar" vale até a abertura do dia seguinte. Exemplo: acabou o açaí às 18h, e amanhã às 13h a loja abre sozinha.
     - "Abrir" fora do horário vale até as 21h, se abriu mais cedo, ou até as 5h, se ficou depois das 21h; também acaba quando o vendedor fecha.
   - **B:** só o interruptor. A loja fica como o vendedor deixar até ele mudar, e o horário vira só informação.
2. **Observação do item:** o modelo cita "Observação (se houver)", mas hoje não existe esse campo.
   - **A (recomendado):** "+ Observação" em cada item do carrinho (ex.: "pouco gelo"), que vai para a comanda.
   - **B:** um campo só para o pedido todo.
   - **C:** sem observação por enquanto.

## Casos que precisam funcionar

- Cliente sem Supabase: vê o horário automático, 30–45 min e entrega a combinar, nunca uma configuração que só existe no aparelho do vendedor.
- Bairro escolhido que o vendedor excluiu depois: o carrinho pede para escolher de novo.
- Troco menor que o total com a entrega: aviso, como hoje.
- Item ou complemento que esgotou com o cliente no carrinho: marcado e envio bloqueado.
- Loja fechada com bloqueio: o botão diz por que não envia e quando abre.

## Fora deste pedido

- **Gravar o pedido no banco antes do WhatsApp** (D-039, T-117): continua o próximo passo depois do Supabase.
  - Até lá, preço, taxa e troco são calculados no aparelho do cliente.
  - A loja confere tudo na conversa.
- **Lembrar nome e endereço do cliente para o próximo pedido:** pode vir depois, se o responsável quiser.
