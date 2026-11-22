// Seção "cliente": a loja como o cliente usa, num navegador sem login, ligada ao projeto de TESTE:
// navegação, busca, foto ampliada, personalizador do produto de teste (mínimo, máximo, grátis e
// preço extra), Completo e SEM, carrinho (quantidade, observação, editar, remover) e 3 pedidos de
// teste pela função "pedido" de verdade (entrega com GPS e troco, retirada com Pix, consumo no local
// com cartão). Cada pedido é conferido no banco do projeto de teste.
import { PREFIX, sleep } from './harness.mjs'

const QUIET = `sessionStorage.setItem('acai-doce-sabor:ofertas', JSON.stringify({ bag: [], last: null, dismissed: 3, stopped: true })); true`
const EXTRA = `
  window.__itemButton = (id) => __q('[data-item="' + id + '"] button:not([data-zoom]):not([data-seller-edit]):not([data-seller-stock]):not([data-seller-duplicate]), [data-item="' + id + '"] a');
  window.__options = () => __q('dialog[aria-labelledby="opcoes-item-titulo"]');
  window.__confirm = () => __q('dialog[role="alertdialog"]');
  window.__in = (dialog, text) => [...dialog.querySelectorAll('button')].find((b) => b.textContent.includes(text));
  window.__cartCount = () => Number((__q('header a[href="/carrinho"]')?.textContent.match(/[0-9]+/) ?? ['0'])[0]);
  window.__topping = (label) => [...document.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent.trim()) === label);
  window.__values = () => __q('[data-order-values]')?.innerText.replace(/\\s+/g, ' ') ?? '';
  window.__cartItem = (text) => [...document.querySelectorAll('[aria-label="Itens do carrinho"] > li')].find((li) => li.textContent.includes(text));
  true;
`

export default async function cliente({ db, site, customer, state, ok }) {
  const { MONTAVEL, SABORES_PRODUTO, DIRETO, CATEGORY } = state.products
  const c = customer
  const run = async (expression) => {
    await c.run(EXTRA)
    return c.run(expression)
  }
  const waitFor = async (condition, timeout = 12000) => {
    await c.run(EXTRA)
    return c.waitFor(condition, timeout)
  }
  const click = async (expression, pause = 400) => {
    await c.run(EXTRA)
    return c.click(expression, pause)
  }
  const fresh = async (path, viewport) => {
    await c.goto(`${site.url}${path}`, viewport)
    await c.run(QUIET)
    await c.run(EXTRA)
  }

  // ------------------------------------------------------------------ começo limpo
  await fresh('/')
  await run(`localStorage.removeItem('acai-doce-sabor:carrinho'); localStorage.removeItem('acai_doce_sabor_meus_dados_v1'); sessionStorage.clear(); ${QUIET}`)

  // ------------------------------------------------------------------ navegação e busca
  await fresh('/monte-seu-pedido')
  await waitFor(`__q('[data-item="${DIRETO}"]')`, 20000)
  ok('menu lateral: a categoria de teste aparece com o nome renomeado', await run(`[...document.querySelectorAll('nav[aria-label="Categorias do cardápio"] a, nav[aria-label="Categorias do cardápio"] button')].some((el) => el.textContent.includes('${PREFIX}Sorvetes Renomeada'))`))
  await c.set('#busca-cardapio', 'E2E-ACAI')
  await sleep(600)
  ok('busca parcial "E2E-ACAI": só os 3 produtos de teste', (await run(`__all('[data-item]').map((el) => el.dataset.item).filter((id, i, list) => list.indexOf(id) === i).sort().join()`)) === [DIRETO, MONTAVEL, SABORES_PRODUTO].sort().join())
  await c.set('#busca-cardapio', 'zzzz-nada-e2e')
  await sleep(600)
  ok('busca sem resultado: nenhum item e o aviso', (await run(`__all('[data-item]').length === 0 && document.body.textContent.includes('zzzz-nada-e2e')`)))
  await c.set('#busca-cardapio', '')
  await sleep(600)
  ok('limpar a busca: os itens voltam', await waitFor(`__all('[data-item]').length > 40`))
  await click(`__q('[data-item="${DIRETO}"] [data-zoom]')`, 800)
  ok('foto ampliada abre', await waitFor(`__q('dialog[aria-labelledby="foto-ampliada-titulo"]')?.open`))
  await c.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
  await c.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
  ok('foto ampliada fecha (Esc)', await waitFor(`!__q('dialog[aria-labelledby="foto-ampliada-titulo"]')?.open`))
  ok('rodapé: "Meus pedidos" leva ao acompanhamento', (await run(`__q('[data-footer-orders]')?.getAttribute('href')`)) === '/acompanhar')

  // ------------------------------------------------------------------ personalizador do produto de teste
  await fresh(`/monte-seu-pedido/${MONTAVEL}`)
  ok('personalizador do produto montável de teste abre', await waitFor(`__q('h1')?.textContent.includes('${PREFIX}Monte-Seu-Sorvete')`, 15000))
  await click(`__q('input[value="2-bolas"]')`, 400)
  const sabores = (name) => `${PREFIX}Sabor ${name}`
  const coberturas = (name) => `${PREFIX}Cobertura ${name}`
  ok(
    'mínimo do grupo: "Falta escolher pelo menos 1 em ...Sabores de Sorvete" e o botão desligado (aria-disabled)',
    await waitFor(`__q('#resumo-falta')?.textContent.includes('pelo menos 1 em ${PREFIX}Sabores de Sorvete') && __button('Adicionar ao carrinho')?.getAttribute('aria-disabled') === 'true'`),
    await run(`__q('#resumo-falta')?.textContent`),
  )
  await click(`__button('Adicionar ao carrinho')`, 500)
  ok('com o mínimo faltando, o toque no botão não abre a confirmação nem põe no carrinho', await run(`!__confirm()?.open && __cartCount() === 0`))
  await click(`__topping(${JSON.stringify(sabores('Chocolate'))})`, 250)
  await click(`__topping(${JSON.stringify(sabores('Morango'))})`, 250)
  const third = await run(`(() => { const b = __topping(${JSON.stringify(sabores('Creme'))}); return b.disabled || b.getAttribute('aria-disabled') === 'true' })()`)
  ok('máximo do grupo (2): o terceiro sabor fica bloqueado', third)
  await click(`__topping(${JSON.stringify(coberturas('A'))})`, 250)
  await click(`__topping(${JSON.stringify(coberturas('B'))})`, 250)
  ok('2 coberturas grátis: total R$ 12,00', await waitFor(`__text(__q('#resumo')).includes('R$ 12,00')`))
  await click(`__topping(${JSON.stringify(coberturas('C'))})`, 250)
  ok('3ª cobertura: + R$ 2,00 de preço extra, total R$ 14,00', await waitFor(`__text(__q('#resumo')).includes('R$ 14,00') && __text(__q('#resumo')).includes('além das grátis')`), await run(`__text(__q('#resumo')).slice(-200)`))
  await c.shot('04-personalizador-produto-de-teste')
  await click(`__button('Adicionar ao carrinho')`, 600)
  await waitFor(`__confirm()?.open`)
  await click(`__in(__confirm(), 'continuar comprando')`, 600)
  ok('montável de teste no carrinho', await waitFor(`__cartCount() === 1`))

  // ------------------------------------------------------------------ produto com sabores e direto
  await fresh('/monte-seu-pedido')
  await waitFor(`__q('[data-item="${SABORES_PRODUTO}"]')`, 20000)
  await click(`__itemButton('${SABORES_PRODUTO}')`, 600)
  await waitFor(`__options()?.open`)
  ok('produto com sabores: o esgotado (Coco) aparece desligado', await run(`[...__options().querySelectorAll('input[type=radio]')].find((input) => input.value === 'Coco')?.disabled === true`))
  await click(`[...__options().querySelectorAll('input[type=radio]')].find((input) => input.value === 'Uva')`, 200)
  await click(`__in(__options(), 'Continuar')`, 600)
  await waitFor(`__confirm()?.open`)
  await click(`__in(__confirm(), 'continuar comprando')`, 600)
  await click(`__itemButton('${DIRETO}')`, 600)
  ok('produto direto: vai direto para a confirmação, sem escolhas', await waitFor(`__confirm()?.open && !__options()?.open`))
  await click(`__in(__confirm(), 'continuar comprando')`, 600)
  ok('produto com sabores e produto direto no carrinho', await waitFor(`__cartCount() === 3`))

  // ------------------------------------------------------------------ Completo e SEM (açaí da semente)
  await fresh('/monte-seu-pedido/acai-oca')
  await waitFor(`__q('input[value="pote-200"]')`)
  await click(`__q('input[value="pote-200"]')`, 400)
  await click(`[...__q('[data-complete-bar]').querySelectorAll('button')].find((b) => b.textContent.trim().startsWith('Completo'))`, 700)
  await click(`__topping('Tirar Granola')`, 500)
  ok('Completo sem a granola: "COMPLETO (SEM: Granola)" por R$ 10,00', await waitFor(`__text(__q('#resumo')).includes('SEM: Granola') && __text(__q('#resumo')).includes('R$ 10,00')`), await run(`__text(__q('#resumo')).slice(0, 160)`))
  await click(`__button('Adicionar ao carrinho')`, 600)
  await waitFor(`__confirm()?.open`)
  await click(`__in(__confirm(), 'continuar comprando')`, 600)
  ok('4 itens no carrinho', await waitFor(`__cartCount() === 4`))

  // ------------------------------------------------------------------ carrinho
  await fresh('/carrinho')
  await waitFor(`__q('[data-finalize]')`, 15000)
  ok('carrinho: 4 itens e subtotal R$ 36,00 (14 + 8 + 4 + 10)', await waitFor(`__all('[aria-label="Itens do carrinho"] > li').length === 4 && __values().includes('Subtotal R$ 36,00')`), await run(`__values()`))
  await click(`__cartItem('${PREFIX}Produto-Direto').querySelector('[aria-label="Aumentar quantidade"]')`, 500)
  ok('quantidade + 1 no produto direto: R$ 40,00, sem mudar os outros itens', await waitFor(`__values().includes('Subtotal R$ 40,00')`))
  await click(`__cartItem('${PREFIX}Produto-Direto').querySelector('[aria-label="Diminuir quantidade"]')`, 500)
  ok('quantidade - 1: volta a R$ 36,00', await waitFor(`__values().includes('Subtotal R$ 36,00')`))
  await click(`__cartItem('${PREFIX}Monte-Seu-Sorvete').querySelector('[data-note-add]')`, 300)
  await c.set('[data-note-input]', 'Observação E2E: pouco açúcar')
  await sleep(500)
  // Guardar o carrinho montado pela tela para os pedidos 2 e 3.
  const cartJson = await run(`localStorage.getItem('acai-doce-sabor:carrinho')`)
  const items = JSON.parse(cartJson).items
  state.uiCartItems = items
  await fresh('/carrinho')
  ok('a observação continua depois de recarregar', (await run(`__q('[data-note-input]')?.value`)) === 'Observação E2E: pouco açúcar')
  // Editar o montável: tirar a 3ª cobertura (R$ 12,00), sem mexer nos outros.
  await click(`[...__cartItem('${PREFIX}Monte-Seu-Sorvete').querySelectorAll('a')].find((a) => a.textContent.includes('Editar'))`, 900)
  await waitFor(`__button('Salvar alterações')`)
  await click(`__topping(${JSON.stringify(coberturas('C'))})`, 300)
  await click(`__button('Salvar alterações')`, 900)
  await fresh('/carrinho')
  ok('editar o montável: subtotal R$ 34,00 e os outros 3 itens iguais', await waitFor(`__values().includes('Subtotal R$ 34,00') && __all('[aria-label="Itens do carrinho"] > li').length === 4`), await run(`__values()`))
  // Remover 2 itens (ficam montável e direto para a entrega).
  await click(`[...__cartItem('${PREFIX}Produto-Sabores').querySelectorAll('button')].find((b) => b.textContent.includes('Remover'))`, 600)
  await click(`[...__cartItem('Açaí Oca').querySelectorAll('button')].find((b) => b.textContent.includes('Remover'))`, 600)
  ok('remover 2 itens: ficam 2, subtotal R$ 16,00 (12 + 4)', await waitFor(`__all('[aria-label="Itens do carrinho"] > li').length === 2 && __values().includes('Subtotal R$ 16,00')`), await run(`__values()`))

  // ------------------------------------------------------------------ pedido 1: entrega
  await click(`__q('[data-remember-me]')`, 200)
  await c.set('input[autocomplete="name"]', `${PREFIX}Cliente Entrega`)
  await click(`__q('input[type="radio"][value="entrega"]')`, 500)
  await c.set('[data-field="street"]', 'Rua Teste E2E')
  await c.set('[data-field="number"]', '1')
  // Outro bairro: telefone obrigatório.
  await run(`__set(__q('select[data-field="zone"]'), 'outro')`)
  await sleep(300)
  await c.set('[data-field="district"]', 'Bairro Inexistente E2E')
  await c.set('[data-field="phone"]', '')
  await click(`__q('input[name="forma-de-pagamento"][value="pix"]')`, 300)
  const beforeBlocked = c.calls(0, '/functions/v1/pedido').length
  await click(`__q('[data-finalize]')`, 800)
  ok(
    'frete a combinar sem telefone: não finaliza, o aviso no campo, nada enviado ao servidor',
    (await run(`location.pathname === '/carrinho' && __q('[data-field="phone"]').getAttribute('aria-invalid') === 'true' && document.body.textContent.includes('A loja entrará em contato para confirmar o valor da entrega.')`)) &&
      c.calls(0, '/functions/v1/pedido').length === beforeBlocked,
  )
  await c.set('[data-field="phone"]', '(83) 98888-0001')
  await run(`(() => { const select = __q('select[data-field="zone"]'); return __set(select, [...select.options].find((option) => option.textContent.startsWith('${PREFIX}Bairro')).value) })()`)
  await sleep(400)
  ok('bairro com taxa: Entrega R$ 4,00 e total R$ 20,00', await waitFor(`__values().includes('R$ 4,00') && __values().includes('TOTAL R$ 20,00')`), await run(`__values()`))
  // GPS negado: aviso e o endereço continua.
  await run(`(() => { Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: (ok, fail) => setTimeout(() => fail({ code: 1, message: 'negado', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 }), 50) } }); return true })()`)
  await click(`__q('[data-gps-capture]')`, 900)
  ok('GPS negado: aviso, e o endereço digitado continua valendo', await waitFor(`__q('[data-gps-error]') && __q('[data-field="street"]').value === 'Rua Teste E2E'`))
  await run(`(() => { Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: (ok) => setTimeout(() => ok({ coords: { latitude: -7.2219, longitude: -37.2540, accuracy: 12 }, timestamp: Date.now() }), 50) } }); return true })()`)
  await click(`__q('[data-gps-capture]')`, 1200)
  ok('GPS permitido: localização anexada (mapa)', await waitFor(`__q('[data-gps-map]')`))
  await click(`__q('input[name="forma-de-pagamento"][value="dinheiro"]')`, 300)
  await c.set('#troco-para', '10')
  ok('troco menor que o total: aviso', await waitFor(`document.body.textContent.includes('O valor informado é menor que o total do pedido (R$ 20,00)')`))
  await c.set('#troco-para', '50')
  ok('troco para R$ 50,00: levar R$ 30,00', await waitFor(`[...document.querySelectorAll('p[aria-live]')].some((p) => p.textContent.includes('R$ 30,00'))`))
  await c.shot('05-checkout-entrega')
  const placeOrder = async () => {
    const since = Date.now()
    await click(`__q('[data-finalize]')`, 600)
    await waitFor(`location.pathname.startsWith('/acompanhar/')`, 30000)
    const code = decodeURIComponent((await run(`location.pathname`)).split('/').pop())
    const calls = c.calls(since, '/functions/v1/pedido').filter((call) => call.method === 'POST')
    return { code, calls }
  }
  const first = await placeOrder()
  const order1 = await db.one('orders', `code=eq.${first.code}&select=*`)
  if (order1) state.orders.push({ id: order1.id, code: order1.code, kind: 'entrega' })
  ok('pedido 1 (entrega): POST /functions/v1/pedido 200 e o acompanhamento abre', first.calls.some((call) => call.status === 200) && Boolean(order1), `${first.code} ${JSON.stringify(first.calls.map((call) => call.status))}`)
  ok(
    'pedido 1 no banco: entrega, bairro R$ 4,00, subtotal 16,00, total 20,00, dinheiro com troco 50,00, GPS e sessão do cliente',
    order1?.fulfillment === 'entrega' && order1.delivery_fee_cents === 400 && order1.delivery_zone === `${PREFIX}Bairro` && order1.subtotal_cents === 1600 && order1.total_cents === 2000 && order1.payment_method === 'dinheiro' && order1.change_for_cents === 5000 && order1.customer_lat !== null && order1.customer_user_id !== null,
    JSON.stringify(order1 && { f: order1.fulfillment, fee: order1.delivery_fee_cents, sub: order1.subtotal_cents, total: order1.total_cents, pay: order1.payment_method, change: order1.change_for_cents }),
  )
  const snapshot = order1?.items ?? []
  ok(
    'pedido 1: cópia dos itens com nome, tamanho, preço e a observação',
    snapshot.some((item) => item.name === `${PREFIX}Monte-Seu-Sorvete (Copo 2 bolas)` && item.total_cents === 1200 && item.note === 'Observação E2E: pouco açúcar') && snapshot.some((item) => item.name === `${PREFIX}Produto-Direto` && item.unit_cents === 400),
    JSON.stringify(snapshot),
  )
  ok('pedido 1: a comanda leva os sabores e as coberturas escolhidos', ['Sabor Chocolate', 'Sabor Morango', 'Cobertura A', 'Cobertura B'].every((part) => order1?.message?.includes(part)))

  // ------------------------------------------------------------------ pedido 2: retirada (dados lembrados)
  const cartOf = (wanted) => JSON.stringify({ v: 2, items: state.uiCartItems.filter((item) => wanted(item)) })
  await run(`localStorage.setItem('acai-doce-sabor:carrinho', ${JSON.stringify(cartOf((item) => item.itemId === SABORES_PRODUTO || item.slug === 'acai-oca'))}); sessionStorage.clear(); ${QUIET}`)
  await fresh('/carrinho')
  await waitFor(`__q('[data-finalize]')`, 15000)
  ok('"Lembrar meus dados": nome, telefone e endereço voltam numa visita nova', (await run(`[__q('input[autocomplete="name"]').value, __q('[data-field="phone"]')?.value].join('|')`)) === `${PREFIX}Cliente Entrega|(83) 98888-0001`)
  await c.set('input[autocomplete="name"]', `${PREFIX}Cliente Retirada`)
  await click(`__q('input[type="radio"][value="retirada"]')`, 500)
  ok('retirada: sem campos de endereço, com o local da loja e sem frete', await run(`!__q('[data-field="street"]') && !!__q('[data-store-place="retirada"]') && !__values().includes('Entrega')`))
  await click(`__q('input[name="forma-de-pagamento"][value="pix"]')`, 300)
  ok('retirada: total R$ 18,00 (8 + 10)', await waitFor(`__values().includes('TOTAL R$ 18,00')`), await run(`__values()`))
  const second = await placeOrder()
  const order2 = await db.one('orders', `code=eq.${second.code}&select=*`)
  if (order2) state.orders.push({ id: order2.id, code: order2.code, kind: 'retirada' })
  ok('pedido 2 no banco: retirada, sem frete, Pix, total 18,00, Completo sem granola na comanda', order2?.fulfillment === 'retirada' && order2.delivery_fee_cents === 0 && order2.payment_method === 'pix' && order2.total_cents === 1800 && order2.message?.includes('*Montagem:* COMPLETO') && order2.message.includes('*RETIRAR (SEM):* Granola'), `${second.code}`)

  // ------------------------------------------------------------------ pedido 3: consumo no local
  await run(`localStorage.setItem('acai-doce-sabor:carrinho', ${JSON.stringify(cartOf((item) => item.itemId === DIRETO))}); ${QUIET}`)
  await fresh('/carrinho')
  await waitFor(`__q('[data-finalize]')`, 15000)
  await c.set('input[autocomplete="name"]', `${PREFIX}Cliente Local`)
  await click(`__q('input[type="radio"][value="local"]')`, 500)
  await click(`__q('input[name="forma-de-pagamento"][value="credito"]')`, 300)
  ok('consumo no local: sem endereço e sem frete, total R$ 4,00 (oferta)', await waitFor(`!__q('[data-field="street"]') && __values().includes('TOTAL R$ 4,00')`), await run(`__values()`))
  const third3 = await placeOrder()
  const order3 = await db.one('orders', `code=eq.${third3.code}&select=*`)
  if (order3) state.orders.push({ id: order3.id, code: order3.code, kind: 'local' })
  ok('pedido 3 no banco: local, cartão de crédito, total 4,00 (preço da oferta pelo servidor)', order3?.fulfillment === 'local' && order3.payment_method === 'credito' && order3.total_cents === 400 && order3.items?.[0]?.unit_cents === 400, `${third3.code}`)

  // ------------------------------------------------------------------ esquecer os dados
  await run(`localStorage.setItem('acai-doce-sabor:carrinho', ${JSON.stringify(cartOf((item) => item.itemId === DIRETO))}); ${QUIET}`)
  await fresh('/carrinho')
  await waitFor(`__q('[data-remember-me]')`, 15000)
  if (await run(`__q('[data-remember-me]').checked`)) await click(`__q('[data-remember-me]')`, 400)
  ok('desmarcar "Lembrar meus dados" apaga os dados guardados', (await run(`localStorage.getItem('acai_doce_sabor_meus_dados_v1')`)) === null)
  // Sem o rascunho da aba (sessionStorage), para valer só o que está guardado no aparelho.
  await run(`localStorage.setItem('acai_doce_sabor_meus_dados_v1', '{quebrado'); sessionStorage.clear(); ${QUIET}`)
  await fresh('/carrinho')
  ok('dados guardados estragados: o carrinho abre normal, com os campos vazios', (await waitFor(`__q('[data-finalize]')`, 15000)) && (await run(`__q('input[autocomplete="name"]').value === ''`)))
  await run(`localStorage.removeItem('acai_doce_sabor_meus_dados_v1'); localStorage.removeItem('acai-doce-sabor:carrinho'); true`)

  // ------------------------------------------------------------------ celular e tablet
  for (const viewport of [{ width: 390, height: 844, mobile: true }, { width: 768, height: 1024, mobile: true }]) {
    await fresh('/monte-seu-pedido', viewport)
    await waitFor(`__q('[data-item="${DIRETO}"]')`, 20000)
    ok(`${viewport.width}px: loja sem rolagem lateral`, await run(`__noOverflow()`))
    if (viewport.width < 1024) {
      await click(`__q('button[aria-label^="Categorias"]') ?? [...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith('Categorias'))`, 700)
      ok(`${viewport.width}px: menu Categorias abre com a categoria de teste`, await waitFor(`[...document.querySelectorAll('dialog[open] a, dialog[open] button, [role="dialog"] a, [role="dialog"] button')].some((el) => el.textContent.includes('${PREFIX}Sorvetes Renomeada'))`))
      await c.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
    }
    await fresh(`/monte-seu-pedido/${MONTAVEL}`, viewport)
    ok(`${viewport.width}px: personalizador do produto de teste sem rolagem lateral`, (await waitFor(`__q('h1')`)) && (await run(`__noOverflow()`)))
  }
  await c.goto(`${site.url}/`)

  // ------------------------------------------------------------------ aviso de ofertas
  await run(`sessionStorage.clear(); true`)
  await c.goto(`${site.url}/monte-seu-pedido`)
  const offerShown = await waitFor(`__q('[data-offer]')`, 30000)
  ok('aviso flutuante de oferta aparece para o cliente', offerShown, offerShown ? await run(`__text(__q('[data-offer]')).slice(0, 120)`) : '')
  void CATEGORY
  ok('console do cliente sem erros nesta seção', c.problems().length === 0, JSON.stringify(c.problems()).slice(0, 300))
}
