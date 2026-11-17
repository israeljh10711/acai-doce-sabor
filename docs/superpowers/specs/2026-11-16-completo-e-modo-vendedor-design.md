# Botão "Completo" e modo vendedor com Supabase

Pedidos de 2026-11-16, em três mensagens:
- "Botão Completo (selecionar tudo) e edição livre pós-seleção";
- "Regra real do Completo + modo vendedor";
- "Pode começar": confirma as regras do Completo e escolhe a opção B do modo vendedor (Supabase, para todos).

## Por quê

- **Completo:** na loja, o cliente pede "completo" e paga o preço do tamanho; depois diz o que não quer ("sem farinha láctea"). O site precisa fazer o mesmo e deixar claro para a equipe de montagem o que ficou de fora.
- **Modo vendedor:** o dono ou o vendedor precisa trocar preço, foto e disponibilidade, e cadastrar produtos e complementos pelo próprio celular, sem programador, com a mudança chegando a todos os clientes.

## Parte 1: Completo (regras aprovadas)

- **Onde:** no personalizador da Barca de Açaí, do Pote de Açaí 1 Litro Montado, do Açaí Oca e do Açaí Tradicional, em todos os tamanhos. Não aparece no Açaí Batido nem no Milk-shake.
- **O que marca:** 1 de cada adicional (13), fruta (3) e calda ou creme (8, incluindo os cremes de ninho e de avelã).
  - Fica de fora o que estiver esgotado.
  - Na Barca, que não tem caldas, marca os adicionais e as 3 frutas; a cobertura continua sendo escolha do cliente.
- **Itens pagos:** cereja e Kit Kat ficam fora do Completo e continuam cobrados se o cliente marcar.
- **Preço:** o do tamanho. Não há cobrança extra, nem pela cota, nem pela 3ª fruta da Barca, nem pelos cremes, e não há aviso de "tire X".
- **Edição:** no Completo, cada item vai no máximo 1 vez. O cliente desmarca o que quiser com 1 toque, e o preço não muda.
- **Saída do Completo:** "Limpar" tira os adicionais, frutas, caldas e itens pagos e volta à cota normal; tamanho e cobertura continuam escolhidos. O modo também acaba se o cliente tirar tudo o que o Completo marcou.
- **Fora do Completo:** valem as regras de sempre (cota grátis, 2 frutas na Barca, cremes a R$ 3,00).
- **Textos:**
  - barra no topo das escolhas: "Quer rechear tudo de uma vez?";
  - subtítulo antes do Completo: "Toque em Completo para marcar tudo e depois tire o que não quiser.";
  - aviso depois do Completo: "Modo Completo ativado! Se não quiser algum item (ex.: Farinha Láctea), basta tocar nele ou no botão - para tirar.";
  - botões: "Completo", "Completo aplicado" (tudo marcado), "Marcar tudo novamente" (depois de tirar algo) e "Limpar" (quando há algo marcado).
- **Resumo, confirmação, carrinho e WhatsApp:**
  - a linha "Montagem: COMPLETO (todos os acompanhamentos)" ou "Montagem: COMPLETO (SEM: Farinha láctea, Granola)" vem antes da lista do que ficou;
  - o resumo fixo mostra "N itens selecionados".
- **Carrinho:** guarda a marca do Completo, e a revalidação do carrinho refaz a montagem com as regras do Completo.

## Parte 2: modo vendedor (opção B: Supabase, para todos)

### Como funciona

- **Base e mudanças:** o cardápio do código continua sendo a base. As mudanças do vendedor são uma camada por cima, uma por item:
  - produto do catálogo;
  - um dos 4 produtos principais, com os preços dos tamanhos;
  - complemento.
- **Item novo:** recebe um id gerado. "Excluir" marca o item como excluído, e "Restaurar original" apaga a mudança.
- **Onde ficam as mudanças:**
  - **Supabase**, quando o `.env.local` tem `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` e `VITE_SELLER_EMAIL`:
    - a tabela `catalog_changes` guarda tipo, id, dados (jsonb) e data;
    - o bucket público `catalogo` guarda as fotos;
    - a tabela `sellers` guarda quem pode alterar;
    - todos leem; só quem está em `sellers` escreve (RLS);
    - o cadastro de usuários novos fica desligado;
    - o script `supabase/setup.sql` cria tudo.
  - **Neste aparelho, enquanto as chaves não chegam:** localStorage `acai_doce_sabor_seller_catalog_v1` e IndexedDB `acai_doce_sabor_seller_images`. A barra do vendedor avisa: "Salvo só neste aparelho: os clientes ainda não veem".
- **Para os clientes:**
  - o site lê as mudanças com um `fetch` simples (API REST do Supabase) ao abrir, ao voltar para a aba e a cada 60 s com a página aberta;
  - a última leitura fica guardada e é aplicada na hora na próxima visita.
- **Para o vendedor:** login, gravação e envio de fotos pela mesma API REST, sem pacote novo:
  - login com e-mail e senha do Supabase Auth; o e-mail vem do `.env.local` e a tela pede só a senha;
  - o token é renovado quando vence.
  - Tudo do vendedor (tela, formulários, gravação) carrega só quando é usado.
- **Senha:**
  - sem Supabase, a senha inicial do pedido fica guardada como hash no aparelho e pode ser trocada;
  - com Supabase, vale a senha da conta do vendedor, que precisa ter 6 caracteres ou mais (exigência do Supabase).
  - A senha nunca vai para o Obsidian nem para a documentação.

### O que o vendedor pode fazer

- **Produtos das 5 seções e da faixa de destaques, inclusive os novos:**
  - foto, nome, preço e preço antigo riscado;
  - descrição e sabores (lista separada por vírgula; edita o primeiro grupo de sabor);
  - disponível ou esgotado, seção, excluir e restaurar o original.
  - No Pote 1 L e na Barca, o preço do item também é o preço do personalizador.
- **Os 4 produtos principais:** foto, nome, descrição e o preço de cada tamanho. Criar um produto montável novo fica fora, porque precisaria de tamanhos e cotas.
- **Complementos (adicionais, frutas, caldas e cremes, adicionais pagos):**
  - foto, nome e preço (0 = sem custo, seguindo a regra do grupo);
  - disponível ou esgotado, excluir e restaurar;
  - "+ Adicionar complemento" em cada grupo.
- **"+ Adicionar produto":** no cabeçalho de cada uma das 5 seções.
- **Formulário:**
  - foto da galeria ou da câmera (`<input type="file" accept="image/*">`), reduzida no aparelho a até 800 px, em WebP com qualidade 0,82 (JPEG quando o navegador não gera WebP);
  - nome, preço, preço antigo, descrição, seção, sabores e disponível ou esgotado;
  - excluir (com confirmação) e restaurar original.
- **Esgotado:**
  - o cartão mostra "Esgotado" e o botão de compra fica desligado;
  - no personalizador o complemento fica desligado;
  - o Completo pula o item;
  - o carrinho tira o item esgotado ou excluído ao revalidar, como já faz com os inválidos.
- **Acesso:**
  - "Senha para vendedor" no rodapé da barra lateral (computador) e do menu Categorias (celular);
  - com o modo ativo, aparecem "Modo Vendedor Ativo" e "Sair".
- **Barra do vendedor (topo de todas as páginas):**
  - "Modo Vendedor Ativo: toque em Editar em qualquer item ou + Adicionar em qualquer categoria";
  - o aviso de onde as mudanças estão salvas;
  - "Alterar senha", "Backup / Restaurar" e "Sair do Modo Vendedor".
- **Backup:** baixa um `.json` com as mudanças (as fotos do aparelho vão junto); "Restaurar" grava um backup de volta.

## Abordagens consideradas

- **Banco de dados para os clientes:**
  1. **Supabase (escolhida pelo responsável).** Mudança para todos, login de verdade e fotos na nuvem. A conta é gratuita, criada pelo responsável.
  2. Arquivo de backup aplicado no site por um programador: sem servidor, mas sem tempo real.
  3. Só no aparelho: não chega aos clientes.
- **Ligação com o Supabase:**
  1. **API REST com `fetch` (escolhida).** Nenhum pacote novo, e o cliente não baixa nada a mais.
  2. Pacote `@supabase/supabase-js`: mais pronto, porém maior. A regra do projeto pede para não instalar dependências desnecessárias.
- **Atualização para quem está com a página aberta:**
  1. **Ler de novo ao voltar para a aba e a cada 60 s (escolhida):** simples, sem conexão permanente.
  2. Realtime por websocket: imediato, mas mais complexo e com limite de conexões no plano gratuito.

## Fora do escopo

- Gravar o pedido no banco antes do WhatsApp (D-039). Com o Supabase ligado, volta a ser o próximo passo.
- Criar produto montável novo.
- Perfis separados de vendedor e dono.
- Tema claro e escuro.

## Testes

- **Unitários:**
  - regras do Completo (marcar, preço, desmarcar, Limpar, troca de tamanho, esgotados);
  - carrinho e mensagem com "COMPLETO (SEM: …)";
  - camada de mudanças (editar, criar, excluir, restaurar, esgotado);
  - senha local;
  - cliente REST do Supabase com `fetch` simulado. Ele não é testado contra um projeto de verdade até as chaves chegarem.
- **No navegador:**
  - Completo na Barca, no Pote 1 L e no Oca, tirando a Farinha láctea, até o carrinho e o WhatsApp;
  - Limpar;
  - senha errada e certa;
  - cadastro de "Picolé trufado" com foto, R$ 3,00 e descrição;
  - complemento novo que entra no Completo;
  - preço editado chegando ao carrinho e ao WhatsApp;
  - esgotado e backup.

## Decisões tomadas na execução

- **Ordem do Completo:** `applyComplete` põe primeiro os itens pagos já escolhidos e depois os do Completo. A mensagem segue a ordem do cardápio, então a ordem guardada não muda nada.
- **Subtítulo da barra com o Completo ligado:** "Pelo preço do tamanho, sem custo extra." O aviso pedido vem logo abaixo, sem repetir o texto.
- **Tipo `Category`:** deixou de ser `as const`, porque nome e descrição passaram a ser editáveis. Os slugs e os selos continuam literais.
- **Ofertas:** o sorteio usa a lista base de ids, e o texto é refeito com o cardápio atual. A oferta de item excluído ou esgotado não aparece.
- **Senha:**
  - local, com no mínimo 4 caracteres (a inicial do pedido tem 4);
  - no Supabase, no mínimo 6 caracteres.
- **"+ Adicionar produto":** só nas 5 seções. Nos 4 produtos montáveis há só "Editar".
- **Nome da chave:** aceita `VITE_SUPABASE_ANON_KEY` (o pedido) ou `VITE_SUPABASE_PUBLISHABLE_KEY` (o `.env.example` da Fase 0).
- **SQL:** fica em `supabase/migrations/`, pasta que já existia.
- **Login do Supabase:** confere também a tabela `sellers`. Uma conta que não é de vendedor não entra, mesmo com a senha certa.
- **Restaurar backup no Supabase:** sobe as fotos do aparelho e deixa o banco igual ao backup.

## Ajuste pedido em 2026-11-16 (manhã): "Completo sem caldas e cremes; senha vendedor2026; tamanhos e nomes de categoria"

- **Completo, nova regra:** marca só os adicionais e as frutas sem custo (preço 0 e disponíveis). Caldas, cremes e itens pagos ficam de fora.
  - O pedido cita "Leite Condensado" entre as caldas: o adicional leite condensado também fica fora do Completo.
  - Calda, creme ou item pago marcado pelo cliente soma o preço dele também no Completo. Exemplo: tamanho de R$ 15,00 + Completo + creme de avelã + creme de ninho = R$ 21,00.
- **Montagem no carrinho e no WhatsApp:**
  - "Montagem: COMPLETO" ou "COMPLETO (SEM: …)", depois a lista do que está incluído;
  - em seguida, "Extras / Cremes e Caldas pagos: …" com o valor de cada item pago.
- **Senha:** a senha inicial do modo vendedor passa a ser a nova do pedido. Uma senha antiga guardada no aparelho é trocada pela nova.
- **Tamanhos em qualquer produto (seção "Tamanhos e Preços (Opcional)"):**
  - itens das seções: cada linha tem nome e preço, com "+ Adicionar tamanho" e a lixeira; viram a escolha "Tamanho" com preço por opção. O cartão mostra "a partir de"; sem tamanhos, vale o preço único;
  - os 4 produtos: nome, preço e (nos açaís) adicionais grátis. O recipiente vem do nome ("Copo…", "Isopor…", "Barca…") ou, sem ele, do recipiente dos tamanhos que já existem;
  - Pote 1 L e Barca continuam com um tamanho só (o preço do item).
- **Renomear categorias:** "Renomear" ao lado do título das 5 seções e do grupo "Monte do seu jeito", com nome e subtítulo. O novo nome aparece no título, na barra lateral, nos botões do celular e no menu. Gravado como mudança do tipo `sections` (aparelho ou Supabase).
