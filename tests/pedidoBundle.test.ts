/**
 * O arquivo da função `pedido` (supabase/functions/pedido/index.ts) é gerado do código do site. Se
 * alguém muda as regras e esquece de rodar `npm run build:pedido`, o painel do Supabase recebe uma
 * função velha. Este teste gera a função na memória (sem gravar nada) e compara com o arquivo.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { build } from 'vite'
import { describe, expect, it } from 'vitest'

const normalize = (text: string) => text.replaceAll('\r\n', '\n').trimEnd()

describe('arquivo da função pedido', () => {
  it('está em dia com o código (rode npm run build:pedido se falhar)', { timeout: 120_000 }, async () => {
    const result = await build({
      configFile: join(process.cwd(), 'vite.pedido.config.ts'),
      logLevel: 'silent',
      build: { write: false, emptyOutDir: false },
    })
    const outputs = Array.isArray(result) ? result : [result]
    const chunks = outputs.flatMap((output) => ('output' in output ? output.output : [])).filter((entry) => entry.type === 'chunk')
    expect(chunks).toHaveLength(1)
    const committed = readFileSync(join(process.cwd(), 'supabase', 'functions', 'pedido', 'index.ts'), 'utf8')
    const generated = chunks[0].type === 'chunk' ? chunks[0].code : ''
    expect(normalize(generated) === normalize(committed), 'supabase/functions/pedido/index.ts está desatualizado: rode npm run build:pedido').toBe(true)
  })

  it('a função lê o cardápio do banco e não leva as mudanças antigas de itens', () => {
    const committed = readFileSync(join(process.cwd(), 'supabase', 'functions', 'pedido', 'index.ts'), 'utf8')
    expect(committed).toContain('/rest/v1/rpc/catalogo_publico')
  })
})
