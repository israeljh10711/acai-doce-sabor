// Confere no navegador o botão "Completo" (pedido de 2026-11-16, com o ajuste do mesmo dia), no
// celular (390 px) e no computador (1280 px):
// - Barca: "Completo" marca os 12 adicionais sem custo (sem o leite condensado) e as 3 frutas pelo
//   preço de R$ 30,00, sem fechar o personalizador; tirar a Farinha láctea mantém o resto; a
//   confirmação e o carrinho trazem "Montagem: COMPLETO (SEM: Farinha láctea)" e a comanda do
//   WhatsApp (2026-11-17), "✨ Montagem: COMPLETO" e "🚫 RETIRAR (SEM): Farinha láctea";
// - Pote 1 L: "Completo" marca 15 itens por R$ 30,00, sem caldas nem cremes; "Limpar" zera e volta
//   à cota de 7 grátis;
// - Tradicional Isopor M (R$ 15,00): Completo + creme de avelã + creme de ninho = R$ 21,00, e o
//   comanda do WhatsApp traz os dois em "➕ Cremes / Extras Pagos", com o valor;
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
  // Desde 2026-11-20 o pedido é finalizado no site (sem WhatsApp): sem o Supabase, a comanda fica
  // guardada no modo de demonstração deste navegador. Nenhuma aba deve abrir.
  window.__stubOpen = () => { window.__opened = []; window.open = (url) => { window.__opened.push(url); return null; }; return true };
  window.__openedText = () => { try { return JSON.parse(localStorage.getItem('acai_doce_sabor_pedidos_demo_v1')).orders.at(-1).message } catch { return null } };
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
/** Comanda de 2026-11-17: nome e retirada na loja (sem endereço), antes de enviar o pedido. */
const FILL_CUSTOMER = `(() => {
  const name = document.querySelector('input[autocomplete="name"]');
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(name, 'Cliente Teste');
  name.dispatchEvent(new Event('input', { bubbles: true }));
  document.querySelector('input[type="radio"][value="retirada"]').click();
  return true;
})()`

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
      `${at} Barca: "Completo" marca 15 (12 adicionais e 3 frutas), R$ 30,00, sem fechar nem abrir janela`,
      await run(`[__resumo().includes('15 itens selecionados'), __total(), location.pathname, !!__q('dialog[open]'), __montagem()]`),
      [true, 'R$ 30,00', '/monte-seu-pedido/barca-de-acai', false, 'Montagem: COMPLETO'],
    )
    check(`${at} Barca: botões viram "Completo aplicado" e "Limpar"; aviso do modo`, await run(`[__barButtons(), __bar().textContent.includes('Modo Completo ativado!')]`), [
      ['Completo aplicado', 'Limpar'],
      true,
    ])
    check(`${at} Barca: o leite condensado não é marcado pelo Completo`, await run(`__q('[aria-pressed="false"][aria-label="Leite condensado"]') !== null`), true)
    check(`${at} Barca: Completo marca Granola uma vez`, await run(`__q('button[aria-label="Granola"]').getAttribute('aria-pressed')`), 'true')
    await click(`__q('button[aria-label="Farinha láctea"]')`)
    check(
      `${at} Barca: tirar a Farinha láctea mantém o resto e o preço; "Marcar tudo novamente"`,
      await run(`[__resumo().includes('14 itens selecionados'), __total(), __montagem(), __barButtons()[0]]`),
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
    await run(FILL_CUSTOMER)
    await sleep(300)
    await click(`__q('input[value="pix"]')`)
    await click(`[...document.querySelectorAll('button')].find((b) => b.textContent.includes('Finalizar pedido'))`, 700)
    const message = (await run(`__openedText()`)) ?? ''
    const lines = message.split('\n')
    const title = lines.findIndex((line) => line.includes('*1x Barca de Açaí*'))
    check(
      `${at} Barca: comanda com "COMPLETO" e "RETIRAR (SEM): Farinha láctea" logo abaixo do título e sem a Farinha láctea nas listas`,
      [title >= 0, lines[title + 1], lines[title + 2], lines.filter((line) => line.includes('Farinha láctea')).length],
      [true, '   ✨ *Montagem:* COMPLETO', '   🚫 *RETIRAR (SEM):* Farinha láctea', 1],
    )

    // --- Pote 1 L: Completo e Limpar ---
    await page('/monte-seu-pedido/pote-de-acai-1-litro', viewport)
    await click(`__button('Completo', __bar())`)
    check(
      `${at} Pote 1 L: 15 itens por R$ 30,00, sem caldas nem cremes`,
      await run(`[__resumo().includes('15 itens selecionados'), __total(), document.querySelectorAll('button[aria-pressed="true"][aria-label*="calda" i], button[aria-pressed="true"][aria-label*="Creme" i]').length]`),
      [true, 'R$ 30,00', 0],
    )
    await click(`__button('Limpar', __bar())`)
    check(
      `${at} Pote 1 L: "Limpar" zera e volta à cota de 7 grátis`,
      await run(`[__resumo().includes('itens selecionados'), __montagem(), __barButtons(), document.body.textContent.includes('0 de 7 adicionais grátis')]`),
      [false, null, ['Completo'], true],
    )

    // --- Exemplo do pedido: Tradicional Isopor M (R$ 15,00) + Completo + avelã + ninho = R$ 21,00 ---
    await page('/monte-seu-pedido/acai-tradicional', viewport)
    await click(`__q('input[value="isopor-m"]')`)
    await click(`__button('Completo', __bar())`)
    check(`${at} Tradicional Isopor M: Completo por R$ 15,00, sem cremes marcados`, await run(`[__total(), __resumo().includes('Creme de')]`), ['R$ 15,00', false])
    await click(`[...document.querySelectorAll('button[aria-pressed]')].find((b) => b.getAttribute('aria-label') === 'Creme de avelã')`)
    await click(`[...document.querySelectorAll('button[aria-pressed]')].find((b) => b.getAttribute('aria-label') === 'Creme de ninho')`)
    check(`${at} Tradicional Isopor M: + creme de avelã + creme de ninho = R$ 21,00`, await run(`__total()`), 'R$ 21,00')
    await click(`__q('button[aria-label="Kit Kat"]')`)
    check(`${at} Tradicional Isopor M: + Kit Kat = R$ 25,00`, await run(`__total()`), 'R$ 25,00')
    await click(`[...document.querySelectorAll('#resumo button')].find((b) => b.textContent.trim().startsWith('Adicionar ao carrinho'))`, 700)
    check(
      `${at} Tradicional: confirmação com "Extras / Cremes e Caldas pagos"`,
      await run(`(__confirm()?.textContent ?? '').includes('Extras / Cremes e Caldas pagos')`),
      true,
    )
    await click(`[...__confirm().querySelectorAll('button')].find((b) => b.textContent.includes('ir para o carrinho'))`, 900)
    await run(`__stubOpen()`)
    await run(FILL_CUSTOMER)
    await sleep(300)
    await click(`__q('input[value="pix"]')`)
    await click(`[...document.querySelectorAll('button')].find((b) => b.textContent.includes('Finalizar pedido'))`, 700)
    const extras = ((await run(`__openedText()`)) ?? '').split('\n')
    check(
      `${at} Tradicional: comanda com R$ 25,00, "COMPLETO (todos os acompanhamentos)" e os pagos com o valor`,
      [
        extras.some((line) => line.includes('*1x Açaí Tradicional*') && line.endsWith('— *R$ 25,00*')),
        extras.includes('   ✨ *Montagem:* COMPLETO (todos os acompanhamentos)'),
        extras.includes('   ➕ *Cremes / Extras Pagos:* Creme de ninho (+R$ 3,00), Creme de avelã (+R$ 3,00), Kit Kat (+R$ 4,00)'),
      ],
      [true, true, true],
    )

    // --- Sem o botão ---
    for (const slug of ['acai-oca', 'acai-batido', 'milk-shake']) {
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
