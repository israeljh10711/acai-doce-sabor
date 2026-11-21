# Cardápio dinâmico no Supabase — plano (2026-11-21)

Pedido: especificação em 3 partes ("Complete dynamic store catalog management"). Execução na ordem
Parte 1 → Parte 2 → Parte 3, com testes, build e commit ao fim de cada parte.

## Decisões

- **Fonte do cardápio:** tabelas `catalog_*` no Supabase. O cardápio do código (`menu.ts`,
  `extras.ts`, `categories.ts`, ofertas) passa a ser só a **semente** (gerada por script, `on
  conflict do nothing`: nunca sobrescreve o que o vendedor mudou) e o cardápio do **modo de
  demonstração** (sem Supabase).
- **`catalog_changes`:** continua guardando só as **Configurações da loja** (`settings/loja`). As
  mudanças antigas de itens, produtos, complementos e seções são convertidas uma vez pela migração
  (campos simples) e registradas em `catalog_import_log`; o que não dá para converter fica marcado
  como `pendente`, sem apagar nada.
- **Registros → modelo da tela:** `records.ts` converte os registros do banco no mesmo
  `CatalogData` que a tela já usa (itens, complementos, produtos, categorias, seções). Assim a tela
  muda pouco, e o servidor usa exatamente as mesmas regras de preço.
- **Tabelas:**
  - `catalog_categories` (vitrine ou grade);
  - `catalog_products` (montável, com sabores ou variações, direto);
  - `catalog_variants` (tamanhos);
  - `catalog_choices` e `catalog_choice_options` (escolhas e sabores);
  - `catalog_groups` (grupos de complementos, com mínimo, máximo, grátis, preço extra e Completo);
  - `catalog_options` (complementos);
  - `catalog_product_groups` (grupos de cada produto, ordem e máximo próprio);
  - `catalog_offers`;
  - `catalog_meta` (revisão);
  - `catalog_import_log`.
- **Segurança:**
  - RLS em todas: o público lê só o que está visível e não arquivado; só `is_seller()` escreve.
  - GRANT explícito (o projeto real não dá permissão sozinho).
  - Escrita de produto (produto, tamanhos, escolhas e grupos) por RPC em uma transação.
  - Fotos: bucket `catalogo` (só JPEG, PNG e WebP, até 2 MB; sem SVG); política de update do vendedor.
- **Tempo real:** um canal em `catalog_meta` (a revisão sobe a cada mudança) e em `catalog_changes`
  (configurações); o site busca de novo com espera curta (debounce).
- **Preço (uma regra só, no site e no servidor):** tamanho + Σ preço do complemento × quantidade +
  Σ por grupo max(0, unidades − grátis) × preço extra. As regras atuais continuam:
  - `limited`: conta no limite grátis do tamanho;
  - `included`: um de cada;
  - `paid`: por unidade, até 10.
- **Ofertas:** a oferta ativa (dentro das datas) de menor posição vale; com preço promocional, ela
  troca o preço do produto ou do tamanho, e o preço anterior aparece riscado. O servidor aplica a
  mesma regra com a hora dele.
- **Produção:** sem Supabase configurado, demonstração. Com Supabase, o site não mostra o cardápio do
  código quando a busca falha: mostra o erro e "Tentar de novo".

## Etapas

1. **Parte 1:** migração `20261121120000_catalogo_dinamico.sql` (tabelas, restrições, índices,
   RLS, GRANT, Realtime, RPCs, semente gerada, conversão registrada); `records.ts` com testes de ida
   e volta; teste da migração no PGlite; commit.
2. **Parte 2:**
   - site lendo o banco (repositório Supabase ou local);
   - tipos e regras de grupo genéricos;
   - páginas do vendedor: Catálogo, Categorias, Produtos, Complementos, Ofertas e Configurações da loja;
   - fotos;
   - commit.
3. **Parte 3:**
   - função `pedido` lendo `catalogo_publico()` e conferindo tudo (visível, disponível, grupos,
     ofertas, pagamento, bairros);
   - resposta de preço mudado;
   - teste do pacote desatualizado;
   - testes e documentação;
   - commit.
