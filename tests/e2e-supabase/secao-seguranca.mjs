// Seção "seguranca": o RLS e a função "pedido" contra quem não deve conseguir. Visitante (chave
// pública) e uma conta logada que NÃO é vendedora tentam gravar no cardápio, nas configurações, nas
// funções e no Storage; e a função recebe pedidos manipulados (todos feitos para serem recusados
// antes de gravar). Esgotar, ocultar, pausar e desligar o pagamento são feitos pela TELA do vendedor
// e desfeitos em seguida.
import { readFileSync } from 'node:fs'
import { PREFIX, passwordToken, publicApi, sleep, testImage } from './harness.mjs'

export default async function seguranca({ secrets, db, site, seller, state, ok }) {
  const { MONTAVEL, DIRETO, OFERTA, COMPLEMENTO } = state.products
  const anon = publicApi(secrets)
  const outsiderToken = await passwordToken(secrets, secrets.outsider.email, secrets.outsider.password)
  const outsider = publicApi(secrets, outsiderToken)
  const denied = (result) => [401, 403].includes(result.status)

  // ------------------------------------------------------------------ RLS: visitante e conta que não é vendedora
  for (const [who, api] of [['visitante', anon], ['conta logada que não é vendedora', outsider]]) {
    const insert = await api('/rest/v1/catalog_categories', { method: 'POST', body: JSON.stringify({ id: 'Id Invalido RLS', name: 'x' }) })
    ok(`${who}: não cria categoria`, denied(insert), `${insert.status} ${insert.body?.code ?? ''}`)
    const priceBefore = (await db.one('catalog_products', `id=eq.${DIRETO}&select=price_cents`)).price_cents
    const update = await api(`/rest/v1/catalog_products?id=eq.${DIRETO}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ price_cents: 1 }) })
    const priceAfter = (await db.one('catalog_products', `id=eq.${DIRETO}&select=price_cents`)).price_cents
    ok(`${who}: não muda o preço de um produto (banco igual)`, (denied(update) || (update.status === 200 && update.body.length === 0)) && priceAfter === priceBefore, `${update.status} ${JSON.stringify(update.body).slice(0, 60)} | ${priceBefore}→${priceAfter}`)
    const offer = await api(`/rest/v1/catalog_offers?id=eq.${OFERTA}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ promo_price_cents: 1 }) })
    ok(`${who}: não muda a oferta (banco igual)`, (denied(offer) || (offer.status === 200 && offer.body.length === 0)) && (await db.one('catalog_offers', `id=eq.${OFERTA}&select=promo_price_cents`)).promo_price_cents === 400)
    const settings = await api('/rest/v1/catalog_changes?on_conflict=kind,id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ kind: 'settings', id: 'loja', data: { identity: { name: 'Invasor' } } }) })
    ok(`${who}: não muda as Configurações da loja`, denied(settings) && (await db.one('catalog_changes', 'kind=eq.settings&id=eq.loja&select=data')).data.identity.name !== 'Invasor', `${settings.status} ${settings.body?.code ?? ''}`)
    const rpc = await api('/rest/v1/rpc/catalogo_salvar_produto', { method: 'POST', body: JSON.stringify({ produto: { id: 'e2e-acai-test-invasor', category_id: 'bebidas', kind: 'direto', name: 'Invasor' } }) })
    ok(`${who}: não executa catalogo_salvar_produto`, denied(rpc) && !(await db.one('catalog_products', 'id=eq.e2e-acai-test-invasor&select=id')), `${rpc.status} ${rpc.body?.message ?? ''}`)
    const order = await api('/rest/v1/rpc/catalogo_ordenar', { method: 'POST', body: JSON.stringify({ lista: 'categorias', ids: ['bebidas'] }) })
    ok(`${who}: não executa catalogo_ordenar`, denied(order), `${order.status}`)
    const upload = await fetch(`${secrets.url}/storage/v1/object/catalogo/fotos/e2e-rls-${who.length}.png`, {
      method: 'POST',
      headers: { apikey: secrets.publicKey, ...(api === outsider ? { Authorization: `Bearer ${outsiderToken}` } : {}), 'Content-Type': 'image/png' },
      body: readFileSync(testImage('e2e-rls')),
    })
    if (upload.ok) state.uploads.push(`fotos/e2e-rls-${who.length}.png`)
    ok(`${who}: não envia foto ao Storage`, !upload.ok, `${upload.status}`)
    const log = await api('/rest/v1/catalog_import_log?select=source_id')
    ok(`${who}: não lê o registro da importação`, denied(log) || (log.status === 200 && log.body.length === 0), `${log.status}`)
  }
  const ordersRead = await outsider('/rest/v1/orders?select=id,code')
  ok('conta que não é vendedora: não lê pedidos', ordersRead.status === 200 && ordersRead.body.length === 0, `${ordersRead.status} ${ordersRead.body?.length}`)
  const someone = state.orders.findLast((entry) => entry.kind === 'entrega')
  const peek = await fetch(`${secrets.url}/functions/v1/pedido`, {
    method: 'POST',
    headers: { apikey: secrets.publicKey, Authorization: `Bearer ${outsiderToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ op: 'consultar', orderId: someone.id }),
  }).then((response) => response.json())
  ok('conta que não é vendedora: não consulta o pedido de outra pessoa pela função', peek.ok === false && peek.reason === 'nao-encontrado', JSON.stringify(peek))

  // ------------------------------------------------------------------ função "pedido": entradas manipuladas
  const ordersBefore = (await db.rows('orders', 'select=id')).length
  const send = async (cart, { expectedTotalCents, customer = {}, payment = { method: 'pix', changeFor: '', exact: false } }) => {
    const body = {
      cart: JSON.stringify({ v: 2, items: cart }),
      customer: { name: `${PREFIX}Cliente Seguranca`, phone: '(83) 98888-0009', kind: 'retirada', street: '', number: '', district: '', zoneId: null, reference: '', gps: null, ...customer },
      payment,
      expectedTotalCents,
    }
    const response = await fetch(`${secrets.url}/functions/v1/pedido`, { method: 'POST', headers: { apikey: secrets.publicKey, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    return response.json()
  }
  const direct = [{ kind: 'extra', id: 's1', itemId: DIRETO, choices: [], quantity: 1 }]
  const montavel = (toppings, sizeId = '2-bolas') => [{ kind: 'product', id: 's2', slug: MONTAVEL, sizeId, flavorId: null, toppings, quantity: 1 }]
  const sabor = (name) => [`e2e-acai-test-sabor-${name}`, 1]
  const cobertura = (name) => [`e2e-acai-test-cobertura-${name}`, 1]

  let r = await send([{ kind: 'extra', id: 'u1', itemId: 'e2e-acai-test-nao-existe', choices: [], quantity: 1 }], { expectedTotalCents: 500 })
  ok('produto que não existe: recusado (item-indisponivel)', r.reason === 'item-indisponivel', JSON.stringify(r))
  r = await send(montavel([sabor('chocolate')], 'nao-existe'), { expectedTotalCents: 1200 })
  ok('tamanho que não existe: recusado', r.reason === 'item-indisponivel', JSON.stringify(r))
  r = await send(montavel([sabor('chocolate'), ['e2e-acai-test-nao-existe', 1]]), { expectedTotalCents: 1200 })
  ok('complemento que não existe: recusado com o nome do item', r.reason === 'item-indisponivel' && String(r.detail).includes('Monte-Seu-Sorvete'), JSON.stringify(r))
  r = await send(montavel([sabor('chocolate'), sabor('morango'), sabor('creme')]), { expectedTotalCents: 1200 })
  ok('escolhas acima do máximo (3 sabores, máximo 2): recusado com o nome do item', r.reason === 'item-indisponivel' && String(r.detail).includes('Monte-Seu-Sorvete'), JSON.stringify(r))
  r = await send(montavel([cobertura('a')]), { expectedTotalCents: 1200 })
  ok('grupo obrigatório sem escolha (nenhum sabor): recusado', r.reason === 'item-indisponivel', JSON.stringify(r))
  r = await send(montavel([sabor('chocolate')]), { expectedTotalCents: 100 })
  ok('preço manipulado (R$ 1,00): recusado com o total certo (R$ 12,00) e o preço de cada item', r.reason === 'total-mudou' && r.totalCents === 1200 && r.items?.[0]?.totalCents === 1200, JSON.stringify(r))
  r = await send(montavel([sabor('chocolate'), cobertura('a'), cobertura('b'), cobertura('c')]), { expectedTotalCents: 1200 })
  ok('preço extra do grupo não pode ser pulado: recusado com R$ 14,00', r.reason === 'total-mudou' && r.totalCents === 1400, JSON.stringify(r))
  const zone = state.zone
  r = await send(direct, { expectedTotalCents: 400, customer: { kind: 'entrega', street: 'Rua E2E', number: '9', zoneId: zone.id } })
  ok('frete manipulado (o cliente manda o total sem o frete): recusado com o frete do bairro (R$ 8,00)', r.reason === 'total-mudou' && r.totalCents === 800, JSON.stringify(r))
  r = await send(direct, { expectedTotalCents: 800, customer: { kind: 'entrega', street: 'Rua E2E', number: '9', zoneId: 'bairro-que-nao-existe' } })
  ok('bairro que não existe: recusado (dados-invalidos)', r.reason === 'dados-invalidos', JSON.stringify(r))

  // Pela tela do vendedor: esgotar, ocultar, pausar, desligar pagamento (e desfazer).
  const toggleProduct = async (attribute) => {
    await seller.goto(`${site.url}/vendedor?aba=produtos`)
    await seller.waitFor(`__q('[data-product="${DIRETO}"]')`, 15000)
    await seller.click(`__q('[data-product="${DIRETO}"] [${attribute}]')`, 1500)
  }
  await toggleProduct('data-toggle-available')
  r = await send(direct, { expectedTotalCents: 400 })
  ok('produto esgotado (pela tela): recusado com o nome', r.reason === 'esgotado' && String(r.detail).includes('Produto-Direto'), JSON.stringify(r))
  await toggleProduct('data-toggle-available')
  await toggleProduct('data-toggle-visible')
  r = await send(direct, { expectedTotalCents: 400 })
  ok('produto oculto (pela tela): recusado (item-indisponivel)', r.reason === 'item-indisponivel', JSON.stringify(r))
  await toggleProduct('data-toggle-visible')
  ok('produto de volta: disponível e visível no banco', JSON.stringify(await db.one('catalog_products', `id=eq.${DIRETO}&select=available,visible`)) === '{"available":true,"visible":true}')

  await seller.goto(`${site.url}/vendedor?aba=complementos`)
  await seller.waitFor(`__q('[data-option="${COMPLEMENTO}"]')`, 15000)
  await seller.click(`__q('[data-option="${COMPLEMENTO}"] [data-toggle-option]')`, 1500)
  r = await send(montavel([sabor('chocolate'), [COMPLEMENTO, 1]]), { expectedTotalCents: 1450 })
  ok('complemento esgotado (pela tela): recusado com o nome do complemento', r.reason === 'esgotado' && String(r.detail).includes('Complemento'), JSON.stringify(r))
  await seller.click(`__q('[data-option="${COMPLEMENTO}"] [data-toggle-option]')`, 1500)

  await seller.goto(`${site.url}/vendedor?aba=ofertas`)
  await seller.waitFor(`__q('[data-offer="${OFERTA}"]')`, 15000)
  await seller.click(`__q('[data-offer="${OFERTA}"] [data-toggle-offer]')`, 1500)
  r = await send(direct, { expectedTotalCents: 400 })
  ok('oferta pausada (pela tela): o servidor cobra o preço normal (R$ 5,00)', r.reason === 'total-mudou' && r.totalCents === 500, JSON.stringify(r))
  await seller.click(`__q('[data-offer="${OFERTA}"] [data-toggle-offer]')`, 1500)
  ok('oferta reativada no banco', (await db.one('catalog_offers', `id=eq.${OFERTA}&select=status`)).status === 'ativa')

  await seller.goto(`${site.url}/vendedor?aba=loja`)
  await seller.waitFor(`__q('[data-admin-store]')`, 15000)
  if (await seller.run(`__q('input[name="pagamento-dinheiro"]').checked`)) await seller.click(`__q('input[name="pagamento-dinheiro"]')`, 200)
  await seller.click(`__q('[data-save]')`, 600)
  await seller.waitFor(`__q('[data-save-ok]')`, 15000)
  r = await send(direct, { expectedTotalCents: 400, payment: { method: 'dinheiro', changeFor: '', exact: true } })
  ok('forma de pagamento desligada (Dinheiro, pela tela): recusada pelo servidor', r.reason === 'pagamento-invalido' && String(r.detail).includes('Dinheiro'), JSON.stringify(r))
  await seller.goto(`${site.url}/vendedor?aba=loja`)
  await seller.waitFor(`__q('[data-admin-store]')`, 15000)
  if (!(await seller.run(`__q('input[name="pagamento-dinheiro"]').checked`))) await seller.click(`__q('input[name="pagamento-dinheiro"]')`, 200)
  await seller.click(`__q('[data-save]')`, 600)
  await seller.waitFor(`__q('[data-save-ok]')`, 15000)
  ok('Dinheiro ligado de novo no banco', (await db.one('catalog_changes', 'kind=eq.settings&id=eq.loja&select=data')).data.payments.dinheiro === true)

  await sleep(500)
  ok('nenhum pedido foi gravado pelas tentativas manipuladas', (await db.rows('orders', 'select=id')).length === ordersBefore)
  ok('console do vendedor sem erros nesta seção', seller.problems().length === 0, JSON.stringify(seller.problems()).slice(0, 300))
}
