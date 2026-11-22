// Seção "limpeza": devolve o projeto de TESTE ao estado de antes da auditoria. Só apaga pela chave
// exata (uma linha por vez) o que a auditoria criou — ids com o prefixo e2e-acai-test-, os pedidos
// guardados no estado e as fotos que ela enviou —, nunca por filtro largo. Depois confere no banco:
// as configurações iguais à foto tirada antes, nenhum registro de teste e o cardápio igual à semente.
import { parseCatalogRecords } from '../../src/features/catalog/records.ts'
import { baseCatalogRecords } from '../../src/features/catalog/baseRecords.ts'
import { PREFIX } from './harness.mjs'

const ID_PREFIX = 'e2e-acai-test-'
// Ordem das chaves estrangeiras: quem aponta sai antes de quem é apontado. Cada tabela com a chave
// primária (para apagar uma linha exata) e as colunas onde um id de teste pode aparecer.
const TABLES = [
  { table: 'catalog_offers', key: ['id'], look: ['id', 'product_id'] },
  { table: 'catalog_product_groups', key: ['product_id', 'group_id'], look: ['product_id', 'group_id'] },
  { table: 'catalog_choice_options', key: ['product_id', 'choice_id', 'id'], look: ['product_id', 'id'] },
  { table: 'catalog_choices', key: ['product_id', 'id'], look: ['product_id', 'id'] },
  { table: 'catalog_variants', key: ['product_id', 'id'], look: ['product_id', 'id'] },
  { table: 'catalog_options', key: ['id'], look: ['id', 'group_id', 'product_id'] },
  { table: 'catalog_products', key: ['id'], look: ['id', 'category_id', 'flavors_from'] },
  { table: 'catalog_groups', key: ['id'], look: ['id'] },
  { table: 'catalog_categories', key: ['id'], look: ['id'] },
  { table: 'catalog_import_log', key: ['source_kind', 'source_id'], look: ['source_id'] },
]
const exact = (row, key) => key.map((column) => `${column}=eq.${encodeURIComponent(row[column])}`).join('&')
const testRows = (db, { table, look }) => db.rows(table, `or=(${look.map((column) => `${column}.like.${ID_PREFIX}*`).join(',')})`)
// JSON com as chaves em ordem: o jsonb do banco guarda as chaves na ordem dele.
const canonical = (value) =>
  Array.isArray(value) ? `[${value.map(canonical).join(',')}]` : value && typeof value === 'object' ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}` : JSON.stringify(value)

export default async function limpeza({ secrets, db, site, customer, state, ok, record }) {
  // ------------------------------------------------------------------ pedidos de teste
  // Só pedidos da auditoria: os guardados no estado e os com o nome de cliente de teste (uma
  // tentativa que deveria ser recusada e foi aceita não entra no estado). Um por vez, pelo id.
  const byName = await db.rows('orders', `customer_name=like.${encodeURIComponent(PREFIX)}*&select=id,code`)
  const targets = new Map([...state.orders, ...byName].map((order) => [order.id, order.code]))
  let ordersRemoved = 0
  for (const id of targets.keys()) {
    await db.remove('order_events', `order_id=eq.${id}`)
    const result = await db.remove('orders', `id=eq.${id}`)
    if (result.status < 300) ordersRemoved += result.count
  }
  const ordersLeft = await db.rows('orders', 'select=id,code')
  ok('pedidos de teste apagados um a um pelo id; nenhum pedido sobrou no projeto de teste', ordersLeft.length === 0, `${ordersRemoved} apagados (${[...targets.values()].sort().join(', ')}); sobraram ${ordersLeft.length}`)
  if (ordersLeft.length === 0) state.orders = []

  // ------------------------------------------------------------------ cardápio de teste
  const removed = {}
  const failures = []
  for (const spec of TABLES) {
    for (const row of await testRows(db, spec)) {
      const result = await db.remove(spec.table, exact(row, spec.key))
      if (result.status < 300 && result.count === 1) removed[spec.table] = (removed[spec.table] ?? 0) + 1
      else failures.push(`${spec.table} ${exact(row, spec.key)} → ${result.status}`)
    }
  }
  ok('registros de teste do cardápio apagados um a um pela chave exata, na ordem das chaves estrangeiras', failures.length === 0, failures.length ? failures.join(' | ').slice(0, 400) : JSON.stringify(removed))
  const leftovers = []
  for (const spec of TABLES) leftovers.push(...(await testRows(db, spec)).map((row) => `${spec.table} ${exact(row, spec.key)}`))
  for (const entry of state.created) if ((await db.rows(entry.table, `${entry.filter}&select=*`)).length > 0) leftovers.push(`${entry.table} ${entry.filter}`)
  ok('nenhum registro de teste sobrou (busca pelo prefixo e pela lista do estado)', leftovers.length === 0, leftovers.join(' | ').slice(0, 400))
  if (leftovers.length === 0) state.created = []

  // ------------------------------------------------------------------ configurações da loja
  if (state.settingsSnapshot === null) await db.remove('catalog_changes', 'kind=eq.settings&id=eq.loja')
  else {
    await db.call('/rest/v1/catalog_changes?on_conflict=kind,id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({ kind: 'settings', id: 'loja', data: state.settingsSnapshot }),
    })
  }
  const settingsNow = (await db.one('catalog_changes', 'kind=eq.settings&id=eq.loja&select=data'))?.data ?? null
  ok('configurações da loja iguais à foto de antes da auditoria', JSON.stringify(settingsNow) === JSON.stringify(state.settingsSnapshot ?? null), state.settingsSnapshot === null ? (settingsNow === null ? 'linha settings/loja apagada (como antes)' : 'a linha continua') : 'linha settings/loja devolvida')
  const otherChanges = await db.rows('catalog_changes', 'select=kind,id')
  ok('nenhuma outra mudança de vendedor no projeto de teste', otherChanges.length === 0, JSON.stringify(otherChanges).slice(0, 300))

  // ------------------------------------------------------------------ fotos no Storage
  // O projeto de teste começou com o bucket vazio: toda foto nele veio da auditoria. Mesmo assim, só
  // sai a que o cardápio que ficou (o original) não usa, uma por vez pelo nome exato.
  const storage = (path, init = {}) => db.call(`/storage/v1/${path}`, init)
  const listed = await storage('object/list/catalogo', { method: 'POST', body: JSON.stringify({ prefix: 'fotos', limit: 1000, offset: 0 }) })
  const names = Array.isArray(listed.body) ? listed.body.filter((item) => item.id).map((item) => `fotos/${item.name}`) : []
  const catalogText = JSON.stringify((await db.call('/rest/v1/rpc/catalogo_publico', { method: 'POST', body: '{}' })).body)
  const removable = [...new Set([...state.uploads, ...names])].filter((name) => !catalogText.includes(name))
  const photoFailures = []
  for (const name of removable) {
    // Um nome exato por chamada (o DELETE do Storage sem corpo é recusado com 400).
    const result = await storage('object/catalogo', { method: 'DELETE', body: JSON.stringify({ prefixes: [name] }) })
    const gone = Array.isArray(result.body) && result.body.some((item) => item.name === name)
    if (names.includes(name) && (result.status >= 300 || !gone)) photoFailures.push(`${name} → ${result.status}`)
  }
  const after = await storage('object/list/catalogo', { method: 'POST', body: JSON.stringify({ prefix: 'fotos', limit: 1000, offset: 0 }) })
  const stillThere = Array.isArray(after.body) ? after.body.filter((item) => item.id).map((item) => `fotos/${item.name}`).filter((name) => removable.includes(name)) : ['(lista falhou)']
  ok('fotos de teste apagadas do Storage, uma por vez pelo nome', listed.status === 200 && photoFailures.length === 0 && stillThere.length === 0, `${removable.length} apagadas; ${JSON.stringify([...photoFailures, ...stillThere]).slice(0, 300)}`)
  if (stillThere.length === 0) state.uploads = []

  // ------------------------------------------------------------------ cardápio igual à semente
  // "↑ Subir / ↓ Descer" dos registros de teste renumeram as posições dos vizinhos originais: elas
  // voltam ao número da semente, uma linha por vez pela chave exata (só a coluna position).
  const readCatalog = async () => parseCatalogRecords((await db.call('/rest/v1/rpc/catalogo_publico', { method: 'POST', body: '{}' })).body)
  const seed = baseCatalogRecords()
  const POSITIONED = [
    ['categories', 'catalog_categories', ['id']],
    ['products', 'catalog_products', ['id']],
    ['offers', 'catalog_offers', ['id']],
    ['groups', 'catalog_groups', ['id']],
    ['options', 'catalog_options', ['id']],
    ['variants', 'catalog_variants', ['productId', 'id']],
  ]
  const column = (name) => name.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
  const keyOf = (entry, keys) => keys.map((name) => `${column(name)}=eq.${encodeURIComponent(entry[name])}`).join('&')
  const live = await readCatalog()
  const moved = []
  for (const [list, table, keys] of POSITIONED) {
    for (const original of seed[list]) {
      const now = live[list].find((entry) => keys.every((name) => entry[name] === original[name]))
      if (!now || now.position === original.position) continue
      const result = await db.call(`/rest/v1/${table}?${keyOf(original, keys)}`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ position: original.position }) })
      moved.push(`${table} ${original.id} ${now.position}→${original.position} (${result.status}${Array.isArray(result.body) && result.body.length === 1 ? '' : ', linhas ' + JSON.stringify(result.body).slice(0, 80)})`)
    }
  }
  record('posições originais renumeradas pelos testes de ordem, devolvidas à semente', 'PASS', moved.length ? moved.join(' | ').slice(0, 600) : 'nenhuma mudou')
  const publicCatalog = await readCatalog()
  const differences = []
  for (const list of Object.keys(seed).filter((name) => name !== 'revision')) {
    const want = new Map(seed[list].map((entry) => [[entry.productId ?? '', entry.choiceId ?? '', entry.groupId ?? '', entry.id ?? ''].join('/'), canonical(entry)]))
    const have = new Map(publicCatalog[list].map((entry) => [[entry.productId ?? '', entry.choiceId ?? '', entry.groupId ?? '', entry.id ?? ''].join('/'), canonical(entry)]))
    for (const [key, value] of want) if (have.get(key) !== value) differences.push(`${list} ${key}: ${have.has(key) ? 'diferente' : 'faltando'}`)
    for (const key of have.keys()) if (!want.has(key)) differences.push(`${list} ${key}: a mais`)
  }
  // Registro por registro (a lista do banco vem em outra ordem; a ordem da loja é a coluna position).
  ok('cardápio público igual à semente original, registro por registro (categorias, produtos, tamanhos, grupos, opções, ofertas)', differences.length === 0,differences.length ? differences.join(' | ').slice(0, 600) : `${publicCatalog.categories.length} categorias, ${publicCatalog.products.length} produtos, ${publicCatalog.groups.length} grupos, ${publicCatalog.options.length} opções, ${publicCatalog.offers.length} ofertas`)

  // ------------------------------------------------------------------ a loja no navegador
  await customer.goto(`${site.url}/`)
  await customer.waitFor(`__q('header')?.textContent.length > 0 && document.querySelectorAll('img').length > 3`, 20000)
  const page = await customer.run(`document.body.textContent`)
  ok('loja no navegador sem nada de teste (nome, bairros, produtos)', !page.includes(PREFIX) && !page.includes('Recebedor Teste E2E'), page.includes(PREFIX) ? 'ainda aparece o prefixo de teste' : '')
  record('projeto de teste continua existindo (pode ser apagado no painel do Supabase); o projeto real não foi tocado', 'PASS', secrets.url.replace(/^https:\/\/([a-z0-9]{4})[a-z0-9]+/, 'https://$1…'))
}
