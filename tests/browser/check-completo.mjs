// Confere no navegador o botão "Completo" (pedido de 2026-11-16), no celular (390 px) e no
// computador (1280 px):
// - Barca: "Completo" marca os 13 adicionais e as 3 frutas pelo preço de R$ 30,00, sem fechar o
//   personalizador; tirar a Farinha láctea mantém o resto; a confirmação, o carrinho e o WhatsApp
//   trazem "Montagem: COMPLETO (SEM: Farinha láctea)" e a Farinha láctea fica fora das listas;
// - Pote 1 L: "Completo" marca 24 itens por R$ 30,00; "Limpar" zera e volta à cota de 7 grátis;
// - Oca 200 ml: Completo por R$ 10,00 (cremes sem custo); Kit Kat continua cobrado (+ R$ 4,00);
// - Açaí Batido e Milk-shake não têm o botão.
//
// Uso (com o site rodando, por exemplo em `npm run dev`): node tests/browser/check-completo.mjs [endereçoBase]
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openBrowser, sleep } from './lib.mjs'

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:5173'
const outDir = join(tmpdir(), 'acai-doce-sabor-conferencia', 'completo')
const failures = []
let checks = 0

function check(label, actual, expected) {
  checks++
  const pass = JSON.stringify(actual) === JSON.stringify(expected)
  if (!pass) failures.push(`${label}: obtido ${JSON.stringify(actual)}, esperado ${JSON.stringify(expected)}`)
  return pass
}

const helpers = `
  window.__q = (selector) => document.querySelector(selector);
  window.__button = (text, root = document) => [...root.querySelectorAll('button')].find((b) => b.textContent.trim() === text);
  window.__bar = () => __q('[data-complete-bar]');
  window.__barButtons = () => [...(__bar()?.querySelectorAll('button') ?? [])].map((b) => b.textContent.trim());
  window.__resumo = () => __q('#resumo')?.innerText ?? '';
  window.__montagem = () => __q('#resumo [data-montagem]')?.textContent ?? null;
  // Quantos ingredientes estão marcados: cartões de "um de cada" ligados e contadores acima de 0.
  window.__marked = () =>
    document.querySelectorAll('button[aria-pressed="true"][aria-label]').length +
    [...document.querySelectorAll('[aria-label$=": 1"], [aria-label$=": 2"]')].filter((el) => el.getAttribute('role') === 'status' || el.tagName === 'OUTPUT' || el.tagName === 'SPAN').length;
  window.__total = () => (__resumo().match(/TOTAL\\s*(R\\$\\s*[\\d.,]+)/i) ?? [])[1] ?? null;
  window.__confirm = () => __q('dialog[role="alertdialog"]');
  window.__stubOpen = () => { window.__opened = []; window.open = (url) => { window.__opened.push(url); return {}; }; return true };
  window.__openedText = () => (window.__opened?.length ? new URL(window.__opened.at(-1)).searchParams.get('text') : null);
  true;
`

const browser = await openBrowser(join(outDir, 'edge-profile'), 9365)
const run = async (expression) => {
  await browser.evaluate(helpers)
  return browser.evaluate(expression)
}
const quiet = `sessionStorage.setItem('acai-doce-sabor:ofertas', JSON.stringify({ bag: [], last: null, dismissed: 3, stopped: true })); localStorage.clear(); true`
const page = async (path, viewport) => {
  await browser.goto(baseUrl + path, viewport)
  await sleep(600)
  await run(quiet)
  await browser.goto(baseUrl + path, viewport)
  for (let i = 0; i < 50 && !(await run(`!!document.querySelector('h1')`)); i++) await sleep(100)
  await run(`window.scrollTo(0, 0); true`)
}
const click = async (expression, pause = 450) => {
  const ok = await run(`(() => { const el = ${expression}; if (!el) return false; el.scrollIntoView({ block: 'center' }); el.click(); return true })()`)
  if (!ok) throw new Error(`Elemento não encontrado: ${expression}`)
  await sleep(pause)
}

try {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
    const at = `${viewport.width}px`

    // --- Barca ---
    await page('/monte-seu-pedido/barca-de-acai', viewport)
    check(`${at} Barca: barra do Completo com o texto pedido`, await run(`[__bar()?.querySelector('h2')?.textContent, __barButtons()]`), [
      'Quer rechear tudo de uma vez?',
      ['Completo'],
    ])
    await click(`__button('Completo', __bar())`)
    check(
      `${at} Barca: "Completo" marca 16 (13 adicionais e 3 frutas), R$ 30,00, sem fechar nem abrir janela`,
      await run(`[__resumo().includes('16 itens selecionados'), __total(), location.pathname, !!__q('dialog[open]'), __montagem()]`),
      [true, 'R$ 30,00', '/monte-seu-pedido/barca-de-acai', false, 'Montagem: COMPLETO (todos os acompanhamentos)'],
    )
    check(`${at} Barca: botões viram "Completo aplicado" e "Limpar"; aviso do modo`, await run(`[__barButtons(), __bar().textContent.includes('Modo Completo ativado!')]`), [
      ['Completo aplicado', 'Limpar'],
      true,
    ])
    check(`${at} Barca: no Completo, "+" da Granola bloqueado (1 de cada)`, await run(`__q('button[aria-label="Adicionar Granola"]').getAttribute('aria-disabled') ?? String(__q('button[aria-label="Adicionar Granola"]').disabled)`), 'true')
    await click(`__q('button[aria-label="Tirar Farinha láctea"]')`)
    check(
      `${at} Barca: tirar a Farinha láctea mantém o resto e o preço; "Marcar tudo novamente"`,
      await run(`[__resumo().includes('15 itens selecionados'), __total(), __montagem(), __barButtons()[0]]`),
      [true, 'R$ 30,00', 'Montagem: COMPLETO (SEM: Farinha láctea)', 'Marcar tudo novamente'],
    )
    await click(`__q('input[value="calda-chocolate"]')`)
    // O botão traz o preço junto ("Adicionar ao carrinho · R$ 30,00"): procura pelo começo.
    await click(`[...document.querySelectorAll('#resumo button')].find((b) => b.textContent.trim().startsWith('Adicionar ao carrinho'))`, 700)
    const confirmText = await run(`__confirm()?.open ? __confirm().textContent : ''`)
    check(`${at} Barca: confirmação com a montagem e sem a Farinha láctea na lista`, [confirmText.includes('COMPLETO (SEM: Farinha láctea)'), (confirmText.match(/Farinha láctea/g) ?? []).length], [true, 1])
    await click(`[...__confirm().querySelectorAll('button')].find((b) => b.textContent.includes('ir para o carrinho'))`, 900)
    check(`${at} Barca: no carrinho, "Montagem: COMPLETO (SEM: Farinha láctea)" e R$ 30,00`, await run(`[__q('[data-montagem]')?.textContent, document.body.innerText.includes('R$ 30,00')]`), [
      'Montagem: COMPLETO (SEM: Farinha láctea)',
      true,
    ])
    await run(`__stubOpen()`)
    await click(`__q('input[value="pix"]')`)
    await click(`[...document.querySelectorAll('button')].find((b) => b.textContent.includes('Confirmar e Enviar Pedido no WhatsApp'))`, 700)
    const message = (await run(`__openedText()`)) ?? ''
    const lines = message.split('\n')
    const title = lines.findIndex((line) => line.startsWith('*1x Barca de Açaí*'))
    check(
      `${at} Barca: WhatsApp com "• Montagem: COMPLETO (SEM: Farinha láctea)" logo abaixo do título e sem a Farinha láctea nas listas`,
      [title >= 0, lines[title + 1], lines.filter((line) => line.includes('Farinha láctea')).length],
      [true, '• Montagem: COMPLETO (SEM: Farinha láctea)', 1],
    )

    // --- Pote 1 L: Completo e Limpar ---
    await page('/monte-seu-pedido/pote-de-acai-1-litro', viewport)
    await click(`__button('Completo', __bar())`)
    check(`${at} Pote 1 L: 24 itens por R$ 30,00`, await run(`[__resumo().includes('24 itens selecionados'), __total()]`), [true, 'R$ 30,00'])
    await click(`__button('Limpar', __bar())`)
    check(
      `${at} Pote 1 L: "Limpar" zera e volta à cota de 7 grátis`,
      await run(`[__resumo().includes('itens selecionados'), __montagem(), __barButtons(), document.body.textContent.includes('0 de 7 adicionais grátis')]`),
      [false, null, ['Completo'], true],
    )

    // --- Oca 200 ml: cremes sem custo no Completo, Kit Kat cobrado ---
    await page('/monte-seu-pedido/acai-oca', viewport)
    await click(`__q('input[value="pote-200"]')`)
    await click(`__button('Completo', __bar())`)
    check(`${at} Oca 200 ml: Completo por R$ 10,00, com os cremes sem custo`, await run(`[__total(), __resumo().includes('Creme de ninho'), __resumo().includes('+ R$ 3,00')]`), [
      'R$ 10,00',
      true,
      false,
    ])
    await click(`__q('button[aria-label="Adicionar Kit Kat"]')`)
    check(`${at} Oca 200 ml: Kit Kat continua cobrado (R$ 14,00)`, await run(`__total()`), 'R$ 14,00')

    // --- Sem o botão ---
    for (const slug of ['acai-batido', 'milk-shake']) {
      await page(`/monte-seu-pedido/${slug}`, viewport)
      check(`${at} ${slug}: sem o botão Completo`, await run(`!!__bar()`), false)
    }
  }
  check('console sem erros', browser.consoleProblems(), [])
} catch (error) {
  failures.push(`erro: ${error.message}`)
} finally {
  browser.close()
}

if (failures.length) {
  console.log(`FALHAS (${failures.length} de ${checks}):`)
  for (const failure of failures) console.log(`- ${failure}`)
  process.exit(1)
}
console.log(`RESULTADO: as ${checks} conferências passaram`)
