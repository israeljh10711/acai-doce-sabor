// Usa o personalizador como um cliente: escolhe tamanho, adiciona e tira ingredientes,
// troca de tamanho e confere a tela, a cena 3D e o total.
//
// A cena 3D é lida de verdade: em desenvolvimento ela fica em `window.__adsScenes`.
// Por isso esta conferência roda contra o site em desenvolvimento (`npm run dev`).
//
// Uso: node tests/browser/check-configurator.mjs [endereçoBase] [pastaDeSaída]
import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openBrowser, sleep } from './lib.mjs'

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:5173'
const outDir = process.argv[3] ?? join(tmpdir(), 'acai-doce-sabor-conferencia', 'personalizador')

const failures = []
let checks = 0

// Funções que rodam dentro da página.
const helpers = `
  window.__q = (selector) => document.querySelector(selector);
  window.__button = (label) => [...document.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent.trim()) === label);
  window.__radio = (value) => document.querySelector('input[type=radio][value="' + value + '"]');
  window.__text = () => document.body.innerText;
  window.__live = () => document.querySelector('[aria-live="polite"]').textContent;
  window.__mode = (root = '[aria-label="Prévia do pedido"]') => document.querySelector(root + ' [data-preview]')?.dataset.preview;
  window.__scene = (root = '[aria-label="Prévia do pedido"]') => {
    const id = document.querySelector(root + ' [data-scene-id]')?.dataset.sceneId;
    return id ? window.__adsScenes?.[id] : undefined;
  };
  window.__names = (prefix, root) => {
    const names = [];
    window.__scene(root)?.traverse((o) => { if (o.name.startsWith(prefix)) names.push(o.name.slice(prefix.length)) });
    return names.sort();
  };
  window.__toppings = (root) => window.__names('topping:', root);
  window.__pieces = (id, root) => {
    let count = -1;
    window.__scene(root)?.traverse((o) => { if (o.name === 'topping:' + id) count = o.children.length });
    return count;
  };
  window.__toppings2d = () => [...document.querySelectorAll('[aria-label="Prévia do pedido"] svg [data-topping]')].map((g) => g.dataset.topping).sort();
  true;
`

function check(label, actual, expected) {
  checks++
  const pass = JSON.stringify(actual) === JSON.stringify(expected)
  if (!pass) failures.push(`${label}: obtido ${JSON.stringify(actual)}, esperado ${JSON.stringify(expected)}`)
  return pass
}

/** Repete a leitura até bater com o esperado (a cena carrega modelos), por até ~8 s. */
async function eventually(browser, label, expression, expected) {
  let actual
  for (let attempt = 0; attempt < 40; attempt++) {
    actual = await browser.evaluate(expression)
    if (JSON.stringify(actual) === JSON.stringify(expected)) break
    await sleep(200)
  }
  return check(label, actual, expected)
}

async function session(name, port, extraArgs, run) {
  const browser = await openBrowser(join(outDir, `edge-profile-${name}`), port, extraArgs)
  const page = async (path, viewport) => {
    await browser.goto(baseUrl + path, viewport)
    await browser.evaluate(helpers)
  }
  const click = async (expression) => {
    await browser.evaluate(helpers)
    const ok = await browser.evaluate(`(() => { const el = ${expression}; if (!el) return false; el.click(); return true })()`)
    if (!ok) throw new Error(`Elemento não encontrado: ${expression}`)
    await sleep(350)
  }
  try {
    await run({ browser, page, click })
  } catch (error) {
    failures.push(`ERRO (${name}): ${error.message}`)
  } finally {
    browser.close()
  }
}

await session('principal', 9337, [], async ({ browser, page, click }) => {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
    const at = `${viewport.width}px`
    const desktop = viewport.width >= 1024

    // --- Açaí Tradicional ---
    await page('/monte-seu-pedido/acai-tradicional', viewport)
    await eventually(browser, `${at} a prévia passa a ser 3D`, `__mode()`, '3d')
    check(`${at} antes do tamanho, "Adicionar Granola" desabilitado`, await browser.evaluate(`__button('Adicionar Granola').disabled`), true)
    check(`${at} antes do tamanho, Banana desabilitada`, await browser.evaluate(`__button('Banana').disabled`), true)
    await eventually(browser, `${at} 3D antes do tamanho: só o recipiente, vazio`, `__names('container:').concat(__names('base:'))`, ['container-pote-150'])
    check(`${at} dica de girar só no computador`, await browser.evaluate(`__text().includes('Arraste a imagem para girar.')`), desktop)
    check(`${at} botão "Ver em 3D" só no celular`, await browser.evaluate(`!!__button('Ver em 3D ⤢') && __button('Ver em 3D ⤢').offsetParent !== null`), !desktop)

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
    await eventually(browser, `${at} 3D: copo de 500 ml com a base`, `__names('container:').concat(__names('base:'))`, ['container-copo-500', 'base-acai-copo-500'])
    await eventually(browser, `${at} 3D: só o escolhido`, `__toppings()`, ['banana', 'granola', 'kit-kat'])
    await eventually(browser, `${at} 3D: 12 pedaços de granola para 3 unidades`, `__pieces('granola')`, 12)
    await eventually(browser, `${at} 3D: 2 Kit Kat`, `__pieces('kit-kat')`, 2)
    await sleep(800)
    writeFileSync(join(outDir, `tradicional-montado-${viewport.width}.png`), await browser.screenshot())

    if (!desktop) {
      // "Ver em 3D": visualização ampliada que gira com o dedo
      await click(`__button('Ver em 3D ⤢')`)
      check(`${at} "Ver em 3D" abre a visualização`, await browser.evaluate(`__q('dialog').open`), true)
      check(`${at} foco vai para "Fechar"`, await browser.evaluate(`document.activeElement.textContent.trim()`), '✕ Fechar')
      await eventually(browser, `${at} visualização ampliada em 3D`, `__mode('dialog')`, '3d')
      await eventually(browser, `${at} visualização ampliada com o mesmo pedido`, `__toppings('dialog')`, ['banana', 'granola', 'kit-kat'])
      await sleep(800)
      writeFileSync(join(outDir, `ver-em-3d-${viewport.width}.png`), await browser.screenshot({ x: 0, y: 0, width: viewport.width, height: viewport.height }))
      await browser.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
      await browser.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
      await sleep(500)
      check(`${at} Esc fecha a visualização`, await browser.evaluate(`__q('dialog').open`), false)
      check(`${at} foco volta para "Ver em 3D"`, await browser.evaluate(`document.activeElement.textContent.trim()`), 'Ver em 3D ⤢')
    }

    await click(`__radio('pote-200')`)
    await eventually(browser, `${at} troca para Pote 200 ml: 10 pedaços de granola (2 unidades)`, `__pieces('granola')`, 10)
    await eventually(browser, `${at} 3D: pote de 200 ml`, `__names('container:')`, ['container-pote-200'])
    check(`${at} aviso visível da saída`, await browser.evaluate(`__text().includes('Saíram por passar do novo limite: 1 Granola.')`), true)
    check(`${at} anúncio da saída`, await browser.evaluate(`__live()`), 'Tamanho: Pote 200 ml, R$ 7,00. Saíram por passar do novo limite: 1 Granola.')
    check(`${at} total R$ 15,00 no pote`, await browser.evaluate(`__q('#resumo').innerText.includes('R$ 15,00')`), true)

    await click(`__button('Tirar Kit Kat')`)
    check(`${at} tirar 1 Kit Kat: total R$ 11,00`, await browser.evaluate(`__q('#resumo').innerText.includes('R$ 11,00')`), true)
    await eventually(browser, `${at} 3D: 1 Kit Kat`, `__pieces('kit-kat')`, 1)
    await click(`__button('Banana')`)
    await eventually(browser, `${at} Banana desmarcada sai da cena`, `__toppings()`, ['granola', 'kit-kat'])

    // --- Açaí Oca ---
    await page('/monte-seu-pedido/acai-oca', viewport)
    check(`${at} Oca não tem 150 ml`, await browser.evaluate(`__radio('pote-150') === null`), true)
    await click(`__radio('copo-500')`)
    for (const id of ['Granola', 'Leite em pó']) await click(`__button('Adicionar ${id}')`)
    await click(`__button('Morango')`)
    await click(`__button('Adicionar Kit Kat')`)
    check(`${at} Oca copo 500 + Kit Kat: R$ 24,00`, await browser.evaluate(`__q('#resumo').innerText.includes('R$ 24,00')`), true)
    await eventually(browser, `${at} Oca em 3D, com o pó como camada`, `__toppings()`, ['granola', 'kit-kat', 'leite-em-po', 'morango'])

    // --- Milk-shake ---
    await page('/monte-seu-pedido/milk-shake', viewport)
    check(`${at} aviso de sabores`, await browser.evaluate(`__text().includes('Favor verificar com a nossa atendente a disponibilidade de sabores.')`), true)
    check(`${at} sem adicionais grátis nem frutas`, await browser.evaluate(`!__button('Adicionar Granola') && !__button('Banana')`), true)
    check(`${at} coberturas com nome próprio`, await browser.evaluate(`!!__button('cobertura de Morango') && !__button('Morango')`), true)
    await click(`__radio('500-ml')`)
    check(`${at} sem sabor, o resumo pede o sabor`, await browser.evaluate(`__q('#resumo').innerText.includes('Falta escolher o sabor.')`), true)
    await click(`__radio('morango')`)
    check(`${at} milk-shake 500 ml de morango: R$ 12,00`, await browser.evaluate(`__q('#resumo').innerText.includes('R$ 12,00')`), true)
    await eventually(browser, `${at} 3D: copo de milk-shake de 500 ml`, `__names('container:').concat(__names('base:'))`, ['container-shake-500-ml', 'base-shake-500-ml'])
    await click(`__button('Adicionar Creme de avelã')`)
    await click(`__button('cobertura de Chocolate')`)
    check(`${at} milk-shake com creme de avelã: R$ 15,00`, await browser.evaluate(`__q('#resumo').innerText.includes('R$ 15,00')`), true)
    await eventually(browser, `${at} milk-shake em 3D com calda e creme`, `__toppings()`, ['calda-chocolate', 'creme-de-avela'])
    await sleep(800)
    writeFileSync(join(outDir, `milk-shake-${viewport.width}.png`), await browser.screenshot())

    check(`${at} console sem erros`, browser.consoleProblems(), [])
  }

  // Com "reduzir movimento" ligado, tudo continua funcionando e aparecendo.
  await browser.goto(baseUrl + '/monte-seu-pedido/acai-tradicional', { width: 390, height: 844, reducedMotion: true })
  await browser.evaluate(helpers)
  await click(`__radio('isopor-m')`)
  await click(`__button('Adicionar Paçoca')`)
  await click(`__button('Kiwi')`)
  await eventually(browser, 'movimento reduzido: cena com o escolhido', `__toppings()`, ['kiwi', 'pacoca'])
  check('movimento reduzido: total R$ 15,00', await browser.evaluate(`__q('#resumo').innerText.includes('R$ 15,00')`), true)
})

// Aparelho sem WebGL: fica a prévia ilustrada, com o aviso, e sem o botão "Ver em 3D".
await session('sem-webgl', 9338, ['--disable-webgl', '--disable-3d-apis'], async ({ browser, page, click }) => {
  await page('/monte-seu-pedido/acai-tradicional', { width: 390, height: 844 })
  check('sem WebGL: prévia ilustrada', await browser.evaluate(`__mode()`), 'unavailable')
  check('sem WebGL: aviso visível', await browser.evaluate(`__text().includes('A visualização 3D não está disponível neste aparelho. Mostramos a prévia ilustrada.')`), true)
  check('sem WebGL: sem "Ver em 3D"', await browser.evaluate(`!__button('Ver em 3D ⤢')`), true)
  await click(`__radio('copo-500')`)
  await click(`__button('Adicionar Granola')`)
  await click(`__button('Banana')`)
  check('sem WebGL: a ilustração mostra só o escolhido', await browser.evaluate(`__toppings2d()`), ['banana', 'granola'])
  writeFileSync(join(outDir, 'sem-webgl-390.png'), await browser.screenshot())
})

for (const failure of failures) console.log('FALHOU:', failure)
console.log(`Fotos em: ${outDir}`)
console.log(
  failures.length === 0
    ? `RESULTADO: as ${checks} conferências passaram`
    : `RESULTADO: ${failures.length} falha(s) em ${checks} conferências`,
)
process.exit(failures.length === 0 ? 0 : 1)
