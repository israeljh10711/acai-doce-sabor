// Seção "pedidos": acompanhamento do cliente, situação ao vivo (Realtime), acréscimo de itens no
// mesmo pedido, aviso "ding-dong" e destaque no painel do vendedor, e o painel /pedidos (fila,
// busca, tempo, filtros, avançar, voltar etapa, concluir com confirmação, cancelar). Só os 3 pedidos
// de teste criados na seção "cliente" (no projeto de TESTE).
import { PREFIX, sleep } from './harness.mjs'

const FAKE_AUDIO = `
  window.__notes = [];
  class FakeAudio {
    constructor() { this.state = 'suspended'; this.currentTime = 0; this.destination = {}; this.listeners = []; }
    addEventListener(type, listener) { this.listeners.push(listener); }
    resume() { this.state = 'running'; this.listeners.forEach((listener) => listener()); return Promise.resolve(); }
    createOscillator() { const osc = { type: 'sine', frequency: { value: 0 }, connect: (node) => node, start: () => { window.__notes.push(osc.type + ':' + osc.frequency.value) }, stop() {} }; return osc; }
    createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} }, connect: (node) => node }; }
  }
  Object.defineProperty(window, 'AudioContext', { value: FakeAudio, configurable: true });
  Object.defineProperty(window, 'webkitAudioContext', { value: FakeAudio, configurable: true });
`
const HELP = `
  window.__card = (code) => __q('[data-order-card="' + code + '"]');
  window.__codes = () => [...document.querySelectorAll('[data-order-card]')].map((card) => card.dataset.orderCard);
  window.__step = (key) => __q('[data-step="' + key + '"]')?.dataset.stepState ?? null;
  true;
`

export default async function pedidos({ db, site, seller, customer, state, ok }) {
  const [o1, o2, o3] = ['entrega', 'retirada', 'local'].map((kind) => state.orders.findLast((order) => order.kind === kind))
  const s = seller
  const c = customer
  const sRun = async (expression) => (await s.run(HELP), s.run(expression))
  const cRun = async (expression) => (await c.run(HELP), c.run(expression))
  const sWait = async (condition, timeout) => (await s.run(HELP), s.waitFor(condition, timeout))
  const cWait = async (condition, timeout) => (await c.run(HELP), c.waitFor(condition, timeout))
  const status = async (order) => (await db.one('orders', `id=eq.${order.id}&select=status`))?.status

  // ------------------------------------------------------------------ painel do vendedor
  await s.send('Page.addScriptToEvaluateOnNewDocument', { source: FAKE_AUDIO })
  await s.goto(`${site.url}/pedidos`)
  await sWait(`__q('[data-order-card]')`, 20000)
  await s.realClick(`__q('[data-sound-unlock]') ?? __q('[data-orders-sound-on]') ?? __button('🔔 Ativar som')`, 600).catch(() => undefined)
  ok('painel abre em "Em andamento", do mais antigo para o mais novo', (await sRun(`__codes().join()`)) === [o1.code, o2.code, o3.code].join() && (await sRun(`__q('[data-orders-filter="andamento"]')?.getAttribute('aria-pressed') === 'true' || __q('[data-orders-filter="andamento"]')?.getAttribute('aria-current') === 'true' || __q('[data-orders-filter="andamento"]')?.dataset.active !== undefined`)), await sRun(`__codes().join()`))
  ok('painel ao vivo ("🟢 Ao vivo")', await sWait(`__q('[data-orders-live]')?.dataset.ordersLive === 'live'`, 20000))
  ok('cada pedido mostra "Há N min"', await sRun(`__all('[data-order-elapsed]').length === 3 && __all('[data-order-elapsed]').every((el) => /Há (menos de 1|\\d+) min/.test(el.textContent))`), await sRun(`__all('[data-order-elapsed]').map((el) => el.textContent).join(' | ')`))
  const search = async (text) => {
    await s.set('[data-orders-search]', text)
    await sleep(500)
    return sRun(`__codes().join()`)
  }
  ok('busca pelo código inteiro', (await search(o2.code)) === o2.code)
  ok('busca pelo código parcial, sem diferenciar maiúsculas', (await search(o1.code.slice(0, 6).toLowerCase())).split(',').length === 3)
  ok('busca pelo nome parcial ("cliente ret")', (await search('cliente ret')) === o2.code)
  ok('busca sem resultado: lista vazia', (await search('zzzz-e2e')) === '')
  ok('limpar a busca: a fila volta na mesma ordem', (await search('')) === [o1.code, o2.code, o3.code].join())
  ok('contato do cliente: link do WhatsApp com o telefone (não aberto)', /^https:\/\/wa\.me\/55\d{10,11}/.test((await sRun(`__card('${o1.code}').querySelector('[data-order-whatsapp]')?.href ?? ''`)) ?? ''))
  ok('entrega com GPS: link do mapa no cartão', ((await sRun(`__card('${o1.code}').querySelector('[data-order-gps] a, a[data-order-gps]')?.href ?? __card('${o1.code}').querySelector('a[href*="google.com/maps"]')?.href ?? ''`)) ?? '').includes('google.com/maps'))
  await s.shot('06-painel-pedidos-de-teste')

  // ------------------------------------------------------------------ acompanhamento do cliente
  await c.goto(`${site.url}/acompanhar/${o1.code}`)
  ok('acompanhamento: código, itens, total R$ 20,00 e "Pedido recebido"', await cWait(`__text(document.body).includes('${o1.code}') && __text(__q('[data-order-items]'))?.includes('${PREFIX}Monte-Seu-Sorvete') && __text(__q('[data-order-total]')) === 'R$ 20,00' && __step('recebido') === 'current'`, 20000), await cRun(`__text(__q('[data-order-total]'))`))
  ok('acompanhamento (entrega): previsão de entrega e o troco', await cRun(`!!__q('[data-tracking-forecast]') && __text(__q('[data-order-payment]'))?.includes('R$ 50,00')`))
  await c.goto(`${site.url}/acompanhar/${o1.code}`)
  ok('recarregar: o acesso continua pela sessão deste aparelho', await cWait(`__text(__q('[data-order-total]')) === 'R$ 20,00'`, 20000))
  await c.goto(`${site.url}/acompanhar/${o2.code}`)
  ok('acompanhamento do pedido Pix: cartão do Pix com o total R$ 18,00', await cWait(`__text(__q('[data-tracking-pix]'))?.includes('R$ 18,00') && __text(__q('[data-tracking-pix]')).includes('529.982.247-25')`, 20000))
  await c.goto(`${site.url}/acompanhar/${o1.code}`)
  await cWait(`__step('recebido') === 'current'`, 20000)

  // ------------------------------------------------------------------ situação ao vivo
  const notesStart = await sRun(`window.__notes.length`)
  await s.click(`__card('${o1.code}').querySelector('[data-order-next]')`, 900)
  ok('avançar: "preparando" no banco', (await status(o1)) === 'preparando')
  ok('cliente ao vivo (sem recarregar): "🍨 Preparando seu pedido"', await cWait(`__step('preparando') === 'current'`, 20000))
  ok('mudar a situação não toca o aviso de itens acrescentados', (await sRun(`window.__notes.length`)) === notesStart && !(await sRun(`!!__q('[data-added-notice]')`)))

  // ------------------------------------------------------------------ acréscimo de itens
  await c.click(`__q('[data-add-items]')`, 700)
  ok('"➕ Adicionar mais itens": cardápio com a faixa do modo de adição', await cWait(`__text(__q('[data-add-mode-banner]'))?.includes('${o1.code}')`, 15000))
  await c.run(`localStorage.setItem('acai-doce-sabor:carrinho', JSON.stringify({ v: 2, items: [{ kind: 'extra', id: 'add1', itemId: '${state.products.DIRETO}', choices: [], quantity: 1 }] })); true`)
  await c.goto(`${site.url}/carrinho`)
  ok('painel de acréscimo: novos itens R$ 4,00, sem frete novo, novo total R$ 24,00', await cWait(`__text(__q('[data-add-values]'))?.includes('NOVO TOTAL R$ 24,00')`, 15000), await cRun(`__text(__q('[data-add-values]'))`))
  const ordersBefore = (await db.rows('orders', 'select=id')).length
  const notesBeforeAdd = await sRun(`window.__notes.length`)
  await c.click(`__q('[data-add-confirm]')`, 600)
  ok('acréscimo confirmado: volta ao acompanhamento com o aviso', await cWait(`location.pathname === '/acompanhar/${o1.code}' && __text(__q('[data-order-success="itens"]'))?.startsWith('✅ Itens adicionados ao pedido #${o1.code}!')`, 20000))
  const after = await db.one('orders', `id=eq.${o1.id}&select=total_cents,subtotal_cents,items,additions,status`)
  ok(
    'no banco: o MESMO pedido, 1 lote, total 24,00, itens originais e preços intactos, nenhum pedido novo',
    after.total_cents === 2400 && after.additions.length === 1 && after.items.length === 2 && after.items.some((item) => item.unit_cents === 1200) && (await db.rows('orders', 'select=id')).length === ordersBefore,
    JSON.stringify({ total: after.total_cents, lotes: after.additions.length, itens: after.items.length }),
  )
  ok('o cliente vê o total novo e os itens acrescentados', await cWait(`__text(__q('[data-order-total]')) === 'R$ 24,00' && __text(__q('[data-order-addition]'))?.includes('${PREFIX}Produto-Direto')`, 15000))
  ok('vendedor: destaque "➕ Novos itens adicionados" no cartão certo', await sWait(`__card('${o1.code}')?.matches('[data-order-added]') && __text(__card('${o1.code}')).includes('Novos itens adicionados')`, 20000))
  ok('vendedor: aviso "🔔 Novos itens adicionados ao pedido"', await sRun(`__text(__q('[data-added-notice="${o1.code}"]'))?.includes('Novos itens adicionados ao pedido ${o1.code}')`))
  const ding = (await sRun(`window.__notes.slice(${notesBeforeAdd})`)) ?? []
  ok('vendedor: o "ding-dong" toca uma vez (2 notas)', ding.length === 2, JSON.stringify(ding))
  await s.click(`__card('${o1.code}').querySelector('[data-added-seen]')`, 700)
  ok('"✓ Visto": o destaque e o aviso saem', !(await sRun(`__card('${o1.code}').matches('[data-order-added]') || !!__q('[data-added-notice="${o1.code}"]')`)))
  const notesBeforeReload = await sRun(`window.__notes.length`)
  await s.goto(`${site.url}/pedidos`)
  await sWait(`__q('[data-order-card]')`, 20000)
  await sleep(2500)
  ok('reconectar (recarregar o painel): nenhum aviso repetido', !(await sRun(`!!__q('[data-added-notice]')`)) && (await sRun(`window.__notes.length`)) <= notesBeforeReload)

  // ------------------------------------------------------------------ etapas: avançar, voltar, concluir
  await s.click(`__card('${o1.code}').querySelector('[data-order-next]')`, 900)
  ok('entrega: "saiu para entrega" no banco e no cliente', (await status(o1)) === 'saiu_para_entrega' && (await cWait(`__step('pronto') === 'current'`, 20000)))
  await s.click(`__card('${o1.code}').querySelector('[data-order-back]')`, 900)
  ok('"↩ Voltar etapa": volta a "preparando" no banco e no cliente', (await status(o1)) === 'preparando' && (await cWait(`__step('preparando') === 'current'`, 20000)))
  await s.click(`__card('${o1.code}').querySelector('[data-order-next]')`, 900)
  await s.click(`__card('${o1.code}').querySelector('[data-order-next="concluido"]')`, 400)
  ok('"✅ Concluir" pede confirmação ("Deseja realmente concluir este pedido?")', await sRun(`__text(__card('${o1.code}').querySelector('[data-order-conclude-ask]'))?.includes('Deseja realmente concluir este pedido?')`))
  await s.click(`__card('${o1.code}').querySelector('[data-order-conclude-cancel]')`, 600)
  ok('"✅ Concluir" e depois "não": nada muda', (await status(o1)) === 'saiu_para_entrega')
  await s.click(`__card('${o1.code}').querySelector('[data-order-next="concluido"]')`, 400)
  await s.click(`__card('${o1.code}').querySelector('[data-order-conclude-confirm]')`, 900)
  ok('"✅ Concluir" confirmado: "concluido" no banco e no cliente', (await status(o1)) === 'concluido' && (await cWait(`__step('fim') === 'done' || __step('fim') === 'current'`, 20000)))
  const events = await db.rows('order_events', `order_id=eq.${o1.id}&kind=eq.status&select=status&order=id`)
  ok('histórico (order_events) do pedido 1 na ordem, sem repetir', events.map((event) => event.status).join() === 'novo,preparando,saiu_para_entrega,preparando,saiu_para_entrega,concluido', events.map((event) => event.status).join())

  // Retirada: avançar até pronto e concluir com toque duplo no "Sim".
  await s.click(`__card('${o2.code}').querySelector('[data-order-next]')`, 900)
  await s.click(`__card('${o2.code}').querySelector('[data-order-next]')`, 900)
  ok('retirada: "pronto para retirada" no banco', (await status(o2)) === 'pronto_retirada')
  await s.click(`__card('${o2.code}').querySelector('[data-order-next="concluido"]')`, 400)
  await sRun(`(() => { const b = __card('${o2.code}').querySelector('[data-order-conclude-confirm]'); b.click(); b.click(); return true })()`)
  await sleep(1500)
  const doneEvents = await db.rows('order_events', `order_id=eq.${o2.id}&status=eq.concluido&select=id`)
  ok('toque duplo em "Concluir": conclui uma vez só', (await status(o2)) === 'concluido' && doneEvents.length === 1, `${doneEvents.length} evento(s)`)

  // Local: cancelar.
  await s.click(`__card('${o3.code}').querySelector('[data-order-cancel]')`, 400)
  await s.click(`__card('${o3.code}').querySelector('[data-order-cancel-confirm]') ?? __q('[data-order-cancel-confirm]')`, 900)
  ok('cancelar: "cancelado" no banco', (await status(o3)) === 'cancelado')
  await c.goto(`${site.url}/acompanhar/${o3.code}`)
  ok('o cliente vê o pedido cancelado', await cWait(`/cancelado/i.test(__text(document.body))`, 20000))

  // Filtros.
  await s.goto(`${site.url}/pedidos`)
  await sWait(`__q('[data-orders-filter]')`, 20000)
  await sleep(1500)
  ok('"Em andamento": vazio (os 3 de teste saíram da fila)', (await sRun(`__codes().length`)) === 0)
  await s.click(`__q('[data-orders-filter="todos"]')`, 700)
  ok('"Todos": os 3 pedidos de teste', [o1.code, o2.code, o3.code].every((code) => true) && (await sRun(`[${JSON.stringify([o1.code, o2.code, o3.code])}].flat().every((code) => __codes().includes(code))`)))
  await s.click(`__q('[data-orders-filter="concluidos"]')`, 700)
  ok('"Concluídos": os 2 concluídos', (await sRun(`['${o1.code}', '${o2.code}'].every((code) => __codes().includes(code))`)))
  ok('console do vendedor sem erros nesta seção', s.problems().length === 0, JSON.stringify(s.problems()).slice(0, 300))
  ok('console do cliente sem erros nesta seção', c.problems().length === 0, JSON.stringify(c.problems()).slice(0, 300))
}
