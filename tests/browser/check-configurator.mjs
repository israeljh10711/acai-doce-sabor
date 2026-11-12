// Usa o personalizador como um cliente: escolhe tamanho, adiciona e tira ingredientes,
// troca de tamanho e confere o que a tela mostra, a prévia e o total.
//
// Uso (com o site rodando, por exemplo em `npm run dev`):
//   node tests/browser/check-configurator.mjs [endereçoBase] [pastaDeSaída]
import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openBrowser, sleep } from './lib.mjs'

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:5173'
const outDir = process.argv[3] ?? join(tmpdir(), 'acai-doce-sabor-conferencia', 'personalizador')

const viewports = [
  { width: 390, height: 844 },
  { width: 1280, height: 800 },
]

const browser = await openBrowser(join(outDir, 'edge-profile'), 9337)
const failures = []
let checks = 0

// Funções que rodam dentro da página.
const helpers = `
  window.__q = (selector) => document.querySelector(selector);
  window.__button = (label) => [...document.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent.trim()) === label);
  window.__radio = (value) => document.querySelector('input[type=radio][value="' + value + '"]');
  window.__toppings = () => [...document.querySelectorAll('[aria-label="Prévia do pedido"] svg [data-topping]')].map((g) => g.dataset.topping + ':' + g.dataset.quantity).sort();
  window.__text = () => document.body.innerText;
  window.__live = () => document.querySelector('[aria-live="polite"]').textContent;
  true;
`

async function page(path, viewport) {
  await browser.goto(baseUrl + path, viewport)
  await browser.evaluate(helpers)
}

const click = async (expression) => {
  const ok = await browser.evaluate(`(() => { const el = ${expression}; if (!el) return false; el.click(); return true })()`)
  if (!ok) throw new Error(`Elemento não encontrado: ${expression}`)
  await sleep(450)
}

function check(label, actual, expected) {
  checks++
  const pass = JSON.stringify(actual) === JSON.stringify(expected)
  if (!pass) failures.push(`${label}: obtido ${JSON.stringify(actual)}, esperado ${JSON.stringify(expected)}`)
  return pass
}

try {
  for (const viewport of viewports) {
    const at = `${viewport.width}px`

    // --- Açaí Tradicional ---
    await page('/monte-seu-pedido/acai-tradicional', viewport)
    check(`${at} antes do tamanho, "Adicionar Granola" desabilitado`, await browser.evaluate(`__button('Adicionar Granola').disabled`), true)
    check(`${at} antes do tamanho, Banana desabilitada`, await browser.evaluate(`__button('Banana').disabled`), true)
    check(`${at} prévia vazia antes do tamanho`, await browser.evaluate(`!!__q('[aria-label="Prévia do pedido"] svg[data-empty]')`), true)

    await click(`__radio('copo-500')`)
    for (let i = 0; i < 3; i++) await click(`__button('Adicionar Granola')`)
    check(`${at} 3 de 3 grátis`, await browser.evaluate(`__text().includes('3 de 3 grátis · limite atingido')`), true)
    check(`${at} com o limite cheio, "Adicionar Paçoca" desabilitado`, await browser.evaluate(`__button('Adicionar Paçoca').disabled`), true)
    check(`${at} com o limite cheio, "Adicionar Kit Kat" habilitado`, await browser.evaluate(`__button('Adicionar Kit Kat').disabled`), false)

    await click(`__button('Adicionar Kit Kat')`)
    await click(`__button('Adicionar Kit Kat')`)
    await click(`__button('Banana')`)
    check(`${at} Banana marcada`, await browser.evaluate(`__button('Banana').getAttribute('aria-pressed')`), 'true')
    check(`${at} total R$ 20,00`, await browser.evaluate(`__q('#resumo').innerText.includes('R$ 20,00')`), true)
    check(`${at} prévia só com o escolhido`, await browser.evaluate(`__toppings()`), ['banana:1', 'granola:3', 'kit-kat:2'])
    writeFileSync(join(outDir, `tradicional-montado-${viewport.width}.png`), await browser.screenshot())

    await click(`__radio('pote-200')`)
    check(`${at} troca para Pote 200 ml tira 1 Granola`, await browser.evaluate(`__toppings()`), ['banana:1', 'granola:2', 'kit-kat:2'])
    check(`${at} aviso visível da saída`, await browser.evaluate(`__text().includes('Saíram por passar do novo limite: 1 Granola.')`), true)
    check(`${at} anúncio da saída`, await browser.evaluate(`__live()`), 'Tamanho: Pote 200 ml, R$ 7,00. Saíram por passar do novo limite: 1 Granola.')
    check(`${at} total R$ 15,00 no pote`, await browser.evaluate(`__q('#resumo').innerText.includes('R$ 15,00')`), true)

    await click(`__button('Tirar Kit Kat')`)
    check(`${at} tirar 1 Kit Kat: total R$ 11,00`, await browser.evaluate(`__q('#resumo').innerText.includes('R$ 11,00')`), true)
    await click(`__button('Banana')`)
    check(`${at} Banana desmarcada some da prévia`, await browser.evaluate(`__toppings()`), ['granola:2', 'kit-kat:1'])

    // --- Açaí Oca ---
    await page('/monte-seu-pedido/acai-oca', viewport)
    check(`${at} Oca não tem 150 ml`, await browser.evaluate(`__radio('pote-150') === null`), true)
    await click(`__radio('copo-500')`)
    for (const id of ['Granola', 'Leite em pó']) await click(`__button('Adicionar ${id}')`)
    await click(`__button('Morango')`)
    await click(`__button('Adicionar Kit Kat')`)
    check(`${at} Oca copo 500 + Kit Kat: R$ 24,00`, await browser.evaluate(`__q('#resumo').innerText.includes('R$ 24,00')`), true)

    // --- Milk-shake ---
    await page('/monte-seu-pedido/milk-shake', viewport)
    check(`${at} aviso de sabores`, await browser.evaluate(`__text().includes('Favor verificar com a nossa atendente a disponibilidade de sabores.')`), true)
    check(`${at} sem adicionais grátis nem frutas`, await browser.evaluate(`!__button('Adicionar Granola') && !__button('Banana')`), true)
    check(`${at} coberturas com nome próprio`, await browser.evaluate(`!!__button('cobertura de Morango') && !__button('Morango')`), true)
    await click(`__radio('500-ml')`)
    check(`${at} sem sabor, o resumo pede o sabor`, await browser.evaluate(`__q('#resumo').innerText.includes('Falta escolher o sabor.')`), true)
    await click(`__radio('morango')`)
    check(`${at} milk-shake 500 ml de morango: R$ 12,00`, await browser.evaluate(`__q('#resumo').innerText.includes('R$ 12,00')`), true)
    check(`${at} prévia com a cor do sabor`, await browser.evaluate(`!!__q('[aria-label="Prévia do pedido"] svg[data-size="500-ml"]')`), true)
    await click(`__button('Adicionar Creme de avelã')`)
    check(`${at} milk-shake com creme de avelã: R$ 15,00`, await browser.evaluate(`__q('#resumo').innerText.includes('R$ 15,00')`), true)
    writeFileSync(join(outDir, `milk-shake-${viewport.width}.png`), await browser.screenshot())

    const problems = browser.consoleProblems()
    check(`${at} console sem erros`, problems, [])
  }

  // Com "reduzir movimento" ligado, tudo continua funcionando e aparecendo.
  await browser.goto(baseUrl + '/monte-seu-pedido/acai-tradicional', { width: 390, height: 844, reducedMotion: true })
  await browser.evaluate(helpers)
  await click(`__radio('isopor-m')`)
  await click(`__button('Adicionar Paçoca')`)
  await click(`__button('Kiwi')`)
  check('movimento reduzido: prévia mostra o escolhido', await browser.evaluate(`__toppings()`), ['kiwi:1', 'pacoca:1'])
  check('movimento reduzido: total R$ 15,00', await browser.evaluate(`__q('#resumo').innerText.includes('R$ 15,00')`), true)
} catch (error) {
  failures.push(`ERRO: ${error.message}`)
} finally {
  browser.close()
}

for (const failure of failures) console.log('FALHOU:', failure)
console.log(`Fotos em: ${outDir}`)
console.log(
  failures.length === 0
    ? `RESULTADO: as ${checks} conferências passaram`
    : `RESULTADO: ${failures.length} falha(s) em ${checks} conferências`,
)
process.exit(failures.length === 0 ? 0 : 1)
