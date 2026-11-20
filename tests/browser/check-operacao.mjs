// Confere no navegador a operação do modo vendedor e a comanda nova (pedido de 2026-11-17), com as
// mudanças gravadas NESTE aparelho (sem as chaves do Supabase), no computador (1280 px) e no
// celular (390 px):
// - esgotado em 1 toque: item (Jujuba), produto (Açaí Tradicional), Barca (pelo item) e complemento
//   (Granola), com a tarja e "Indisponível no momento" para o cliente, e de volta;
// - Loja Aberta / Fechada: selo do cabeçalho, aviso acolhedor com endereço e WhatsApp, pedido
//   antecipado na comanda, envio bloqueado quando o vendedor escolhe bloquear, e "Abrir" de volta;
// - Tempo (1 toque e digitado), Entrega / Frete (bairros, outro bairro, grátis, retirada) com o
//   frete no total e no troco, Horários e Contato (rodapé e número do WhatsApp);
// - Duplicar (cadastro preenchido, item novo na seção), "+ Observação" e a comanda linha a linha;
// - gerenciador de sabores: sabor do Batido esgotado em 1 toque, opção esgotada no Kit Completo,
//   sabor novo no Milk-shake e Duplicar com as duas escolhas do Kit.
//
// O modo vendedor é ligado direto pela sessão do aparelho (a senha é conferida em check:vendedor).
// Uso (com o site rodando, sem .env.local do Supabase): node tests/browser/check-operacao.mjs [endereçoBase]
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openBrowser, sleep } from './lib.mjs'

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:5173'
const outDir = join(tmpdir(), 'acai-doce-sabor-conferencia', 'operacao')
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
  window.__dialog = () => [...document.querySelectorAll('dialog[open]')].at(-1) ?? null;
  window.__button = (text, root = document) => [...root.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(text));
  window.__set = (el, text) => {
    const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, text);
    el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
    return true;
  };
  window.__item = (id) => __q('[data-item="' + id + '"]');
  window.__values = () => __q('[data-order-values]')?.innerText.replace(/\\s+/g, ' ') ?? '';
  window.__badge = () => [...document.querySelectorAll('[data-store-badge]')].find((el) => el.getBoundingClientRect().width > 0)?.textContent ?? '';
  window.__switch = () => __q('[data-store-switch]')?.dataset.storeSwitch ?? null;
  // Desde 2026-11-20 o pedido é finalizado no site ("Finalizar pedido"), sem WhatsApp.
  window.__send = () => __q('[data-finalize]');
  window.__stubOpen = () => { window.__opened = []; window.open = (url) => { window.__opened.push(url); return null; }; return true };
  // Sem o Supabase, a comanda fica guardada no modo de demonstração deste navegador.
  window.__demoOrders = () => { try { return JSON.parse(localStorage.getItem('acai_doce_sabor_pedidos_demo_v1')).orders } catch { return [] } };
  window.__openedText = () => __demoOrders().at(-1)?.message ?? null;
  true;
`

const browser = await openBrowser(join(outDir, 'edge-profile'), 9371)
const run = async (expression) => {
  await browser.evaluate(helpers)
  return browser.evaluate(expression)
}
const quiet = `sessionStorage.setItem('acai-doce-sabor:ofertas', JSON.stringify({ bag: [], last: null, dismissed: 3, stopped: true })); true`
const SESSION = `localStorage.setItem('acai_doce_sabor_seller_session_v1', '1'); true`
const goto = async (path, viewport) => {
  await browser.goto(baseUrl + path, viewport)
  await run(quiet)
  for (let i = 0; i < 50 && !(await run(`!!document.querySelector('h1')`)); i++) await sleep(100)
  await sleep(400)
}
const click = async (expression, pause = 600) => {
  const ok = await run(`(() => { const el = ${expression}; if (!el) return false; el.scrollIntoView({ block: 'center' }); el.click(); return true })()`)
  if (!ok) throw new Error(`Elemento não encontrado: ${expression}`)
  await sleep(pause)
}
const set = async (expression, value, pause = 150) => {
  const ok = await run(`(() => { const el = ${expression}; if (!el) return false; return __set(el, ${JSON.stringify(value)}) })()`)
  if (!ok) throw new Error(`Campo não encontrado: ${expression}`)
  await sleep(pause)
}
const submitDialog = async (pause = 1000) => {
  await run(`__dialog().querySelector('form').requestSubmit(); true`)
  await sleep(pause)
}
/** Carrinho com Jujuba (R$ 1,00) e Água (R$ 2,00): R$ 3,00. */
const CART = JSON.stringify({
  v: 2,
  items: [
    { kind: 'extra', id: 'j1', itemId: 'jujuba', choices: [], quantity: 1 },
    { kind: 'extra', id: 'a1', itemId: 'agua-mineral-500-ml', choices: [], quantity: 1 },
  ],
})
const fillName = (name = 'Cliente Teste') => set(`__q('input[autocomplete="name"]')`, name)
const choose = (kind) => click(`__q('input[type="radio"][value="${kind}"]')`, 400)
/** Espera uma condição da página (até 8 s). */
const waitUntil = async (condition, timeout = 8000) => {
  for (let waited = 0; waited < timeout; waited += 100) {
    if (await run(`!!(${condition})`)) return true
    await sleep(100)
  }
  return false
}
/** Abas abertas na última finalização (deve ser sempre 0). */
let lastOpened = null
/**
 * Finaliza no site e devolve a comanda guardada. O pedido confirmado leva ao acompanhamento e
 * esvazia o carrinho: volta ao carrinho com os mesmos itens (e observações) e a mesma forma de
 * pagamento; os dados do cliente voltam da aba.
 */
const sendOrder = async () => {
  const cart = await run(`localStorage.getItem('acai-doce-sabor:carrinho')`)
  const method = await run(`document.querySelector('input[name="forma-de-pagamento"]:checked')?.value ?? null`)
  const changeFor = await run(`document.querySelector('#troco-para')?.value ?? ''`)
  await run(`__stubOpen()`)
  await click(`__send()`, 700)
  if (!(await waitUntil(`location.pathname.startsWith('/acompanhar/DEMO-')`))) throw new Error('A finalização não levou ao acompanhamento.')
  lastOpened = await run(`window.__opened.length`)
  const lines = ((await run(`__openedText()`)) ?? '').split('\n')
  await run(`localStorage.setItem('acai-doce-sabor:carrinho', ${JSON.stringify(cart)}); true`)
  await goto('/carrinho', { width: 1280, height: 800 })
  if (method) await click(`document.querySelector('input[name="forma-de-pagamento"][value="${method}"]')`, 300)
  if (changeFor) await set(`document.querySelector('#troco-para')`, changeFor)
  return lines
}
/** A comanda sem a linha de pedido antecipado (que depende da hora em que a conferência roda). */
const withoutAntecipado = (lines) => lines.filter((line) => !line.startsWith('⏰'))
const LINE = '━━━━━━━━━━━━━━━━━━━━'

try {
  const desktop = { width: 1280, height: 800 }
  const phone = { width: 390, height: 844 }

  await goto('/', desktop)
  await run(`localStorage.clear(); sessionStorage.clear(); indexedDB.deleteDatabase('acai_doce_sabor_seller_images'); ${SESSION}`)
  await goto('/monte-seu-pedido', desktop)
  check(
    'faixa do vendedor: linha de operação',
    await run(`[!!__q('[data-store-switch]'), __q('[data-delivery-time]')?.textContent, __q('[data-delivery-settings]')?.textContent.trim(), __q('[data-hours-contact]')?.textContent.trim()]`),
    [true, 'Tempo: 30–45 min', 'Entrega / Frete', 'Horários e Contato'],
  )
  check('pílula "Disponível" em cada cartão (5 destaques, 44 itens, 4 produtos)', await run(`document.querySelectorAll('[data-seller-stock="disponivel"]').length`), 53)

  // --- 1. Esgotado em 1 toque ---
  await click(`__item('jujuba').querySelector('[data-seller-stock]')`, 900)
  check(
    'Jujuba esgotada em 1 toque: pílula, tarja ESGOTADO e "Indisponível no momento"',
    await run(`[__item('jujuba').querySelector('[data-seller-stock]').dataset.sellerStock, !!__item('jujuba').querySelector('[data-sold-out]'), __item('jujuba').querySelector('button[disabled]')?.textContent.trim()]`),
    ['esgotado', true, 'Indisponível no momento: Jujuba'],
  )
  check('esgotado gravado no aparelho', await run(`JSON.parse(localStorage.getItem('acai_doce_sabor_seller_catalog_v1')).items.jujuba`), { available: false })
  await click(`__q('#secao-acai-tradicional [data-seller-stock]')`, 900)
  check(
    'Açaí Tradicional esgotado: tarja e "Indisponível no momento" no cartão',
    await run(`[!!__q('#secao-acai-tradicional [data-sold-out]'), __q('#secao-acai-tradicional button[disabled]')?.textContent.trim(), !!__q('#secao-acai-tradicional a[href="/monte-seu-pedido/acai-tradicional"]')]`),
    [true, 'Indisponível no momento: Açaí Tradicional', false],
  )
  await click(`__item('barca-de-acai').querySelector('[data-seller-stock]')`, 900)

  // Cliente (sem o modo vendedor): o que ele vê.
  await run(`localStorage.removeItem('acai_doce_sabor_seller_session_v1'); true`)
  await goto('/monte-seu-pedido', desktop)
  check(
    'cliente: Jujuba com tarja e botão desligado, sem a pílula do vendedor',
    await run(`[!!__item('jujuba').querySelector('[data-sold-out]'), __item('jujuba').querySelector('button[disabled]')?.textContent.trim(), !!__q('[data-seller-stock]')]`),
    [true, 'Indisponível no momento: Jujuba', false],
  )
  await goto('/monte-seu-pedido/acai-tradicional', desktop)
  check(
    'cliente: personalizador do Tradicional esgotado não deixa pedir',
    await run(`[!!__q('[aria-label="Prévia do pedido"] [data-sold-out]'), __button('Indisponível no momento')?.disabled, !!__button('Adicionar ao carrinho')]`),
    [true, true, false],
  )
  await goto('/monte-seu-pedido/barca-de-acai', desktop)
  check('cliente: Barca esgotada pelo item também bloqueia o personalizador (endereço direto)', await run(`__button('Indisponível no momento')?.disabled`), true)

  // De volta ao vendedor: reabre tudo; complemento no personalizador.
  await run(SESSION)
  await goto('/monte-seu-pedido', desktop)
  await click(`__item('jujuba').querySelector('[data-seller-stock]')`, 800)
  await click(`__q('#secao-acai-tradicional [data-seller-stock]')`, 800)
  await click(`__item('barca-de-acai').querySelector('[data-seller-stock]')`, 800)
  check('reabertos em 1 toque: nenhum esgotado', await run(`[document.querySelectorAll('[data-seller-stock="esgotado"]').length, document.querySelectorAll('[data-sold-out]').length]`), [0, 0])
  await goto('/monte-seu-pedido/acai-tradicional', desktop)
  check('personalizador: pílula em cada complemento', await run(`document.querySelectorAll('[data-seller-stock]').length > 20`), true)
  const granola = `[...document.querySelectorAll('[data-seller-stock]')].find((b) => b.textContent.includes('Granola'))`
  await click(granola, 900)
  check(
    'Granola esgotada em 1 toque: o "+" fica desligado para o cliente',
    await run(`[${granola}.dataset.sellerStock, __q('button[aria-label="Adicionar Granola"]')?.getAttribute('aria-disabled') === 'true' || __q('button[aria-label="Adicionar Granola"]')?.disabled === true]`),
    ['esgotado', true],
  )
  await click(granola, 900)
  check('Granola de volta', await run(`${granola}.dataset.sellerStock`), 'disponivel')

  // --- 2. Loja Aberta / Fechada ---
  await goto('/monte-seu-pedido', desktop)
  // Fechada pelo interruptor: se a loja já está fechada pelo horário (de madrugada), abre e fecha.
  if ((await run(`__switch()`)) === 'fechada') await click(`__q('[data-store-switch]')`, 900)
  await click(`__q('[data-store-switch]')`, 900)
  check(
    'Loja Fechada: interruptor, até quando, selo do cabeçalho',
    await run(`[__switch(), /^Fechada até (hoje|amanhã) às 13h$/.test(__q('[data-store-switch-detail]').textContent), __badge()]`),
    ['fechada', true, 'Loja fechada no momento'],
  )
  check(
    'aviso acolhedor: convite para voltar, endereço no mapa e WhatsApp',
    await run(`(() => { const card = __q('[data-store-closed]'); const links = [...card.querySelectorAll('a')]; return [card.textContent.includes('Estamos fechados agora'), /Volte (hoje|amanhã) a partir das 13h/.test(card.textContent), links[0]?.href.startsWith('https://www.google.com/maps/search/?api=1&query=Rua%20Francisco%20Tota'), links[0]?.textContent.includes('Rua Francisco Tota, 12, Teixeira, PB'), links[1]?.href, links[1]?.textContent.includes('(83) 99699-9980')] })()`),
    [true, true, true, true, 'https://wa.me/5583996999980', true],
  )
  await goto('/', desktop)
  check('início: selo grande "FECHADO AGORA" e o aviso', await run(`[document.body.textContent.includes('FECHADO AGORA'), !!__q('[data-store-closed]')]`), [true, true])

  // Carrinho com a loja fechada: pedido antecipado (padrão).
  await run(`localStorage.setItem('acai-doce-sabor:carrinho', ${JSON.stringify(CART)}); true`)
  await goto('/carrinho', desktop)
  check('carrinho fechado: aviso de pedido antecipado', await run(`document.body.textContent.includes('o pedido vai como pedido antecipado')`), true)
  await fillName()
  await choose('retirada')
  await click(`__q('input[name="forma-de-pagamento"][value="pix"]')`, 300)
  let lines = await sendOrder()
  check('finalizado no site: nenhuma aba do WhatsApp aberta', lastOpened, 0)
  check('comanda com a loja fechada: "Pedido antecipado" logo abaixo da data', [/^📅 \*Data\/Hora:\* \d{2}\/\d{2}\/\d{4} às \d{2}:\d{2}$/.test(lines[1] ?? ''), lines[2]], [true, '⏰ *Pedido antecipado:* enviado com a loja fechada'])

  // Bloquear o envio com a loja fechada.
  await click(`__q('[data-hours-contact]')`, 800)
  await click(`__dialog().querySelector('input[value="bloquear"]')`, 200)
  await submitDialog()
  check(
    'loja fechada e "Bloquear o envio": botão desligado com o motivo',
    await run(`[__send()?.textContent.trim(), __send()?.disabled, document.body.textContent.includes('não está recebendo pedidos agora')]`),
    ['Loja fechada: pedidos bloqueados', true, true],
  )
  await click(`__q('[data-hours-contact]')`, 800)
  await click(`__dialog().querySelector('input[value="antecipado"]')`, 200)
  await submitDialog()

  // Abrir de volta.
  await click(`__q('[data-store-switch]')`, 900)
  check(
    'Loja Aberta: selo "Aberto agora • Entrega: 30–45 min", sem o aviso de fechada',
    await run(`[__switch(), __badge().replace(/\\s+/g, ' '), !!__q('[data-store-closed]'), document.body.textContent.includes('pedido antecipado')]`),
    ['aberta', 'Aberto agora•, Entrega: 30–45 min', false, false],
  )
  lines = await sendOrder()
  check('comanda com a loja aberta: sem "Pedido antecipado"', lines.some((line) => line.startsWith('⏰')), false)
  check(
    'comanda linha a linha (retirada, Pix)',
    withoutAntecipado(lines).filter((_, index) => index !== 1),
    [
      '🍧 *NOVO PEDIDO — AÇAÍ DOCE SABOR* 🍧',
      '',
      '👤 *DADOS DO CLIENTE*',
      '• *Nome:* Cliente Teste',
      '• *Modalidade:* 🛍️ Retirar no Local (Levar para casa)',
      '• *Local de retirada:* Rua Francisco Tota, 12 — Teixeira, PB',
      '',
      LINE,
      '🍨 *ITENS DO PEDIDO*',
      '',
      '1️⃣ *1x Jujuba* — *R$ 1,00*',
      '',
      '2️⃣ *1x Água Mineral 500 ml* — *R$ 2,00*',
      '',
      LINE,
      '🧾 *RESUMO FINANCEIRO*',
      '🛍️ *Subtotal dos itens:* R$ 3,00',
      '🛍️ *Retirada na loja:* Grátis (R$ 0,00)',
      '💰 *TOTAL A PAGAR:* *R$ 3,00*',
      '',
      LINE,
      '💳 *FORMA DE PAGAMENTO*',
      '• *Método escolhido:* 💠 *Pix* — *R$ 3,00*',
      '  📎 _Conferir o comprovante do Pix._',
      '',
      '💜 _Obrigado pela preferência! Açaí Doce Sabor_',
    ],
  )

  // --- 3. Tempo ---
  await click(`__q('[data-delivery-time]')`, 700)
  await click(`[...__dialog().querySelectorAll('button[aria-pressed]')].find((b) => b.textContent.startsWith('20–35'))`, 900)
  check('Tempo em 1 toque: 20–35 min no botão e no selo', await run(`[__q('[data-delivery-time]').textContent, __badge().includes('Entrega: 20–35 min')]`), ['Tempo: 20–35 min', true])
  await click(`__q('[data-delivery-time]')`, 700)
  await set(`__dialog().querySelector('input[type="text"]')`, '1 hora')
  await submitDialog(900)
  check('Tempo digitado: "1 hora"', await run(`__badge().includes('Entrega: 1 hora')`), true)

  // --- 4. Entrega / Frete ---
  await click(`__q('[data-delivery-settings]')`, 700)
  await click(`__dialog().querySelector('input[value="taxas"]')`, 300)
  await set(`__dialog().querySelector('[data-zone-name="0"]')`, 'Centro')
  await set(`__dialog().querySelector('[data-zone-price="0"]')`, '3,00')
  await click(`__dialog().querySelector('[data-add-zone]')`, 300)
  await set(`__dialog().querySelector('[data-zone-name="1"]')`, 'Bairros afastados')
  await set(`__dialog().querySelector('[data-zone-price="1"]')`, '5')
  await submitDialog()
  check(
    'frete por bairro gravado',
    await run(`JSON.parse(localStorage.getItem('acai_doce_sabor_seller_catalog_v1')).settings.loja.delivery.zones.map((zone) => [zone.name, zone.feeCents])`),
    [['Centro', 300], ['Bairros afastados', 500]],
  )
  await choose('entrega')
  check(
    'entrega: lista de bairros com o valor e "Outro bairro"',
    await run(`[...__q('select[data-field="zone"]').options].map((option) => option.textContent)`),
    ['Escolha o bairro', 'Centro — R$ 3,00', 'Bairros afastados — R$ 5,00', 'Outro bairro (taxa a combinar)'],
  )
  await run(`__stubOpen()`)
  await click(`__send()`, 500)
  check(
    'entrega sem endereço: avisos nos campos e nada finalizado',
    await run(`[document.body.textContent.includes('Escreva a rua.'), document.body.textContent.includes('Escolha o bairro.'), window.__opened.length, location.pathname]`),
    [true, true, 0, '/carrinho'],
  )
  await set(`__q('input[data-field="street"]')`, 'Rua das Flores')
  await set(`__q('input[data-field="number"]')`, '12')
  await run(`(() => { const select = __q('select[data-field="zone"]'); return __set(select, [...select.options].find((option) => option.textContent.startsWith('Centro')).value) })()`)
  await sleep(300)
  await set(`__q('input[placeholder="Ex.: perto da praça"]')`, 'perto da praça')
  check('frete do Centro somado: R$ 3,00 + R$ 3,00 = R$ 6,00', await run(`__values()`), 'Subtotal R$ 3,00 Entrega (Centro) R$ 3,00 TOTAL R$ 6,00')
  await click(`__q('input[name="forma-de-pagamento"][value="dinheiro"]')`, 300)
  await set(`__q('#troco-para')`, '5')
  await sleep(300)
  check('troco conta o frete: R$ 5,00 é menor que o total', await run(`document.body.textContent.includes('O valor informado é menor que o total do pedido (R$ 6,00)')`), true)
  await set(`__q('#troco-para')`, '10')
  await sleep(300)
  check('troco a levar com o frete: R$ 4,00', await run(`[...document.querySelectorAll('p[aria-live]')].some((p) => p.textContent.includes('R$ 4,00'))`), true)
  lines = await sendOrder()
  check(
    'comanda: entrega com endereço, frete do bairro, total e troco',
    [
      lines.includes('• *Modalidade:* 🛵 Entrega em Domicílio'),
      lines.includes('• *Endereço:* Rua das Flores, 12, Centro — Ref.: perto da praça'),
      lines.includes('🛵 *Frete / Entrega (Centro):* R$ 3,00'),
      lines.includes('💰 *TOTAL A PAGAR:* *R$ 6,00*'),
      lines.includes('• *Método escolhido:* 💵 *Dinheiro* — *R$ 6,00*'),
      lines.includes('  🪙 *Troco para:* R$ 10,00 *(Levar R$ 4,00 de troco)*'),
    ],
    [true, true, true, true, true, true],
  )

  // Outro bairro: a combinar, com o bairro escrito.
  await run(`__set(__q('select[data-field="zone"]'), 'outro')`)
  await sleep(300)
  await set(`__q('input[data-field="district"]')`, 'Sítio Novo')
  check('outro bairro: entrega a combinar', await run(`__values()`), 'Subtotal R$ 3,00 Entrega A combinar TOTAL R$ 3,00 + entrega a combinar')
  await click(`__q('input[name="forma-de-pagamento"][value="credito"]')`, 300)
  lines = await sendOrder()
  check(
    'comanda: outro bairro a combinar, cartão com maquininha',
    [
      lines.includes('• *Endereço:* Rua das Flores, 12, Sítio Novo — Ref.: perto da praça'),
      lines.includes('🛵 *Frete / Entrega:* A combinar'),
      lines.includes('💰 *TOTAL A PAGAR:* *R$ 3,00* + frete a combinar'),
      lines.includes('• *Método escolhido:* 💳 *Cartão de crédito* — *R$ 3,00* + frete a combinar 📟 _(Levar maquininha)_'),
    ],
    [true, true, true, true],
  )

  // Entrega grátis.
  await click(`__q('[data-delivery-settings]')`, 700)
  await click(`__dialog().querySelector('input[value="gratis"]')`, 300)
  await submitDialog()
  check('entrega grátis: R$ 0,00 no resumo', await run(`__values()`), 'Subtotal R$ 3,00 Entrega Grátis (R$ 0,00) TOTAL R$ 3,00')

  // --- 5. Observação ---
  await click(`[...document.querySelectorAll('[data-note-add]')][0]`, 400)
  await set(`__q('[data-note-input]')`, 'pouco gelo')
  await sleep(300)
  lines = await sendOrder()
  check('observação na comanda, logo abaixo do item', lines.slice(lines.indexOf('1️⃣ *1x Jujuba* — *R$ 1,00*'), lines.indexOf('1️⃣ *1x Jujuba* — *R$ 1,00*') + 2), [
    '1️⃣ *1x Jujuba* — *R$ 1,00*',
    '   📝 *Observação:* pouco gelo',
  ])
  await goto('/carrinho', desktop)
  check(
    'observação e dados do cliente continuam depois de recarregar',
    await run(`[__q('[data-note-input]')?.value, __q('input[autocomplete="name"]')?.value, __q('input[data-field="street"]')?.value]`),
    ['pouco gelo', 'Cliente Teste', 'Rua das Flores'],
  )

  // --- 6. Horários e Contato ---
  await click(`__q('[data-hours-contact]')`, 800)
  await set(`__dialog().querySelector('[data-hours="abre"]')`, '14:00')
  await set(`__dialog().querySelector('[data-hours="fecha"]')`, '00:00')
  await set(`__dialog().querySelector('input[type="tel"]')`, '83988887777')
  await submitDialog()
  // A forma de pagamento não fica guardada ao recarregar a página (só os dados do cliente).
  await click(`__q('input[name="forma-de-pagamento"][value="pix"]')`, 300)
  check(
    'horário e WhatsApp novos: rodapé e link do WhatsApp',
    await run(`[__q('footer').textContent.includes('Todos os dias, das 14h à meia-noite'), [...__q('footer').querySelectorAll('a')].some((a) => a.href === 'https://wa.me/5583988887777')]`),
    [true, true],
  )
  await run(`__stubOpen()`)
  await click(`__send()`, 700)
  await waitUntil(`__q('[data-support-whatsapp]')`)
  check('"Dúvidas? Falar no WhatsApp" do pedido usa o WhatsApp novo', await run(`__q('[data-support-whatsapp]')?.href.split('?')[0]`), 'https://wa.me/5583988887777')
  await click(`__q('[data-hours-contact]')`, 800)
  await set(`__dialog().querySelector('[data-hours="abre"]')`, '04:00')
  await submitDialog(600)
  check('abertura antes das 5h é recusada, com o motivo', await run(`__dialog()?.textContent.includes('A abertura precisa ser a partir das 05:00.')`), true)
  await run(`__dialog().close(); true`)
  await sleep(300)

  // --- 7. Duplicar ---
  await goto('/monte-seu-pedido', desktop)
  check('"Duplicar" nos itens, mas não no Pote 1 L nem na Barca', await run(`[!!__item('picole-gourmet').querySelector('[data-seller-duplicate]'), !!__item('barca-de-acai').querySelector('[data-seller-duplicate]'), !!__item('pote-de-acai-1-litro').querySelector('[data-seller-duplicate]')]`), [true, false, false])
  await click(`__item('picole-gourmet').querySelector('[data-seller-duplicate]')`, 1200)
  check(
    'Duplicar: título, nome com "(Cópia)", preço, sabores e sem foto',
    await run(`[__dialog().querySelector('h2').textContent, __dialog().querySelector('[id$="-nome"]').value, __dialog().querySelector('[id$="-preco"]').value, [...__dialog().querySelectorAll('[data-option-name]')].some((input) => input.value === 'Nutella'), !!__dialog().querySelector('button img[src]')]`),
    ['Duplicar Item — Picolé Gourmet (Cópia)', 'Picolé Gourmet (Cópia)', '3,00', true, false],
  )
  await set(`__dialog().querySelector('[id$="-nome"]')`, 'Picolé Gourmet Especial')
  await submitDialog(1400)
  const copy = `[...document.querySelectorAll('[data-section="picoles-e-sorvetes"] [data-item]')].find((card) => card.textContent.includes('Picolé Gourmet Especial'))`
  check(
    'item duplicado na seção, com o preço e a escolha de sabor do original',
    await run(`[!!${copy}, ${copy}?.querySelector('strong')?.textContent, ${copy}?.querySelector('button:not([data-zoom]):not([data-seller-edit]):not([data-seller-stock]):not([data-seller-duplicate])')?.textContent.trim().split(':')[0]]`),
    [true, 'R$ 3,00', 'Escolher sabor'],
  )

  // --- 8. Gerenciador de sabores (pedido de 2026-11-17) ---
  await goto('/monte-seu-pedido/acai-batido', desktop)
  const amendoim = `__q('[data-flavor="leite-condensado-amendoim"]')`
  await click(`${amendoim}.querySelector('[data-seller-stock]')`, 900)
  check(
    'Batido: sabor esgotado em 1 toque, desligado com "Esgotado"',
    await run(`[${amendoim}.querySelector('input').disabled, ${amendoim}.textContent.includes('Esgotado'), ${amendoim}.querySelector('[data-seller-stock]').dataset.sellerStock]`),
    [true, true, 'esgotado'],
  )
  await click(`${amendoim}.querySelector('[data-seller-stock]')`, 900)
  check('Batido: sabor de volta', await run(`${amendoim}.querySelector('input').disabled`), false)

  await goto('/monte-seu-pedido', desktop)
  await click(`__item('kit-completo-casquinha').querySelector('[data-seller-edit]')`, 1200)
  check(
    'Kit Completo: as duas escolhas no gerenciador de sabores',
    await run(`[...__dialog().querySelectorAll('[data-group-label]')].map((input) => input.value)`),
    ['Sabor do sorvete (2 litros)', 'Sabor da cobertura'],
  )
  await click(`[...__dialog().querySelectorAll('[data-option-name^="1-"]')].find((input) => input.value === 'Caramelo').parentElement.querySelector('[data-option-stock]')`, 300)
  await submitDialog(1400)
  await click(`__item('kit-completo-casquinha').querySelector('button:not([data-zoom]):not([data-seller-edit]):not([data-seller-stock]):not([data-seller-duplicate])')`, 900)
  check(
    'cliente: "Caramelo" esgotado aparece desligado na escolha da cobertura',
    await run(`(() => { const radio = [...__dialog().querySelectorAll('input[type=radio]')].find((input) => input.value === 'Caramelo'); return [radio?.disabled, radio?.closest('label').textContent.includes('Esgotado')] })()`),
    [true, true],
  )
  await run(`__dialog().close(); true`)
  await sleep(400)
  await click(`__item('kit-completo-casquinha').querySelector('[data-seller-duplicate]')`, 1200)
  check('Duplicar o Kit: a cópia vem com as duas escolhas', await run(`__dialog().querySelectorAll('[data-group-label]').length`), 2)
  await run(`__dialog().close(); true`)
  await sleep(400)

  await click(`__q('#secao-milkshake [data-seller-edit]')`, 1200)
  await click(`__dialog().querySelector('[data-add-option]')`, 300)
  await set(`[...__dialog().querySelectorAll('[data-option-name]')].at(-1)`, 'Nutella')
  await submitDialog(1400)
  await goto('/monte-seu-pedido/milk-shake', desktop)
  check('Milk-shake: sabor novo "Nutella" no personalizador', await run(`__q('[data-flavor="novo-nutella"]')?.textContent.includes('Nutella')`), true)

  // --- 9. Celular ---
  await goto('/carrinho', phone)
  check(
    'celular: selo na linha abaixo do cabeçalho, faixa e carrinho sem rolagem lateral',
    await run(`[__q('[data-store-badge="strip"]')?.getBoundingClientRect().width > 0, document.documentElement.scrollWidth]`),
    [true, 390],
  )
  check('console sem erros', await browser.consoleProblems(), [])
} catch (error) {
  failures.push(`erro na conferência: ${error.message}`)
} finally {
  browser.close()
}

console.log(`${checks} conferências`)
if (failures.length > 0) {
  console.log(`FALHAS (${failures.length}):`)
  for (const failure of failures) console.log(`- ${failure}`)
  process.exit(1)
}
console.log(`RESULTADO: as ${checks} conferências passaram`)
