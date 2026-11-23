// Confere no navegador o Pacote 1 do lado do cliente (2026-11-21), num site na porta 5182 SEM o
// Supabase (modo de demonstração; o caminho do site é o mesmo do Supabase):
// - "Meus pedidos" no rodapé, em qualquer página, levando ao acompanhamento real deste aparelho;
// - frete a combinar (o padrão da loja sem configuração): telefone obrigatório, com o aviso perto
//   do campo; sem telefone não finaliza; em Retirar continua opcional;
// - "Lembrar meus dados neste dispositivo": guarda só nome, telefone e endereço; volta numa visita
//   nova; desmarcar apaga;
// - acompanhamento: cartão do Pix com a chave, o botão de copiar e o total; previsão de entrega da
//   loja só na entrega; depois de acrescentar itens, o total novo e a diferença;
// - ofertas flutuantes somem no Modo Vendedor e voltam ao sair;
// - 390 e 320 px sem rolagem lateral; console sem erros.
//
// Uso: node tests/browser/check-compra-rapida.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'vite'
import { openBrowser, sleep } from './lib.mjs'

const PORT = 5182
const outDir = join(tmpdir(), 'acai-doce-sabor-conferencia', 'compra-rapida')
mkdirSync(outDir, { recursive: true })
const failures = []
let checks = 0
function check(label, actual, expected) {
  checks++
  const pass = JSON.stringify(actual) === JSON.stringify(expected)
  if (!pass) failures.push(`${label}: obtido ${JSON.stringify(actual)}, esperado ${JSON.stringify(expected)}`)
  return pass
}

// Sem o Supabase: modo de demonstração.
process.env.VITE_SUPABASE_URL = ''
process.env.VITE_SUPABASE_ANON_KEY = ''
process.env.VITE_SELLER_EMAIL = ''
const site = await createServer({
  configFile: join(process.cwd(), 'vite.config.ts'),
  cacheDir: join(tmpdir(), 'acai-doce-sabor-vite-compra-rapida'),
  server: { port: PORT, host: '127.0.0.1', strictPort: true },
  logLevel: 'error',
})
await site.listen()
const baseUrl = `http://127.0.0.1:${PORT}`

const helpers = `
  window.__q = (selector) => document.querySelector(selector);
  window.__text = (el) => el?.innerText.replace(/\\s+/g, ' ').trim() ?? null;
  window.__set = (el, text) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, text);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  };
  window.__field = (name) => __q('[data-field="' + name + '"]');
  window.__phoneLabel = () => __q('label[for="' + __field('phone').id + '"]')?.textContent;
  window.__noOverflow = () => document.documentElement.scrollWidth <= window.innerWidth;
  window.__remembered = () => JSON.parse(localStorage.getItem('acai_doce_sabor_meus_dados_v1') ?? 'null');
  true;
`

const browser = await openBrowser(join(outDir, 'edge-profile'), 9387)
// A área de transferência do navegador sem janela: o botão de copiar funciona de verdade.
await browser.send('Browser.grantPermissions', { origin: baseUrl, permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] }).catch(() => undefined)
const run = async (expression) => {
  await browser.evaluate(helpers)
  return browser.evaluate(expression)
}
const click = async (expression, pause = 400) => {
  const ok = await run(`(() => { const el = ${expression}; if (!el) return false; el.scrollIntoView({ block: 'center' }); el.click(); return true })()`)
  if (!ok) throw new Error(`Elemento não encontrado: ${expression}`)
  await sleep(pause)
}
/** Um clique de verdade (mouse), para o navegador liberar a área de transferência. */
const realClick = async (expression) => {
  await browser.evaluate(helpers)
  const box = await browser.evaluate(`(() => { const el = ${expression}; if (!el) return null; el.scrollIntoView({ block: 'center', behavior: 'instant' }); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
  if (!box) throw new Error(`Elemento não encontrado: ${expression}`)
  for (const type of ['mousePressed', 'mouseReleased']) await browser.send('Input.dispatchMouseEvent', { type, x: box.x, y: box.y, button: 'left', clickCount: 1 })
  await sleep(400)
}
const waitFor = async (condition, timeout = 8000) => {
  for (let waited = 0; waited < timeout; waited += 100) {
    if (await run(`(() => { try { return !!(${condition}) } catch { return false } })()`)) return true
    await sleep(100)
  }
  return false
}
const shot = async (name) => writeFileSync(join(outDir, `${name}.png`), Buffer.from((await browser.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'))
const quiet = `sessionStorage.setItem('acai-doce-sabor:ofertas', JSON.stringify({ bag: [], last: null, dismissed: 3, stopped: true })); true`
const OPEN_NOW = JSON.stringify({ settings: { loja: { override: { state: 'open', until: Date.now() + 3_600_000 } } } })
/** Jujuba (R$ 1,00) e Água (R$ 2,00): R$ 3,00. */
const CART = JSON.stringify({
  v: 2,
  items: [
    { kind: 'extra', id: 'j1', itemId: 'jujuba', choices: [], quantity: 1 },
    { kind: 'extra', id: 'a1', itemId: 'agua-mineral-500-ml', choices: [], quantity: 1 },
  ],
})
const desktop = { width: 1280, height: 900 }
/** Abre o carrinho com os dois itens. `newVisit`: como uma aba nova (sem o que foi digitado na aba). */
const openCart = async ({ newVisit = false, viewport = desktop } = {}) => {
  await run(`localStorage.setItem('acai-doce-sabor:carrinho', ${JSON.stringify(CART)}); ${newVisit ? 'sessionStorage.clear();' : ''} ${quiet}`)
  await browser.goto(`${baseUrl}/carrinho`, viewport)
  await run(quiet)
  await waitFor(`__q('[data-finalize]')`)
}

try {
  await browser.goto(`${baseUrl}/`, desktop)
  await run(`localStorage.clear(); sessionStorage.clear(); localStorage.setItem('acai_doce_sabor_seller_catalog_v1', ${JSON.stringify(OPEN_NOW)}); true`)

  // --- "Meus pedidos" no rodapé ---
  await browser.goto(`${baseUrl}/`, desktop)
  await run(quiet)
  check('rodapé do início: "Meus pedidos" para /acompanhar', await run(`[__text(__q('[data-footer-orders]')), new URL(__q('[data-footer-orders]').href).pathname]`), ['Meus pedidos', '/acompanhar'])
  await click(`__q('[data-footer-orders]')`, 800)
  check('"Meus pedidos" abre a lista deste aparelho (vazia, sem inventar pedido)', await waitFor(`location.pathname === '/acompanhar' && __q('[data-tracked-empty]')`), true)

  // --- Frete a combinar (a loja sem configuração de frete) ---
  await openCart()
  check('carrinho: "Meus pedidos" também no rodapé', await run(`!!__q('[data-footer-orders]')`), true)
  await click(`__q('input[type="radio"][value="retirada"]')`)
  check('retirar: telefone continua opcional, sem aviso', await run(`[__phoneLabel(), !!__q('[data-field-hint]')]`), ['Telefone (opcional)', false])
  await click(`__q('input[type="radio"][value="entrega"]')`, 500)
  check(
    'entrega com frete a combinar: "Telefone" obrigatório e o aviso junto do campo e do endereço',
    await run(`[__phoneLabel(), __text(__q('[data-field-hint]')), __field('phone').required, !!__q('[data-combinar-note]')]`),
    ['Telefone', 'Para entregas com frete a combinar, informe seu telefone. A loja entrará em contato para confirmar o valor da entrega.', true, true],
  )
  await run(`__set(__q('input[autocomplete="name"]'), 'Cliente Rápido')`)
  await run(`__set(__field('street'), 'Rua das Flores')`)
  await run(`__set(__field('number'), '12')`)
  await run(`__set(__field('district'), 'Centro')`)
  await click(`__q('input[name="forma-de-pagamento"][value="pix"]')`)
  await click(`__q('[data-finalize]')`, 600)
  check(
    'sem telefone: não finaliza; o aviso vira erro no campo e o foco vai para ele',
    await run(`[location.pathname, __field('phone').getAttribute('aria-invalid'), document.activeElement === __field('phone'), __text(__q('#' + CSS.escape(__field('phone').id) + '-erro'))]`),
    ['/carrinho', 'true', true, 'Para entregas com frete a combinar, informe seu telefone. A loja entrará em contato para confirmar o valor da entrega.'],
  )
  check('nada foi guardado como pedido', await run(`localStorage.getItem('acai_doce_sabor_pedidos_demo_v1')`), null)

  // --- Lembrar meus dados ---
  check('"Lembrar meus dados" começa desmarcado e nada fica guardado', await run(`[__q('[data-remember-me]').checked, __remembered()]`), [false, null])
  await run(`__set(__field('phone'), '(83) 98888-7777')`)
  await click(`__q('[data-remember-me]')`, 400)
  check(
    'marcado: guarda só nome, telefone e endereço (sem modalidade, GPS ou pagamento)',
    await run(`__remembered()`),
    { name: 'Cliente Rápido', phone: '(83) 98888-7777', street: 'Rua das Flores', number: '12', district: 'Centro', zoneId: null, reference: '' },
  )
  await run(`__set(__q('input[placeholder="Ex.: perto da praça"]'), 'portão azul')`)
  await sleep(300)
  check('mudou os dados com a opção marcada: o que está guardado acompanha', await run(`__remembered().reference`), 'portão azul')
  await click(`__q('[data-finalize]')`, 600)
  check('com telefone: finaliza no site e vai para o acompanhamento', await waitFor(`location.pathname.startsWith('/acompanhar/DEMO-') && __q('[data-order-success="pedido"]')`), true)
  const deliveryCode = decodeURIComponent((await run(`location.pathname`)).split('/').pop())

  // --- Acompanhamento: Pix e previsão ---
  await waitFor(`__q('[data-tracking-pix]')`)
  check(
    'cartão do Pix no acompanhamento: o total do pedido, a entrega a combinar e a chave da loja',
    await run(`[__text(__q('[data-pix-total]')), __text(__q('[data-tracking-pix]')).includes('+ entrega a combinar'), __q('[data-tracking-pix]').textContent.includes('Chave Pix (Celular)'), __text(__q('[data-tracking-pix]')).includes('83996999980')]`),
    ['R$ 3,00', true, true, true],
  )
  await realClick(`__q('[data-tracking-pix] [data-pix-copy]')`)
  check('copiar a chave: "Chave Pix copiada!"', await waitFor(`__text(__q('[data-tracking-pix] [data-pix-copy]')) === 'Chave Pix copiada!'`, 3000), true)
  check('a chave foi para a área de transferência', await run(`navigator.clipboard.readText().catch(() => null)`), '83996999980')
  check(
    'entrega: a previsão de entrega da loja na linha do tempo (o "Tempo" configurado, 30–45 min), com o horário',
    await run(`/^🕒 Previsão de entrega da loja: 30–45 min a partir do pedido \\(até por volta das \\d{2}:\\d{2}\\)\\.$/.test(__text(__q('[data-tracking-timeline] [data-tracking-forecast]')))`),
    true,
  )
  await shot('acompanhamento-pix-1280')

  // --- Acrescentar itens: o Pix mostra o total novo e a diferença ---
  await click(`__q('[data-add-items]')`, 800)
  await run(`localStorage.setItem('acai-doce-sabor:carrinho', JSON.stringify({ v: 2, items: [{ kind: 'extra', id: 'z1', itemId: 'jujuba', choices: [], quantity: 2 }] })); true`)
  await browser.goto(`${baseUrl}/carrinho`, desktop)
  await run(quiet)
  await waitFor(`__q('[data-add-confirm]')`)
  await click(`__q('[data-add-confirm]')`, 800)
  await waitFor(`__q('[data-order-success="itens"]') && __q('[data-pix-additions]')`)
  check(
    'depois do acréscimo: total novo, o valor de antes, os itens acrescentados e a diferença a pagar',
    await run(`[__text(__q('[data-pix-total]')), __text(__q('[data-pix-additions]'))]`),
    ['R$ 5,00', 'Pedido antes dos acréscimos R$ 3,00 Itens acrescentados + R$ 2,00 Já fez o Pix de R$ 3,00? Faça outro Pix só dos itens acrescentados: R$ 2,00.'],
  )

  // --- Visita nova: os dados voltam ---
  await openCart({ newVisit: true })
  check(
    'visita nova: nome, telefone e endereço preenchidos, a opção marcada e a modalidade para escolher',
    await run(`[__q('input[autocomplete="name"]').value, __field('phone').value, __q('[data-remember-me]').checked, !!__q('input[type="radio"]:checked[data-field="kind"], input[name$="-receber"]:checked')]`),
    ['Cliente Rápido', '(83) 98888-7777', true, false],
  )
  await click(`__q('input[type="radio"][value="entrega"]')`, 500)
  check('o endereço lembrado aparece na entrega', await run(`[__field('street').value, __field('number').value, __field('district').value]`), ['Rua das Flores', '12', 'Centro'])
  // Retirada no Pix: sem previsão de entrega (a loja não configura tempo de retirada).
  await click(`__q('input[type="radio"][value="retirada"]')`, 400)
  await click(`__q('input[name="forma-de-pagamento"][value="pix"]')`)
  await click(`__q('[data-finalize]')`, 600)
  await waitFor(`location.pathname.startsWith('/acompanhar/DEMO-') && __q('[data-tracking-timeline]')`)
  check(
    'retirada: o cartão do Pix aparece; a previsão de entrega, não',
    await run(`[__text(__q('[data-pix-total]')), !!__q('[data-tracking-forecast]'), !!__q('[data-pix-additions]')]`),
    ['R$ 3,00', false, false],
  )
  check('dois pedidos no aparelho, os dois em "Meus pedidos"', await run(`JSON.parse(localStorage.getItem('acai_doce_sabor_meus_pedidos_v1')).length`), 2)

  // --- Desmarcar apaga ---
  await openCart()
  await click(`__q('[data-remember-me]')`, 400)
  check('desmarcou: os dados lembrados são apagados', await run(`__remembered()`), null)
  await openCart({ newVisit: true })
  check('visita nova depois de desmarcar: formulário vazio', await run(`[__q('input[autocomplete="name"]').value, __field('phone').value, __q('[data-remember-me]').checked]`), ['', '', false])

  // --- Celular ---
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 320, height: 640 },
  ]) {
    await browser.goto(`${baseUrl}/acompanhar/${encodeURIComponent(deliveryCode)}`, viewport)
    await run(quiet)
    await waitFor(`__q('[data-tracking-pix]')`)
    check(`${viewport.width} px: acompanhamento com Pix e previsão, sem rolagem lateral`, await run(`[!!__q('[data-tracking-pix]'), !!__q('[data-tracking-forecast]'), __noOverflow()]`), [true, true, true])
    await shot(`acompanhamento-${viewport.width}`)
    await openCart({ viewport })
    await click(`__q('input[type="radio"][value="entrega"]')`, 500)
    check(`${viewport.width} px: carrinho com o aviso do telefone e "Lembrar meus dados", sem rolagem lateral`, await run(`[!!__q('[data-field-hint]'), !!__q('[data-remember-me]'), __noOverflow()]`), [true, true, true])
  }
  await shot('carrinho-320')

  // --- Ofertas flutuantes x Modo Vendedor ---
  await run(`sessionStorage.removeItem('acai-doce-sabor:ofertas'); true`)
  await browser.goto(`${baseUrl}/monte-seu-pedido`, desktop)
  check('cliente: as ofertas flutuantes aparecem', await waitFor(`__q('[data-offer]')`, 12_000), true)
  await waitFor(`__q('[data-seller-access]')`)
  await click(`__q('[data-seller-access]')`, 800)
  await run(`(() => { const el = __q('#senha-vendedor'); __set(el, 'vendedor2026'); el.form.requestSubmit(); return true })()`)
  check('Modo Vendedor ligado', await waitFor(`__q('[data-seller-bar]')`), true)
  check('Modo Vendedor: a oferta some na hora', await waitFor(`!__q('[data-offer]')`, 3000), true)
  await sleep(8000)
  check('Modo Vendedor: nenhuma oferta e nem o "Ver ofertas" (8 s depois)', await run(`[!!__q('[data-offer]'), [...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Ver ofertas')]`), [false, false])
  // "Sair do Modo Vendedor" mora no painel (2026-11-23); depois volta ao cardápio pelo topo.
  await click(`__q('[data-seller-panel-link]')`, 800)
  await waitFor(`__q('[data-panel-signout]')`)
  await click(`__q('[data-panel-signout]')`, 1000)
  await click(`[...document.querySelectorAll('header a')].find((a) => a.textContent.trim() === 'Cardápio')`, 800)
  check('saiu do Modo Vendedor: as ofertas voltam', await waitFor(`__q('[data-offer]') || [...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Ver ofertas')`, 25_000), true)

  check('console sem erros', browser.consoleProblems(), [])
} catch (error) {
  failures.push(`erro na conferência: ${error.message}`)
} finally {
  browser.close()
  await site.close()
}

console.log(`${checks - failures.length}/${checks} conferências passaram. Fotos em ${outDir}`)
if (failures.length) {
  console.log(failures.map((failure) => `FALHA ${failure}`).join('\n'))
  process.exit(1)
}
