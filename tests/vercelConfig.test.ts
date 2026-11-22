import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { routePatterns } from '../src/paths.ts'

/**
 * `vercel.json` (2026-11-22): sem ele, a Vercel só conhecia `/` e qualquer outro endereço aberto
 * direto ou recarregado dava "404 NOT_FOUND" (o link de acompanhamento do cliente, `/vendedor`,
 * `/pedidos`...). Na Vercel, os arquivos publicados (`dist/`) são servidos antes das regras de
 * `rewrites`; o que não é arquivo vai para o `index.html` e o React Router decide a página. Só
 * `/assets/` fica de fora: um pedaço antigo do site, pedido por uma aba aberta antes de uma
 * publicação, recebe 404 de verdade, e não o HTML no lugar de um JavaScript.
 */
type Header = { key: string; value: string }
type Config = {
  rewrites: { source: string; destination: string }[]
  headers: { source: string; headers: Header[] }[]
}
const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')) as Config

/** A regra da Vercel ("/(expressão)") como expressão regular do caminho inteiro. */
function sourceToRegExp(source: string): RegExp {
  expect(source).toMatch(/^\/\(.*\)$/)
  return new RegExp(`^/${source.slice(1)}$`)
}

/** Cada rota do site, com um exemplo no lugar de cada parâmetro. */
const SAMPLE: Record<string, string> = { ':categoria': 'acai-oca', ':codigo': 'ADS-0001' }
const appRoutes = Object.values(routePatterns).map((pattern) => pattern.replace(/:[a-z]+/g, (param) => SAMPLE[param] ?? 'x'))

describe('vercel.json: endereços do site abertos direto', () => {
  const [rewrite] = config.rewrites
  const matches = (path: string) => sourceToRegExp(rewrite.source).test(path)

  it('uma regra só, que entrega o index.html', () => {
    expect(config.rewrites).toHaveLength(1)
    expect(rewrite.destination).toBe('/index.html')
  })

  it('toda rota do site vai para o index.html (o React Router abre a página certa)', () => {
    expect(appRoutes).toEqual(expect.arrayContaining(['/vendedor', '/pedidos', '/acompanhar/ADS-0001', '/carrinho', '/monte-seu-pedido/acai-oca']))
    for (const path of [...appRoutes, '/vendedor/', '/acompanhar/DEMO-AB12CD']) expect(matches(path), path).toBe(true)
  })

  it('/assets/ fica de fora: arquivo que não existe mais recebe 404, não HTML', () => {
    for (const path of ['/assets/index-M6TQZpMM.js', '/assets/ConfiguratorPage-CTMmJren.js', '/assets/index-BW2rrQux.css']) expect(matches(path), path).toBe(false)
  })
})

describe('vercel.json: cabeçalhos de segurança', () => {
  const rule = config.headers.find((entry) => sourceToRegExp(entry.source).test('/'))
  const value = (key: string) => rule?.headers.find((header) => header.key === key)?.value

  it('valem para todo endereço (páginas e arquivos)', () => {
    expect(rule).toBeDefined()
    for (const path of ['/', '/vendedor', '/acompanhar/ADS-0001', '/assets/index-M6TQZpMM.js', '/favicon-32.png']) {
      expect(sourceToRegExp(rule!.source).test(path), path).toBe(true)
    }
  })

  it('nosniff, sem moldura e referência só com a origem para outros sites', () => {
    expect(value('X-Content-Type-Options')).toBe('nosniff')
    expect(value('X-Frame-Options')).toBe('DENY')
    // Não "no-referrer": o Nominatim (endereço pelo GPS) pede que o site se identifique.
    expect(value('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
  })
})
