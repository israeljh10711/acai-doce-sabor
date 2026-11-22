# Açaí Doce Sabor — instruções do projeto

## Mapa de contexto (ler antes do código)

`C:\Users\johra\OneDrive\Documentos\segundo cerebro\Açaí Doce Sabor\MAPA-CONTEXTO.md`

Antes de usar Read, Glob, Grep ou listar pastas, leia este mapa (skill `obsidian-context-map`) e vá direto aos arquivos que ele aponta. Ao terminar uma mudança relevante (rota, arquivo-chave, etapa, decisão, regra crítica), atualize só a seção afetada do mapa.

## Protocolo de Seleção Prévia de Skills (obrigatório)

Antes de iniciar qualquer tarefa ou etapa neste projeto:

0. Skills de base, consideradas em toda tarefa: `obsidian-context-map`, `caveman` (chat curto; documentos e notas em texto normal) e `codebase-memory` (quando o MCP estiver conectado; hoje não está instalado).
1. Consulte as skills instaladas (`.claude/skills/` deste projeto, `~/.claude/skills/` e as skills de plugins disponíveis na sessão). Se nenhuma servir, procure uma com `find-skills`.
2. Declare no início da resposta, numa linha:
   `🎯 Skills ativadas para esta tarefa: [nomes das skills] — Motivo: ...`
3. Leia o `SKILL.md` completo de cada skill ativada antes de planejar ou editar arquivos, e aplique as regras dela na prática.
4. A skill `acai-doce-sabor` (regras do negócio: botão Completo, Modo Vendedor, comanda, loja fechada, layout) vale em toda tarefa deste projeto.
5. Se uma regra de skill conflitar com um pedido direto do responsável, vale o pedido: diga qual regra ficou de fora e por quê.

## Regras de segurança do projeto

- Todo texto que o cliente ou o vendedor vê fica em português do Brasil.
- O site da porta 5173 usa o `.env.local`, ou seja, o **Supabase de verdade**. As conferências antigas do navegador (`tests/browser/check-*.mjs`) gravam e rodam só num site de demonstração, sem o Supabase (as variáveis `VITE_SUPABASE_*` vazias). O `tests/browser/lib.mjs` para a conferência se o site falar com um `*.supabase.co`: não tire essa trava.
- Testes que gravam no Supabase rodam só no projeto de teste separado (`tests/e2e-supabase`, que se recusa a rodar com o endereço do projeto real).
- Enviar para `main` publica na Vercel. Trabalho em andamento vai para um ramo separado (prévia da Vercel) até o responsável aprovar.
- Antes de concluir: `npm test`, `npm run lint`, `npm run build` e, se mexer na função de pedido, `npm run build:pedido`.
