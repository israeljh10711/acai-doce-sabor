import { defineConfig } from 'vite'

/**
 * Empacota a função `pedido` do Supabase num arquivo só (`supabase/functions/pedido/index.ts`), para
 * colar no editor de funções do painel (pedido de 2026-11-17). Desde o cardápio dinâmico
 * (2026-11-21), a função lê o cardápio do banco a cada pedido (catalogo_publico): o arquivo leva só
 * as regras do site. Rode `npm run build:pedido` (e cole de novo) quando as regras mudarem; o teste
 * tests/pedidoBundle.test.ts avisa quando o arquivo ficou para trás.
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
