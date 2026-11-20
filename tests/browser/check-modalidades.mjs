// Confere no navegador as três modalidades do carrinho e o GPS da entrega (pedido de 2026-11-20),
// num segundo site na porta 5176 sem o Supabase (a comanda é feita no aparelho; a função "pedido"
// é conferida em check:pedido). O site da porta 5173 não muda.
// - Entrega, Retirar e Comer no Local: cartões, campos de cada uma, cartões da loja com o link do
//   mapa, frete e total na hora, e a volta para a entrega com o endereço guardado;
// - GPS com geolocalização e Nominatim de mentira (nunca o GPS do computador): carregando, um toque
//   só, selo, link do pino, endereço sugerido só nos campos vazios, Remover GPS, resposta atrasada
//   ignorada, permissão negada com a mensagem amigável, e o GPS fora da aba guardada;
// - a comanda das três modalidades no link do WhatsApp;
// - computador (1280 px), celular (390 px) e celular estreito (320 px): três lado a lado quando
//   cabem, um por linha no estreito, sem texto cortado e sem rolagem lateral.
//
// Uso: node tests/browser/check-modalidades.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'vite'
import { openBrowser, sleep } from './lib.mjs'

const PORT = 5176
const outDir = join(tmpdir(), 'acai-doce-sabor-conferencia', 'modalidades')
mkdirSync(outDir, { recursive: true })
const failures = []
let checks = 0

function check(label, actual, expected) {
  checks++
  const pass = JSON.stringify(actual) === JSON.stringify(expected)
  if (!pass) failures.push(`${label}: obtido ${JSON.stringify(actual)}, esperado ${JSON.stringify(expected)}`)
  return pass
}

// Sem o Supabase: as variáveis do processo valem mais que o .env.local.
process.env.VITE_SUPABASE_URL = ''
process.env.VITE_SUPABASE_ANON_KEY = ''
process.env.VITE_SELLER_EMAIL = ''
const site = await createServer({
  configFile: join(process.cwd(), 'vite.config.ts'),
  cacheDir: join(tmpdir(), 'acai-doce-sabor-vite-modalidades'),
  server: { port: PORT, host: '127.0.0.1', strictPort: true },
  logLevel: 'error',
})
await site.listen()
const baseUrl = `http://127.0.0.1:${PORT}`

const helpers = `
  window.__q = (selector) => document.querySelector(selector);
  window.__button = (text) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(text));
  window.__set = (el, text) => {
    const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, text);
    el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
    return true;
  };
  window.__values = () => __q('[data-order-values]')?.innerText.replace(/\\s+/g, ' ') ?? '';
  window.__field = (name) => __q('[data-field="' + name + '"]');
  window.__stubOpen = () => { window.__opened = []; window.open = (url) => { window.__opened.push(url); return {}; }; return true };
  window.__openedText = () => (window.__opened?.length ? new URL(window.__opened.at(-1)).searchParams.get('text') : null);
  // GPS de mentira: 'ok' devolve um ponto; um número é o código de erro do navegador (1 negado).
  window.__geo = (mode, delay = 0) => {
    window.__geoCalls = [];
    const fake = {
      getCurrentPosition(success, failure, options) {
        window.__geoCalls.push(options);
        setTimeout(() => {
          if (mode === 'ok') success({ coords: { latitude: -7.2209871234, longitude: -37.2541239876, accuracy: 8 }, timestamp: Date.now() });
          else failure({ code: mode, message: 'teste' });
        }, delay);
      },
    };
    Object.defineProperty(navigator, 'geolocation', { value: fake, configurable: true });
    return true;
  };
  // Nominatim de mentira: conta as consultas e responde depois de 'delay' ms.
  window.__nominatim = (body, delay = 0) => {
    window.__nomCalls = [];
    if (!window.__realFetch) window.__realFetch = window.fetch;
    window.fetch = (input, init) => {
      const url = String(input);
      if (url.startsWith('https://nominatim.openstreetmap.org/')) {
        window.__nomCalls.push(url);
        return new Promise((resolve) => setTimeout(() => resolve(new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })), delay));
      }
      return window.__realFetch(input, init);
    };
    return true;
  };
  window.__noOverflow = () => document.documentElement.scrollWidth <= window.innerWidth;
  // Texto cortado: alguma letra fora do cartão (o selo ✓ decorativo, no canto, não conta).
  window.__cards = () => [...document.querySelectorAll('[data-modalidades] label')].map((label) => {
    const box = label.getBoundingClientRect();
    const walker = document.createTreeWalker(label, NodeFilter.SHOW_TEXT);
    let cut = false;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.textContent.trim() || node.parentElement.closest('[aria-hidden="true"]')) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const rect of range.getClientRects()) {
        if (rect.left < box.left - 0.5 || rect.right > box.right + 0.5 || rect.top < box.top - 0.5 || rect.bottom > box.bottom + 0.5) cut = true;
      }
    }
    return { text: label.innerText.replace(/\\s+/g, ' ').trim(), top: Math.round(box.top), cut };
  });
  true;
`

const browser = await openBrowser(join(outDir, 'edge-profile'), 9374)
const run = async (expression) => {
  await browser.evaluate(helpers)
  return browser.evaluate(expression)
}
const click = async (expression, pause = 400) => {
  const ok = await run(`(() => { const el = ${expression}; if (!el) return false; el.scrollIntoView({ block: 'center' }); el.click(); return true })()`)
  if (!ok) throw new Error(`Elemento não encontrado: ${expression}`)
  await sleep(pause)
}
const set = async (expression, value, pause = 200) => {
  const ok = await run(`(() => { const el = ${expression}; if (!el) return false; return __set(el, ${JSON.stringify(value)}) })()`)
  if (!ok) throw new Error(`Campo não encontrado: ${expression}`)
  await sleep(pause)
}
const waitFor = async (condition, timeout = 6000) => {
  for (let waited = 0; waited < timeout; waited += 100) {
    if (await run(`!!(${condition})`)) return true
    await sleep(100)
  }
  return false
}
const choose = (kind) => click(`__q('input[type="radio"][value="${kind}"]')`, 450)
const sendOrder = async () => {
  await run(`__stubOpen()`)
  await click(`__button('Confirmar e Enviar Pedido no WhatsApp')`, 600)
  return ((await run(`__openedText()`)) ?? '').split('\n')
}
const shot = async (name) => writeFileSync(join(outDir, `${name}.png`), await browser.screenshot())

/** Jujuba (R$ 1,00) e Água (R$ 2,00): R$ 3,00. */
const CART = JSON.stringify({
  v: 2,
  items: [
    { kind: 'extra', id: 'j1', itemId: 'jujuba', choices: [], quantity: 1 },
    { kind: 'extra', id: 'a1', itemId: 'agua-mineral-500-ml', choices: [], quantity: 1 },
  ],
})
/** Loja aberta e frete por bairro, como o vendedor grava neste aparelho. */
const SELLER = JSON.stringify({
  settings: {
    loja: {
      override: { state: 'open', until: Date.now() + 3_600_000 },
      delivery: { mode: 'taxas', zones: [{ id: 'centro', name: 'Centro', feeCents: 300 }, { id: 'longe', name: 'Bairros afastados', feeCents: 500 }] },
    },
  },
})
const quiet = `sessionStorage.setItem('acai-doce-sabor:ofertas', JSON.stringify({ bag: [], last: null, dismissed: 3, stopped: true })); true`
const NOMINATIM = { address: { house_number: '12', road: 'Rua Francisco Tota', suburb: 'Centro', city: 'Teixeira', state: 'Paraíba', country_code: 'br' } }
const GPS_URL = 'https://www.google.com/maps?q=-7.220987,-37.254124'
const STORE_MAP = 'https://www.google.com/maps/search/?api=1&query=Rua%20Francisco%20Tota%2C%2012%2C%20Teixeira%2C%20PB'
const LINE = '━━━━━━━━━━━━━━━━━━━━'

const openCart = async (viewport, reset = false) => {
  await browser.goto(`${baseUrl}/`, viewport)
  if (reset) await run(`localStorage.clear(); sessionStorage.clear(); true`)
  await run(`localStorage.setItem('acai-doce-sabor:carrinho', ${JSON.stringify(CART)}); localStorage.setItem('acai_doce_sabor_seller_catalog_v1', ${JSON.stringify(SELLER)}); ${quiet}`)
  await browser.goto(`${baseUrl}/carrinho`, viewport)
  await run(quiet)
  await waitFor(`__q('[data-order-values]')`)
  await sleep(300)
}

try {
  const desktop = { width: 1280, height: 900 }
  await openCart(desktop, true)

  // --- Seletor ---
  const cards = await run(`__cards()`)
  check(
    'três modalidades, com os textos pedidos',
    cards.map((card) => card.text),
    ['Entrega Receber em casa', 'Retirar Pegar na loja e levar', 'Comer no Local Consumir na sorveteria'],
  )
  check('computador: três lado a lado, sem texto cortado', [new Set(cards.map((card) => card.top)).size, cards.some((card) => card.cut)], [1, false])
  check('nada escolhido ainda: sem endereço, sem cartão da loja, sem GPS', await run(`[!!__field('street'), !!__q('[data-store-place]'), !!__q('[data-gps-capture]')]`), [false, false, false])
  check('nenhuma pergunta de localização ao abrir o carrinho', await run(`typeof window.__geoCalls`), 'undefined')
  await run(`__geo('ok'); __nominatim(${JSON.stringify(NOMINATIM)})`)

  // --- Entrega ---
  await choose('entrega')
  check(
    'entrega: botão do GPS e os campos de endereço',
    await run(`[__q('[data-gps-capture]')?.textContent.trim(), !!__field('street'), !!__field('number'), !!__field('zone'), !!__q('input[placeholder="Ex.: perto da praça"]'), !!__q('[data-store-place]')]`),
    ['📍 Usar minha localização atual', true, true, true, true, false],
  )
  check('entrega sem bairro: frete esperando o bairro', await run(`__values()`), 'Subtotal R$ 3,00 Entrega escolha o bairro TOTAL R$ 3,00')
  await set(`__field('zone')`, 'longe', 300)
  check('bairro afastado: R$ 5,00 no total', await run(`__values()`), 'Subtotal R$ 3,00 Entrega (Bairros afastados) R$ 5,00 TOTAL R$ 8,00')
  await set(`__field('zone')`, 'centro', 300)
  check('troca para o Centro: frete atualizado, sem somar o anterior', await run(`__values()`), 'Subtotal R$ 3,00 Entrega (Centro) R$ 3,00 TOTAL R$ 6,00')
  await set(`__field('street')`, 'Rua das Flores')
  await set(`__field('number')`, '12A')
  await set(`__q('input[placeholder="Ex.: perto da praça"]')`, 'portão azul')

  // --- Retirar e Comer no Local ---
  await choose('retirada')
  check(
    'retirar: sem endereço e sem GPS; cartão da retirada com o endereço da loja',
    await run(`[!!__field('street'), !!__q('[data-gps-capture]'), __q('[data-store-place="retirada"]')?.innerText.split('\\n').filter(Boolean)]`),
    [false, false, ['🛍️ Retirada no Balcão — Açaí Doce Sabor', 'Faça seu pedido e retire diretamente na nossa loja.', '📍 Rua Francisco Tota, 12 — Teixeira, PB', '🗺️ Ver localização da sorveteria no Google Maps']],
  )
  check('retirar: frete grátis na hora, sem o frete do Centro', await run(`__values()`), 'Subtotal R$ 3,00 Retirada na loja Grátis (R$ 0,00) TOTAL R$ 3,00')
  check(
    'link do mapa da loja: endereço de "Horários e Contato", em outra aba, protegido',
    await run(`(() => { const a = __q('[data-store-place] [data-store-map]'); return [a.href, a.target, a.rel] })()`),
    [STORE_MAP, '_blank', 'noopener noreferrer'],
  )
  await choose('local')
  check(
    'comer no local: cartão próprio (dourado), sem endereço',
    await run(`[!!__field('street'), __q('[data-store-place="local"]')?.innerText.split('\\n').filter(Boolean), getComputedStyle(__q('[data-store-place="local"]')).backgroundColor]`),
    [false, ['🍨 Consumo no Local — Vamos deixar tudo pronto!', 'Assim que você enviar o pedido, já começamos a preparar para você só chegar e aproveitar.', '📍 Rua Francisco Tota, 12 — Teixeira, PB', '🗺️ Ver localização da sorveteria no Google Maps'], 'rgb(254, 249, 195)'],
  )
  check('comer no local: frete grátis', await run(`__values()`), 'Subtotal R$ 3,00 Consumo no local Grátis (R$ 0,00) TOTAL R$ 3,00')
  await shot('1280-comer-no-local')
  await choose('entrega')
  check(
    'volta para a entrega: endereço guardado e o frete do Centro de novo',
    await run(`[__field('street').value, __field('number').value, __field('zone').value, __values()]`),
    ['Rua das Flores', '12A', 'centro', 'Subtotal R$ 3,00 Entrega (Centro) R$ 3,00 TOTAL R$ 6,00'],
  )

  // --- GPS: sucesso, com o endereço sugerido só nos campos vazios ---
  await set(`__field('street')`, '')
  await set(`__field('number')`, '')
  await set(`__field('zone')`, '', 300)
  await run(`__geo('ok', 700); __nominatim(${JSON.stringify(NOMINATIM)}, 200)`)
  await run(`(() => { const b = __q('[data-gps-capture]'); b.click(); b.click(); return true })()`)
  await sleep(150)
  check(
    'carregando: "Buscando sua localização...", botão desligado, um pedido só ao aparelho',
    await run(`[__q('[data-gps-capture]')?.textContent.trim(), __q('[data-gps-capture]')?.disabled, window.__geoCalls.length]`),
    ['Buscando sua localização...', true, 1],
  )
  check('pedido ao aparelho com alta precisão, tempo limite e posição nova', await run(`window.__geoCalls[0]`), { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 })
  await waitFor(`__q('[data-gps="anexado"]')`)
  await sleep(500)
  check(
    'sucesso: selo verde, link do pino e "Remover GPS"',
    await run(`(() => { const a = __q('[data-gps-map]'); return [__q('[data-gps="anexado"] [role="status"]')?.textContent.trim(), a?.textContent.trim(), a?.href, a?.target, a?.rel, __q('[data-gps-remove]')?.textContent.trim()] })()`),
    ['✅ Localização GPS anexada ao pedido', 'Conferir pino no mapa', GPS_URL, '_blank', 'noopener noreferrer', 'Remover GPS'],
  )
  check(
    'endereço sugerido nos campos vazios (rua, número e o bairro da lista); referência escrita mantida',
    await run(`[__field('street').value, __field('number').value, __field('zone').value, __q('input[placeholder="Ex.: perto da praça"]').value, window.__nomCalls.length]`),
    ['Rua Francisco Tota', '12', 'centro', 'portão azul', 1],
  )
  check('consulta do endereço com o ponto do GPS, uma vez', await run(`window.__nomCalls[0]`), 'https://nominatim.openstreetmap.org/reverse?format=json&lat=-7.220987&lon=-37.254124&zoom=18&addressdetails=1&accept-language=pt-BR')
  check('GPS fora da aba guardada (não volta em outra sessão)', await run(`JSON.parse(sessionStorage.getItem('acai_doce_sabor_checkout_v1')).gps`), null)
  await shot('1280-entrega-gps')

  await set(`__q('input[autocomplete="name"]')`, 'Cliente Teste')
  await click(`__q('input[name="forma-de-pagamento"][value="pix"]')`, 300)
  let lines = await sendOrder()
  check(
    'comanda da entrega com GPS: modalidade, endereço, GPS, frete e total',
    lines.slice(lines.indexOf('👤 *DADOS DO CLIENTE*'), lines.indexOf(LINE)).concat(lines.filter((line) => line.startsWith('🛵 *Frete') || line.startsWith('💰'))),
    [
      '👤 *DADOS DO CLIENTE*',
      '• *Nome:* Cliente Teste',
      '• *Modalidade:* 🛵 Entrega em Domicílio',
      '• *Endereço:* Rua Francisco Tota, 12, Centro — Ref.: portão azul',
      `• *Localização GPS:* ${GPS_URL}`,
      '',
      '🛵 *Frete / Entrega (Centro):* R$ 3,00',
      '💰 *TOTAL A PAGAR:* *R$ 6,00*',
    ],
  )
  check('WhatsApp da loja', await run(`new URL(window.__opened.at(-1)).origin + new URL(window.__opened.at(-1)).pathname`), 'https://wa.me/5583996999980')

  // --- Remover GPS ---
  await click(`__q('[data-gps-remove]')`, 400)
  check(
    'Remover GPS: botão de volta, endereço mantido',
    await run(`[__q('[data-gps-capture]')?.textContent.trim(), !!__q('[data-gps-map]'), __field('street').value, __field('zone').value]`),
    ['📍 Usar minha localização atual', false, 'Rua Francisco Tota', 'centro'],
  )
  lines = await sendOrder()
  check('comanda sem GPS depois de remover', [lines.some((line) => line.includes('GPS')), lines.includes('• *Endereço:* Rua Francisco Tota, 12, Centro — Ref.: portão azul')], [false, true])

  // --- O que o cliente escreveu fica; resposta atrasada é ignorada ---
  await set(`__field('street')`, 'Rua Digitada')
  await set(`__field('number')`, '')
  await run(`__geo('ok'); __nominatim(${JSON.stringify(NOMINATIM)})`)
  await click(`__q('[data-gps-capture]')`, 900)
  check('GPS de novo: a rua escrita fica, o número vazio é sugerido', await run(`[__field('street').value, __field('number').value]`), ['Rua Digitada', '12'])
  await click(`__q('[data-gps-remove]')`, 300)
  await set(`__field('street')`, '')
  await set(`__field('number')`, '')
  await run(`__geo('ok'); __nominatim(${JSON.stringify(NOMINATIM)}, 1500)`)
  await click(`__q('[data-gps-capture]')`, 300)
  await click(`__q('[data-gps-remove]')`, 2000)
  check('removido antes da resposta do endereço: nada preenchido', await run(`[__field('street').value, __field('number').value, window.__nomCalls.length]`), ['', '', 1])

  // --- Permissão negada ---
  await run(`__geo(1)`)
  await click(`__q('[data-gps-capture]')`, 500)
  check(
    'permissão negada: mensagem amigável, botão de volta',
    await run(`[__q('[data-gps-error]')?.textContent.trim(), __q('[data-gps-capture]')?.textContent.trim(), __q('[data-gps-capture]')?.disabled]`),
    ['Não foi possível obter sua localização automaticamente. Você pode preencher seu endereço manualmente abaixo.', '📍 Usar minha localização atual', false],
  )
  await run(`__stubOpen()`)
  await click(`__button('Confirmar e Enviar Pedido no WhatsApp')`, 500)
  check('entrega sem GPS e sem rua: os avisos dos campos, nada enviado', await run(`[document.body.textContent.includes('Escreva a rua.'), window.__opened.length]`), [true, 0])
  await set(`__field('street')`, 'Rua das Flores')
  await set(`__field('number')`, 'S/N', 300)
  lines = await sendOrder()
  check('entrega concluída sem GPS (S/N)', [lines.includes('• *Endereço:* Rua das Flores, S/N, Centro — Ref.: portão azul'), lines.some((line) => line.includes('GPS'))], [true, false])

  // --- GPS anexado e troca para retirar / comer no local: nada de GPS ou endereço na comanda ---
  await run(`__geo('ok'); __nominatim(${JSON.stringify(NOMINATIM)})`)
  await click(`__q('[data-gps-capture]')`, 800)
  await choose('retirada')
  lines = await sendOrder()
  check(
    'comanda da retirada (com GPS anexado antes): local da loja, frete zero, sem GPS nem endereço',
    [
      lines.slice(lines.indexOf('👤 *DADOS DO CLIENTE*'), lines.indexOf(LINE)),
      lines.filter((line) => line.startsWith('🛍️ *Retirada') || line.startsWith('💰')),
      lines.some((line) => line.includes('GPS') || line.includes('Endereço') || line.includes('Frete')),
    ],
    [
      ['👤 *DADOS DO CLIENTE*', '• *Nome:* Cliente Teste', '• *Modalidade:* 🛍️ Retirar no Local (Levar para casa)', '• *Local de retirada:* Rua Francisco Tota, 12 — Teixeira, PB', ''],
      ['🛍️ *Retirada na loja:* Grátis (R$ 0,00)', '💰 *TOTAL A PAGAR:* *R$ 3,00*'],
      false,
    ],
  )
  await choose('local')
  lines = await sendOrder()
  check(
    'comanda de comer no local: modalidade em destaque, local, frete zero, sem GPS nem endereço',
    [
      lines.slice(lines.indexOf('👤 *DADOS DO CLIENTE*'), lines.indexOf(LINE)),
      lines.filter((line) => line.startsWith('🍨 *Consumo') || line.startsWith('💰')),
      lines.some((line) => line.includes('GPS') || line.includes('Endereço') || line.includes('Frete')),
    ],
    [
      ['👤 *DADOS DO CLIENTE*', '• *Nome:* Cliente Teste', '• *Modalidade:* 🍨 COMER NO LOCAL (Deixar pronto para chegada)', '• *Local:* Rua Francisco Tota, 12 — Teixeira, PB', ''],
      ['🍨 *Consumo no local:* Grátis (R$ 0,00)', '💰 *TOTAL A PAGAR:* *R$ 3,00*'],
      false,
    ],
  )
  await choose('entrega')
  check('de volta à entrega: o GPS anexado nesta tela continua', await run(`!!__q('[data-gps="anexado"]')`), true)

  // --- Página recarregada: os dados voltam, o GPS não ---
  await browser.goto(`${baseUrl}/carrinho`, desktop)
  await run(quiet)
  await waitFor(`__q('[data-order-values]')`)
  await sleep(300)
  check('recarregou: modalidade e rua voltam, o GPS não', await run(`[__q('input[value="entrega"]').checked, __field('street').value, !!__q('[data-gps="anexado"]'), !!__q('[data-gps-capture]')]`), [true, 'Rua das Flores', false, true])
  check('computador: sem rolagem lateral', await run(`__noOverflow()`), true)

  // --- Painel de pedidos sem o Supabase: modo de demonstração, só com o Modo Vendedor ---
  await browser.goto(`${baseUrl}/pedidos`, desktop)
  await waitFor(`__q('[data-orders-notice]')`)
  check(
    'painel de pedidos para o cliente (sem login): pede a senha, nenhum pedido',
    await run(`[__q('[data-orders-notice] h2')?.textContent, document.querySelectorAll('[data-order-card]').length]`),
    ['Esta página é do Modo Vendedor', 0],
  )

  // --- Celulares ---
  for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 640 }]) {
    await openCart(viewport)
    const phoneCards = await run(`__cards()`)
    const row = viewport.width >= 390
    check(`${viewport.width} px: ${row ? 'três lado a lado' : 'um por linha'}, sem texto cortado`, [new Set(phoneCards.map((card) => card.top)).size, phoneCards.some((card) => card.cut)], [row ? 1 : 3, false])
    await choose('entrega')
    await run(`__geo('ok'); __nominatim(${JSON.stringify(NOMINATIM)})`)
    await click(`__q('[data-gps-capture]')`, 900)
    check(`${viewport.width} px: GPS anexado e sem rolagem lateral`, await run(`[!!__q('[data-gps="anexado"]'), __noOverflow()]`), [true, true])
    await shot(`${viewport.width}-entrega-gps`)
    await choose('local')
    check(`${viewport.width} px: cartão de comer no local sem rolagem lateral`, await run(`[!!__q('[data-store-place="local"]'), __noOverflow()]`), [true, true])
    await shot(`${viewport.width}-comer-no-local`)
    await choose('retirada')
    await shot(`${viewport.width}-retirar`)
  }

  const problems = browser.consoleProblems()
  check('sem erros no console', problems, [])
} finally {
  browser.close()
  await site.close()
}

console.log(`${checks - failures.length}/${checks} conferências passaram. Fotos em ${outDir}`)
if (failures.length) {
  console.log(failures.map((failure) => `FALHA ${failure}`).join('\n'))
  process.exit(1)
}
