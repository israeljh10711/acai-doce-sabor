// Usa o site como um cliente: monta açaí, açaí batido e milk-shake, confere a foto montada
// (camadas do compositor), os limites, os preços, e leva tudo ao carrinho.
//
// A foto é lida pelas camadas na página: cada uma tem `data-layer` e `data-topping`.
//
// Uso: node tests/browser/check-configurator.mjs [endereçoBase] [pastaDeSaída]
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openBrowser, sleep } from './lib.mjs'

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:5173'
const outDir = process.argv[3] ?? join(tmpdir(), 'acai-doce-sabor-conferencia', 'personalizador')
mkdirSync(outDir, { recursive: true })

const failures = []
let checks = 0

// Funções que rodam dentro da página.
const helpers = `
  window.__q = (selector) => document.querySelector(selector);
  window.__button = (label) => [...document.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent.trim()) === label);
  window.__buttonStarting = (prefix) => [...document.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent.trim()).startsWith(prefix));
  window.__blocked = (label) => { const b = window.__button(label) ?? window.__buttonStarting(label); return !!b && (b.disabled || b.getAttribute('aria-disabled') === 'true') };
  window.__radio = (value) => document.querySelector('input[type=radio][value="' + value + '"]');
  window.__text = () => document.body.innerText;
  window.__live = () => document.querySelector('[aria-live="polite"]').textContent;
  window.__composer = (root = '[aria-label="Prévia do pedido"]') => document.querySelector(root + ' [data-composer]');
  window.__container = (root) => window.__composer(root)?.dataset.container;
  window.__layers = (root) => [...new Set([...(window.__composer(root)?.querySelectorAll('[data-layer]') ?? [])]
    .map((el) => el.dataset.topping).filter((id) => !id.startsWith('sabor:')))].sort();
  window.__count = (id, root) => [...(window.__composer(root)?.querySelectorAll('[data-layer="piece"]') ?? [])].filter((el) => el.dataset.topping === id).length;
  window.__summary = () => __q('#resumo').innerText;
  true;
`

function check(label, actual, expected) {
  checks++
  const pass = JSON.stringify(actual) === JSON.stringify(expected)
  if (!pass) failures.push(`${label}: obtido ${JSON.stringify(actual)}, esperado ${JSON.stringify(expected)}`)
  return pass
}

/** Repete a leitura até bater com o esperado (as camadas animam ao entrar e sair), por até ~6 s. */
async function eventually(browser, label, expression, expected) {
  let actual
  for (let attempt = 0; attempt < 30; attempt++) {
    actual = await browser.evaluate(expression)
    if (JSON.stringify(actual) === JSON.stringify(expected)) break
    await sleep(200)
  }
  return check(label, actual, expected)
}

const browser = await openBrowser(join(outDir, 'edge-profile-principal'), 9337)
const page = async (path, viewport) => {
  await browser.goto(baseUrl + path, viewport)
  await browser.evaluate(helpers)
}
const click = async (expression) => {
  await browser.evaluate(helpers)
  const ok = await browser.evaluate(`(() => { const el = ${expression}; if (!el) return false; el.click(); return true })()`)
  if (!ok) throw new Error(`Elemento não encontrado: ${expression}`)
  await sleep(300)
}
const key = async (keyName, code) => {
  await browser.send('Input.dispatchKeyEvent', { type: 'keyDown', key: keyName, code, windowsVirtualKeyCode: code === 'Escape' ? 27 : 0 })
  await browser.send('Input.dispatchKeyEvent', { type: 'keyUp', key: keyName, code, windowsVirtualKeyCode: code === 'Escape' ? 27 : 0 })
  await sleep(400)
}

try {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
    const at = `${viewport.width}px`
    const desktop = viewport.width >= 1024

    // Carrinho vazio no começo de cada rodada.
    await page('/', viewport)
    await browser.evaluate(`localStorage.clear(); true`)

    // --- Açaí Tradicional ---
    await page('/monte-seu-pedido/acai-tradicional', viewport)
    check(`${at} antes do tamanho, a foto não tem complementos`, await browser.evaluate(`__layers()`), [])
    check(`${at} antes do tamanho, "Adicionar Granola" desabilitado`, await browser.evaluate(`__blocked('Adicionar Granola')`), true)
    check(`${at} antes do tamanho, Banana desabilitada`, await browser.evaluate(`__blocked('Banana')`), true)
    check(`${at} sem 3D: nenhum canvas na página`, await browser.evaluate(`document.querySelector('canvas') === null`), true)
    check(`${at} "Ver foto" só no celular`, await browser.evaluate(`!!__button('Ver foto') && __button('Ver foto').offsetParent !== null`), !desktop)
    check(`${at} carrinho bloqueado antes do tamanho`, await browser.evaluate(`__blocked('Adicionar ao carrinho')`), true)

    await click(`__radio('copo-500')`)
    check(`${at} foto no copo`, await browser.evaluate(`__container()`), 'copo')
    for (let i = 0; i < 3; i++) await click(`__button('Adicionar Granola')`)
    check(`${at} contador "3 de 3 adicionais grátis"`, await browser.evaluate(`__text().includes('3 de 3 adicionais grátis · limite atingido')`), true)
    check(`${at} com o limite cheio, "Adicionar Paçoca" desabilitado`, await browser.evaluate(`__blocked('Adicionar Paçoca')`), true)
    check(`${at} com o limite cheio, "Adicionar Kit Kat" habilitado`, await browser.evaluate(`__blocked('Adicionar Kit Kat')`), false)
    await click(`__button('Adicionar Paçoca')`)
    check(`${at} tocar no "Adicionar Paçoca" bloqueado não adiciona`, await browser.evaluate(`document.querySelector('[role=group][aria-label="Paçoca: 0"]') !== null`), true)
    await click(`__button('Adicionar Kit Kat')`)
    await click(`__button('Adicionar Kit Kat')`)
    await click(`__button('Banana')`)
    check(`${at} Banana marcada (uma vez só)`, await browser.evaluate(`__button('Banana').getAttribute('aria-pressed')`), 'true')
    check(`${at} total R$ 20,00`, await browser.evaluate(`__summary().includes('R$ 20,00')`), true)
    await eventually(browser, `${at} foto: só o escolhido`, `__layers()`, ['banana', 'granola', 'kit-kat'])
    await eventually(browser, `${at} foto: 2 Kit Kat`, `__count('kit-kat')`, 2)

    await click(`__radio('isopor-m')`)
    await eventually(browser, `${at} trocar para isopor troca a foto pela tigela`, `__container()`, 'isopor')
    await eventually(browser, `${at} no isopor, os mesmos ingredientes`, `__layers()`, ['banana', 'granola', 'kit-kat'])
    await sleep(700)
    writeFileSync(join(outDir, `tradicional-isopor-${viewport.width}.png`), await browser.screenshot())

    if (!desktop) {
      await click(`__button('Ver foto')`)
      check(`${at} "Ver foto" abre a foto grande`, await browser.evaluate(`__q('dialog').open`), true)
      await eventually(browser, `${at} foto grande com o mesmo pedido`, `__layers('dialog')`, ['banana', 'granola', 'kit-kat'])
      await key('Escape', 'Escape')
      check(`${at} Esc fecha a foto grande`, await browser.evaluate(`__q('dialog').open`), false)
      check(`${at} foco volta para "Ver foto"`, await browser.evaluate(`document.activeElement.textContent.trim()`), 'Ver foto')
    }

    await click(`__radio('pote-200')`)
    check(`${at} aviso visível da saída`, await browser.evaluate(`__text().includes('Saíram por passar do novo limite: 1 Granola.')`), true)
    check(`${at} anúncio da saída`, await browser.evaluate(`__live()`), 'Tamanho: Pote 200 ml, R$ 7,00. Saíram por passar do novo limite: 1 Granola.')
    check(`${at} total R$ 15,00 no pote`, await browser.evaluate(`__summary().includes('R$ 15,00')`), true)
    await eventually(browser, `${at} foto no pote`, `__container()`, 'pote')
    await click(`__button('Tirar Kit Kat')`)
    check(`${at} tirar 1 Kit Kat: total R$ 11,00`, await browser.evaluate(`__summary().includes('R$ 11,00')`), true)
    await click(`__button('Banana')`)
    await eventually(browser, `${at} Banana desmarcada sai da foto`, `__layers()`, ['granola', 'kit-kat'])
    await click(`__buttonStarting('Adicionar ao carrinho')`)
    check(`${at} confirma que foi para o carrinho`, await browser.evaluate(`__text().includes('Açaí Tradicional adicionado ao carrinho.')`), true)

    // --- Açaí Oca ---
    await page('/monte-seu-pedido/acai-oca', viewport)
    check(`${at} Oca com os selos`, await browser.evaluate(`document.body.textContent.includes('Especialidade da casa') && document.body.textContent.includes('O mais pedido')`), true)
    check(`${at} Oca não tem 150 ml`, await browser.evaluate(`__radio('pote-150') === null`), true)
    await click(`__radio('copo-500')`)
    for (const id of ['Granola', 'Leite em pó']) await click(`__button('Adicionar ${id}')`)
    await click(`__button('Morango')`)
    await click(`__button('Adicionar Creme de avelã')`)
    check(`${at} Oca copo 500 + creme de avelã: R$ 23,00`, await browser.evaluate(`__summary().includes('R$ 23,00')`), true)
    await eventually(browser, `${at} Oca: foto com o escolhido`, `__layers()`, ['creme-de-avela', 'granola', 'leite-em-po', 'morango'])

    // --- Açaí Batido ---
    await page('/monte-seu-pedido/acai-batido', viewport)
    check(
      `${at} batido com os três sabores`,
      await browser.evaluate(`['leite-condensado', 'leite-condensado-amendoim', 'leite-condensado-pacoca'].every((id) => !!__radio(id))`),
      true,
    )
    check(`${at} batido sem aviso de sabores do milk-shake`, await browser.evaluate(`__text().includes('Favor verificar')`), false)
    await click(`__radio('300-ml')`)
    check(`${at} batido sem sabor pede o sabor`, await browser.evaluate(`__summary().includes('Falta escolher o sabor.')`), true)
    await click(`__radio('leite-condensado-amendoim')`)
    check(`${at} batido 300 ml: R$ 10,00`, await browser.evaluate(`__summary().includes('R$ 10,00')`), true)
    await click(`__button('Adicionar Creme de avelã')`)
    await click(`__button('Adicionar Creme de avelã')`)
    await click(`__button('Adicionar Ovomaltine')`)
    check(`${at} batido + 3 adicionais de R$ 3,00: R$ 19,00`, await browser.evaluate(`__summary().includes('R$ 19,00')`), true)
    await eventually(browser, `${at} batido: foto com os adicionais`, `__layers()`, ['batido-creme-de-avela', 'batido-ovomaltine'])
    for (let i = 0; i < 11; i++) await click(`__button('Adicionar Creme de cookies')`)
    check(`${at} batido: no máximo 10 de cada adicional`, await browser.evaluate(`__blocked('Adicionar Creme de cookies')`), true)
    check(`${at} batido 300 ml + 13 adicionais: R$ 49,00`, await browser.evaluate(`__summary().includes('R$ 49,00')`), true)
    await click(`__radio('500-ml')`)
    check(`${at} batido 500 ml com os mesmos adicionais: R$ 51,00`, await browser.evaluate(`__summary().includes('R$ 51,00')`), true)
    await click(`__buttonStarting('Adicionar ao carrinho')`)

    // --- Milk-shake ---
    await page('/monte-seu-pedido/milk-shake', viewport)
    check(`${at} aviso de sabores`, await browser.evaluate(`__text().includes('Favor verificar com a nossa atendente a disponibilidade de sabores.')`), true)
    check(`${at} 13 sabores`, await browser.evaluate(`document.querySelectorAll('input[name="milk-shake-sabor"]').length`), 13)
    check(`${at} sem adicionais grátis nem frutas`, await browser.evaluate(`!__button('Adicionar Granola') && !__button('Banana')`), true)
    check(`${at} coberturas com nome próprio`, await browser.evaluate(`!!__button('cobertura de Morango') && !__button('Morango')`), true)
    await click(`__radio('500-ml')`)
    check(`${at} sem sabor, o resumo pede o sabor`, await browser.evaluate(`__summary().includes('Falta escolher o sabor.')`), true)
    await click(`__radio('morango')`)
    check(`${at} milk-shake 500 ml de morango: R$ 12,00`, await browser.evaluate(`__summary().includes('R$ 12,00')`), true)
    await click(`__button('Adicionar Creme de avelã')`)
    await click(`__button('cobertura de Chocolate')`)
    check(`${at} milk-shake com creme de avelã: R$ 15,00`, await browser.evaluate(`__summary().includes('R$ 15,00')`), true)
    await eventually(browser, `${at} milk-shake: foto com calda e creme`, `__layers()`, ['calda-chocolate', 'creme-de-avela'])
    await sleep(700)
    writeFileSync(join(outDir, `milk-shake-${viewport.width}.png`), await browser.screenshot())
    await click(`__buttonStarting('Adicionar ao carrinho')`)

    // --- Carrinho ---
    await page('/carrinho', viewport)
    check(`${at} carrinho com os 3 itens`, await browser.evaluate(`document.querySelectorAll('[aria-label="Itens do carrinho"] > li').length`), 3)
    // Tradicional Pote 200 (R$ 11,00) + Batido 500 ml (R$ 51,00) + Milk-shake (R$ 15,00) = R$ 77,00.
    check(`${at} total do carrinho R$ 77,00`, await browser.evaluate(`__q('[aria-labelledby="total-titulo"]').innerText.includes('R$ 77,00')`), true)
    await click(`[...document.querySelectorAll('[aria-label="Itens do carrinho"] > li')][0].querySelector('[aria-label="Aumentar quantidade"]')`)
    check(`${at} 2x o primeiro item: R$ 88,00`, await browser.evaluate(`__q('[aria-labelledby="total-titulo"]').innerText.includes('R$ 88,00')`), true)
    check(`${at} contador do cabeçalho: 4 itens`, await browser.evaluate(`__q('header').innerText.includes('4')`), true)
    check(`${at} finalização honesta, sem botão de envio falso`, await browser.evaluate(`__text().includes('Envio do pedido pelo site em breve') && !__button('Finalizar pedido')`), true)
    writeFileSync(join(outDir, `carrinho-${viewport.width}.png`), await browser.screenshot())

    // Editar o batido: abre o personalizador com a montagem dele; salvar volta ao carrinho.
    await click(`[...document.querySelectorAll('a')].find((a) => a.textContent.includes('Editar') && a.href.includes('acai-batido'))`)
    await sleep(600)
    await browser.evaluate(helpers)
    check(`${at} edição abre com o tamanho do item`, await browser.evaluate(`__radio('500-ml').checked`), true)
    check(`${at} edição abre com o sabor do item`, await browser.evaluate(`__radio('leite-condensado-amendoim').checked`), true)
    await click(`__radio('300-ml')`)
    await click(`__buttonStarting('Salvar alterações')`)
    await sleep(600)
    await browser.evaluate(helpers)
    check(`${at} salvar volta ao carrinho`, await browser.evaluate(`location.pathname`), '/carrinho')
    check(`${at} item editado: R$ 88,00 - R$ 2,00 = R$ 86,00`, await browser.evaluate(`__q('[aria-labelledby="total-titulo"]').innerText.includes('R$ 86,00')`), true)
    check(`${at} editar não cria item novo`, await browser.evaluate(`document.querySelectorAll('[aria-label="Itens do carrinho"] > li').length`), 3)
    await click(`[...document.querySelectorAll('[aria-label="Itens do carrinho"] > li')][2].querySelector('button[class*="red"]')`)
    check(`${at} remover o milk-shake: R$ 71,00`, await browser.evaluate(`__q('[aria-labelledby="total-titulo"]').innerText.includes('R$ 71,00')`), true)
    check(`${at} console sem erros`, browser.consoleProblems(), [])
  }

  // Com "reduzir movimento" ligado, a foto continua montando sem animação.
  await browser.goto(baseUrl + '/monte-seu-pedido/acai-tradicional', { width: 390, height: 844, reducedMotion: true })
  await browser.evaluate(helpers)
  await click(`__radio('isopor-m')`)
  await click(`__button('Adicionar Paçoca')`)
  await click(`__button('Kiwi')`)
  await eventually(browser, 'movimento reduzido: foto com o escolhido', `__layers()`, ['kiwi', 'pacoca'])
  check('movimento reduzido: total R$ 15,00', await browser.evaluate(`__summary().includes('R$ 15,00')`), true)
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
