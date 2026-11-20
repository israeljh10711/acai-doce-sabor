import { defineConfig } from 'vite'

/**
 * Empacota a função `pedido` do Supabase num arquivo só (`supabase/functions/pedido/index.ts`), para
 * colar no editor de funções do painel (pedido de 2026-11-17). O arquivo leva o cardápio do código
 * e as regras do site: rode `npm run build:pedido` (e cole de novo) sempre que o cardápio do código
 * mudar. As mudanças do modo vendedor não precisam disso: a função lê do banco a cada pedido.
 */
const BANNER = [
  '// @ts-nocheck',
  '// Função "pedido" do Açaí Doce Sabor (Supabase Edge Function).',
  '// ARQUIVO GERADO por `npm run build:pedido` a partir de src/server/pedidoFunction.ts: não edite aqui.',
  '// Cole este arquivo inteiro no editor da função "pedido" (veja docs/supabase.md).',
].join('\n')

export default defineConfig({
  publicDir: false,
  build: {
    outDir: 'supabase/functions/pedido',
    emptyOutDir: true,
    target: 'es2022',
    minify: false,
    sourcemap: false,
    reportCompressedSize: false,
    lib: {
      entry: 'src/server/pedidoFunction.ts',
      formats: ['es'],
      fileName: () => 'index.ts',
    },
    rolldownOptions: {
      output: { banner: BANNER },
    },
  },
})
