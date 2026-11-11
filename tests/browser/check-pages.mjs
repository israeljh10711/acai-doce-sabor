// Confere cada página do site em larguras reais de tela e fotografa todas.
//
// Para cada página e largura, verifica: título principal, título da aba, idioma,
// ausência de rolagem horizontal, links e botões com pelo menos 44 px de altura,
// imagens e fontes carregadas e console sem erros nem avisos.
//
// Uso (com o site rodando, por exemplo em `npm run dev`):
//   node tests/browser/check-pages.mjs [endereçoBase] [pastaDeSaída]
import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openBrowser } from './lib.mjs'

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:5173'
const outDir = process.argv[3] ?? join(tmpdir(), 'acai-doce-sabor-conferencia', 'paginas')

const STORE = 'Açaí Doce Sabor'

const viewports = [
  { width: 320, height: 640 },
  { width: 360, height: 740 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
]

// Ao mudar o título de uma página, atualize aqui também.
const routes = [
  { name: 'inicio', path: '/', h1: 'Açaí montado do seu jeito.', title: STORE },
  { name: 'monte-seu-pedido', path: '/monte-seu-pedido', h1: 'Monte seu Pedido' },
  { name: 'acai-oca', path: '/monte-seu-pedido/acai-oca', h1: 'Açaí Oca' },
  { name: 'acai-tradicional', path: '/monte-seu-pedido/acai-tradicional', h1: 'Açaí Tradicional' },
  { name: 'milk-shake', path: '/monte-seu-pedido/milk-shake', h1: 'Milk-shake' },
  { name: 'categoria-inexistente', path: '/monte-seu-pedido/pizza', h1: 'Página não encontrada' },
  { name: 'endereco-inexistente', path: '/nao-existe', h1: 'Página não encontrada' },
]

const fonts = ['Fraunces Variable', 'Figtree Variable']

// Roda dentro da página.
const inspect = `JSON.stringify({
  title: document.title,
  titleElements: document.querySelectorAll('title').length,
  h1: document.querySelector('h1')?.textContent ?? null,
  lang: document.documentElement.lang,
  scrollWidth: document.documentElement.scrollWidth,
  clientWidth: document.documentElement.clientWidth,
  smallTargets: [...document.querySelectorAll('a, button')]
    .map((el) => ({ el, box: el.getBoundingClientRect() }))
    // links dentro de texto corrido (display inline) não entram na regra dos 44 px
    .filter(({ el, box }) => getComputedStyle(el).display !== 'inline' && box.width > 1 && box.height > 1 && box.height < 44)
    .map(({ el, box }) => el.textContent.trim().slice(0, 30) + ' (' + Math.round(box.height) + 'px)'),
  brokenImages: [...document.images]
    .filter((img) => !img.complete || img.naturalWidth === 0)
    .map((img) => img.currentSrc || img.src),
  fonts: [...document.fonts]
    .filter((face) => face.status === 'loaded')
    .map((face) => face.family)
    .filter((family, index, all) => all.indexOf(family) === index),
})`

const browser = await openBrowser(join(outDir, 'edge-profile'), 9333)
let failed = 0
let checked = 0

try {
  for (const viewport of viewports) {
    for (const route of routes) {
      const expectedTitle = route.title ?? `${route.h1} | ${STORE}`
      await browser.goto(baseUrl + route.path, viewport)
      const info = JSON.parse(await browser.evaluate(inspect))
      const consoleProblems = browser.consoleProblems()

      const failures = []
      if (info.h1 !== route.h1) failures.push(`h1 "${info.h1}" (esperado "${route.h1}")`)
      if (info.title !== expectedTitle)
        failures.push(`título "${info.title}" (esperado "${expectedTitle}")`)
      if (info.titleElements !== 1) failures.push(`${info.titleElements} elementos <title>`)
      if (info.lang !== 'pt-BR') failures.push(`lang "${info.lang}"`)
      if (info.scrollWidth > info.clientWidth)
        failures.push(`rolagem horizontal: conteúdo ${info.scrollWidth}px em tela de ${info.clientWidth}px`)
      if (info.smallTargets.length)
        failures.push(`alvos de toque menores que 44px: ${info.smallTargets.join(', ')}`)
      if (info.brokenImages.length)
        failures.push(`imagens que não carregaram: ${info.brokenImages.join(', ')}`)
      for (const family of fonts)
        if (!info.fonts.includes(family)) failures.push(`fonte não carregada: ${family}`)
      if (consoleProblems.length) failures.push(`console: ${consoleProblems.join(' | ')}`)

      checked++
      if (failures.length) failed++
      console.log(
        `${viewport.width}px ${route.path} -> ${failures.length ? 'FALHOU: ' + failures.join('; ') : 'ok'}`,
      )

      writeFileSync(join(outDir, `${route.name}-${viewport.width}.png`), await browser.screenshot())
    }
  }
} catch (error) {
  console.error('ERRO NA CONFERÊNCIA:', error)
  failed++
} finally {
  browser.close()
}

console.log(`Fotos em: ${outDir}`)
console.log(
  failed === 0
    ? `RESULTADO: as ${checked} conferências passaram`
    : `RESULTADO: ${failed} de ${checked} conferências falharam`,
)
process.exit(failed === 0 ? 0 : 1)
