// Seção "vendedor": login (errado e certo), sessão depois de recarregar, abas do painel, acesso
// direto, e categorias de teste (criar, renomear, Subir/Descer, ocultar, mostrar), conferindo cada
// gravação no banco do projeto de teste.
import { PREFIX, publicApi, sleep } from './harness.mjs'

export default async function vendedor({ secrets, db, site, seller, state, record, ok }) {
  // --- Acesso e login ---
  // Começa como um aparelho novo: o perfil do navegador guarda a sessão de uma rodada anterior.
  await seller.send('Storage.clearDataForOrigin', { origin: site.url, storageTypes: 'local_storage,session_storage,indexeddb,cookies' })
  await seller.goto(`${site.url}/vendedor`)
  ok('/vendedor sem login pede a senha', await seller.waitFor(`__q('[data-admin-login]')`))
  await seller.click(`__button('Entrar no Modo Vendedor')`, 600)
  await seller.waitFor(`__q('#senha-vendedor')`)
  let since = Date.now()
  await seller.set('#senha-vendedor', 'senha-errada-e2e')
  await seller.run(`__q('#senha-vendedor').form.requestSubmit(); true`)
  const wrong = await seller.waitFor(`__q('#senha-vendedor-erro')`)
  const tokenCalls = seller.calls(since, '/auth/v1/token')
  ok('senha errada: "Senha incorreta" e o Auth recusa (400)', wrong && tokenCalls.some((call) => call.status === 400), JSON.stringify(tokenCalls.map((call) => call.status)))
  since = Date.now()
  await seller.set('#senha-vendedor', secrets.seller.password)
  await seller.run(`__q('#senha-vendedor').form.requestSubmit(); true`)
  const logged = await seller.waitFor(`__q('[data-seller-bar]')`, 15000)
  ok(
    'senha certa: Modo Vendedor ligado, "Salvo na nuvem", token 200 e sellers 200',
    logged &&
      (await seller.run(`__text(__q('[data-seller-bar]')).includes('Salvo na nuvem')`)) &&
      seller.calls(since, '/auth/v1/token').some((call) => call.status === 200) &&
      seller.calls(since, '/rest/v1/sellers').some((call) => call.status === 200),
  )
  await seller.shot('01-vendedor-logado')
  await seller.goto(`${site.url}/vendedor`)
  ok('sessão continua depois de recarregar a página', await seller.waitFor(`__q('[data-seller-bar]') && __q('[data-admin-tab]')`))

  // --- Abas ---
  const tabs = { catalogo: '[data-admin-overview]', categorias: '[data-admin-categories]', produtos: '[data-admin-products]', complementos: '[data-admin-complements]', ofertas: '[data-admin-offers]', loja: '[data-admin-store]' }
  for (const [tab, marker] of Object.entries(tabs)) {
    await seller.click(`__q('[data-admin-tab="${tab}"]')`, 500)
    const shown = await seller.waitFor(`__q('${marker}')`)
    const current = await seller.run(`__q('[data-admin-tab="${tab}"]')?.getAttribute('aria-current')`)
    ok(`aba "${tab}" pelo clique: conteúdo carregado e marcada como atual`, shown && current === 'page')
    await seller.goto(`${site.url}/vendedor${tab === 'catalogo' ? '' : `?aba=${tab}`}`)
    ok(`aba "${tab}" por endereço direto e recarregando`, await seller.waitFor(`__q('${marker}')`))
  }
  await seller.click(`[...__all('nav[aria-label="Seções do painel"] a')].find((a) => a.textContent.trim() === 'Pedidos')`, 800)
  ok('aba "Pedidos" abre o painel de pedidos (/pedidos)', await seller.waitFor(`location.pathname === '/pedidos' && (__q('[data-order-card]') || __q('[data-orders-search]') || __q('[data-orders-notice]'))`))
  await seller.goto(`${site.url}/monte-seu-pedido`)
  ok('atalho da faixa "🗂️ Cardápio" leva ao painel', (await seller.run(`__q('[data-admin-link]')?.getAttribute('href')`)) === '/vendedor')

  // --- Categorias ---
  const id = 'e2e-acai-test-sorvetes'
  const name = `${PREFIX}Sorvetes`
  await seller.goto(`${site.url}/vendedor?aba=categorias`)
  await seller.waitFor(`__q('[data-admin-categories]')`)
  since = Date.now()
  await seller.click(`__q('[data-new-category]')`, 500)
  await seller.waitFor(`__q('#categoria-nome')`)
  await seller.set('#categoria-nome', name)
  await seller.set('#categoria-subtitulo', 'Categoria criada pela auditoria E2E.')
  ok('categoria nova: "Há alterações não salvas."', await seller.waitFor(`__q('[data-dirty]')`))
  await seller.click(`__dialog().querySelector('[data-save]')`, 800)
  await seller.waitFor(`__q('[data-category="${id}"]')`)
  const created = await db.one('catalog_categories', `id=eq.${id}&select=id,name,visible,archived_at,layout`)
  state.created.push({ table: 'catalog_categories', filter: `id=eq.${id}` })
  ok(
    'criar categoria: upsert 201 pelo navegador e a linha no banco',
    created?.name === name && created.layout === 'grade' && seller.calls(since, '/rest/v1/catalog_categories').some((call) => call.method === 'POST' && call.status < 300),
    JSON.stringify({ banco: created, rede: seller.calls(since, '/rest/v1/catalog_categories').map((call) => `${call.method} ${call.status}`) }),
  )
  await seller.goto(`${site.url}/vendedor?aba=categorias`)
  ok('categoria continua na lista depois de recarregar', await seller.waitFor(`__q('[data-category="${id}"]')`))

  await seller.click(`__q('[data-category="${id}"] [data-edit-category]')`, 600)
  await seller.waitFor(`__q('#categoria-nome')`)
  await seller.set('#categoria-nome', `${name} Renomeada`)
  await seller.click(`__dialog().querySelector('[data-save]')`, 800)
  const savedText = await seller.waitFor(`__dialog()?.querySelector('[data-save-ok]')?.textContent === 'Alterações salvas com sucesso'`)
  ok('renomear: "Alterações salvas com sucesso" e o nome novo no banco', savedText && (await db.one('catalog_categories', `id=eq.${id}&select=name`))?.name === `${name} Renomeada`)
  await seller.run(`__dialog()?.close(); true`)
  await sleep(400)

  // Ordem: o teste fica por último; "Subir" e "Descer" mudam a posição no banco (catalogo_ordenar).
  const order = async () => (await db.rows('catalog_categories', 'archived_at=is.null&select=id,position&order=position,id')).map((row) => row.id)
  const before = await order()
  since = Date.now()
  await seller.click(`__q('[data-category="${id}"] [data-move="subir"]')`, 1200)
  const afterUp = await order()
  ok(
    '"↑ Subir": catalogo_ordenar pelo navegador e a posição nova no banco',
    afterUp.indexOf(id) === before.indexOf(id) - 1 && seller.calls(since, '/rest/v1/rpc/catalogo_ordenar').some((call) => call.status < 300),
    `${before.indexOf(id)} → ${afterUp.indexOf(id)}`,
  )
  await seller.click(`__q('[data-category="${id}"] [data-move="descer"]')`, 1200)
  const afterDown = await order()
  ok('"↓ Descer": volta à posição de antes', afterDown.indexOf(id) === before.indexOf(id), `${afterUp.indexOf(id)} → ${afterDown.indexOf(id)}`)
  await seller.goto(`${site.url}/vendedor?aba=categorias`)
  await seller.waitFor(`__q('[data-category="${id}"]')`)
  const listed = await seller.run(`__all('[data-category]').map((li) => li.dataset.category)`)
  ok('a ordem continua depois de recarregar', JSON.stringify(listed) === JSON.stringify(afterDown), JSON.stringify(listed.slice(-3)))

  // Ocultar e mostrar.
  await seller.click(`__q('[data-category="${id}"] [data-edit-category]')`, 600)
  await seller.waitFor(`__q('#categoria-nome')`)
  await seller.click(`__switch('Visível na loja', __dialog())`, 200)
  await seller.click(`__dialog().querySelector('[data-save]')`, 900)
  await seller.run(`__dialog()?.close(); true`)
  const hidden = await db.one('catalog_categories', `id=eq.${id}&select=visible`)
  const anon = publicApi(secrets)
  const publicView = await anon('/rest/v1/rpc/catalogo_publico', { method: 'POST', body: '{}' })
  ok('ocultar: visível falso no banco e o visitante não recebe a categoria', hidden?.visible === false && !publicView.body.categories.some((category) => category.id === id))
  await seller.goto(`${site.url}/vendedor?aba=categorias`)
  ok('oculta: continua no painel do vendedor, com o selo "Oculta"', await seller.waitFor(`__text(__q('[data-category="${id}"]'))?.includes('Oculta')`))
  await seller.click(`__q('[data-category="${id}"] [data-edit-category]')`, 600)
  await seller.waitFor(`__q('#categoria-nome')`)
  await seller.click(`__switch('Visível na loja', __dialog())`, 200)
  await seller.click(`__dialog().querySelector('[data-save]')`, 900)
  await seller.run(`__dialog()?.close(); true`)
  const shownAgain = await anon('/rest/v1/rpc/catalogo_publico', { method: 'POST', body: '{}' })
  ok('mostrar de novo: o visitante volta a receber a categoria', shownAgain.body.categories.some((category) => category.id === id))

  // Arquivar categoria com produtos (uma da semente): o botão fica desligado e o banco recusaria.
  await seller.goto(`${site.url}/vendedor?aba=categorias`)
  await seller.waitFor(`__q('[data-category="bebidas"]')`)
  await seller.click(`__q('[data-category="bebidas"] [data-edit-category]')`, 600)
  await seller.waitFor(`__q('[data-category-editor]')`)
  ok(
    'categoria com produtos: "Arquivar" desligado com o motivo (nada é apagado)',
    await seller.run(`__q('[data-archive-category]')?.disabled === true && __text(__q('[data-category-editor]')).includes('Mova ou arquive os produtos antes')`),
  )
  await seller.run(`__dialog()?.close(); true`)
  state.categoryId = id
  // A senha errada de propósito (lá em cima) deixa um único 400 do Auth no console; ele é o esperado.
  const wrongPassword = (entry) => /status of 400/.test(entry.text) && entry.text.includes('/auth/v1/token?grant_type=password')
  const consoleProblems = seller.problems()
  const unexpected = [...consoleProblems.filter((entry) => !wrongPassword(entry)), ...consoleProblems.filter(wrongPassword).slice(1)]
  ok('console do vendedor sem erros nesta seção (fora o 400 esperado da senha errada)', unexpected.length === 0, JSON.stringify(unexpected).slice(0, 300))
}
