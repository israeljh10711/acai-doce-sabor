// Seção "configuracoes": Configurações da loja no projeto de TESTE. Guarda a foto do que estava
// gravado (settings/loja) antes de mudar; a seção "limpeza" devolve exatamente isso e confere no banco.
// Também o backup v2 (arquivo baixado de verdade) e a restauração (só no projeto de teste).
import { existsSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { OUT, PREFIX, sleep } from './harness.mjs'

export default async function configuracoes({ secrets, db, site, seller, customer, state, ok, record }) {
  const settingsRow = async () => (await db.one('catalog_changes', 'kind=eq.settings&id=eq.loja&select=data'))?.data ?? null
  if (!('settingsSnapshot' in state)) {
    state.settingsSnapshot = await settingsRow()
    record('foto das configurações antes de mudar (para devolver no fim)', 'PASS', state.settingsSnapshot === null ? 'nenhuma linha settings/loja (padrão)' : 'linha settings/loja guardada')
  }
  const { DIRETO } = state.products
  const openSettings = async () => {
    await seller.goto(`${site.url}/vendedor?aba=loja`)
    await seller.waitFor(`__q('[data-admin-store]')`)
  }
  const save = async () => {
    await seller.click(`__q('[data-save]')`, 600)
    await seller.waitFor(`__q('[data-save-ok]') || __q('[data-save-error]')`, 15000)
  }

  // ------------------------------------------------------------------ identidade
  await openSettings()
  const storeName = `${PREFIX}Loja`
  await seller.set('#loja-name', storeName)
  await seller.set('#loja-slogan', 'Slogan da auditoria E2E')
  await seller.set('#loja-instagram', 'e2e_teste')
  await seller.set('#loja-phone', '83 3333-4444')
  ok('identidade: "Há alterações não salvas."', await seller.waitFor(`__q('[data-dirty]')`))
  await save()
  let saved = await settingsRow()
  ok('identidade: "Alterações salvas com sucesso" e gravada no banco', (await seller.run(`__q('[data-save-ok]')?.textContent`)) === 'Alterações salvas com sucesso' && saved?.identity?.name === storeName && saved.identity.instagram === 'e2e_teste' && saved.identity.phone === '(83) 3333-4444', JSON.stringify(saved?.identity))
  await openSettings()
  ok('identidade continua depois de recarregar', (await seller.run(`[__q('#loja-name').value, __q('#loja-slogan').value]`)).join('|') === `${storeName}|Slogan da auditoria E2E`)
  await customer.goto(`${site.url}/`)
  ok('loja: o nome novo no cabeçalho do cliente', await customer.waitFor(`__q('header')?.textContent.includes(${JSON.stringify(storeName)})`, 15000))

  // ------------------------------------------------------------------ Pix
  await seller.run(`__set(__q('#loja-pixType'), 'cpf')`)
  await seller.set('#loja-pixKey', '123')
  await save()
  ok('Pix: CPF curto é recusado com o motivo, sem gravar', (await seller.run(`__q('[data-save-error]')?.textContent`)) === 'O CPF tem 11 números.' && (await settingsRow())?.pix?.key !== '123')
  await seller.set('#loja-pixKey', '529.982.247-25')
  await seller.set('#loja-pixHolder', 'Recebedor Teste E2E')
  await save()
  saved = await settingsRow()
  ok('Pix: tipo CPF, chave e titular de teste gravados', saved?.pix?.type === 'cpf' && saved.pix.key === '529.982.247-25' && saved.pix.holder === 'Recebedor Teste E2E', JSON.stringify(saved?.pix))

  // ------------------------------------------------------------------ formas de pagamento
  // Desliga o Cartão (só clica se estiver ligado: a seção pode rodar de novo).
  if (await seller.run(`__q('input[name="pagamento-cartao"]').checked`)) await seller.click(`__q('input[name="pagamento-cartao"]')`, 200)
  await save()
  ok('Cartão desligado no banco', (await settingsRow())?.payments?.cartao === false)

  // ------------------------------------------------------------------ bairros
  await seller.click(`__q('input[name="loja-frete"][value="taxas"]')`, 200)
  // Começa sem bairros (a seção pode rodar de novo).
  while (await seller.run(`!!__q('[data-zone]')`)) await seller.click(`__button('Remover', __q('[data-zone]'))`, 150)
  await seller.click(`__q('[data-add-zone]')`, 200)
  await seller.set('#bairro-0-nome', `${PREFIX}Bairro`)
  await seller.set('#bairro-0-taxa', '4,00')
  await seller.click(`__q('[data-add-zone]')`, 200)
  await seller.set('#bairro-1-nome', `${PREFIX}Bairro Desligado`)
  await seller.set('#bairro-1-taxa', '6,00')
  await seller.click(`__switch('Ligado', __q('[data-zone="1"]'))`, 200)
  await save()
  saved = await settingsRow()
  const zones = saved?.delivery?.zones ?? []
  ok('bairros: taxa por bairro, R$ 4,00 ligado e R$ 6,00 desligado no banco', saved?.delivery?.mode === 'taxas' && zones.length === 2 && zones[0].feeCents === 400 && zones[1].active === false, JSON.stringify(saved?.delivery))
  state.zone = zones[0]
  // Cada gravação manda as configurações inteiras: os bairros gravados aqui não podem voltar a ser
  // os de antes em nenhuma gravação seguinte (achado da auditoria E2E, 2026-11-21).
  const zoneIds = JSON.stringify(zones.map((zone) => zone.id))
  const zonesKept = async (step) => {
    const now = JSON.stringify(((await settingsRow())?.delivery?.zones ?? []).map((zone) => zone.id))
    const cached = await seller.run(`JSON.stringify(JSON.parse(localStorage.getItem('acai_doce_sabor_catalog_cache_v1') ?? 'null')?.settings?.loja?.delivery?.zones?.map((zone) => zone.id) ?? null)`)
    ok(`bairros continuam os gravados depois de: ${step}`, now === zoneIds, `banco ${now} · aparelho ${cached}`)
  }

  // ------------------------------------------------------------------ horário por dia
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'short' }).format(Date.now()))
  if (await seller.run(`__switch('Mesmo horário todos os dias').checked`)) await seller.click(`__switch('Mesmo horário todos os dias')`, 300)
  // Hoje só com um período (a seção pode rodar de novo).
  while (await seller.run(`__q('[data-day="${weekday}"]').querySelectorAll('input[type=time]').length > 2`)) await seller.click(`__button('Tirar período', __q('[data-day="${weekday}"]'))`, 150)
  const dayInputs = `[...__q('[data-day="${weekday}"]').querySelectorAll('input[type=time]')]`
  await seller.run(`(() => { const [open, close] = ${dayInputs}; __set(open, '05:00'); __set(close, '11:00'); return true })()`)
  await seller.click(`__button('+ Outro período', __q('[data-day="${weekday}"]'))`, 200)
  await seller.run(`(() => { const inputs = ${dayInputs}; __set(inputs[2], '12:00'); __set(inputs[3], '00:00'); return true })()`)
  await save()
  saved = await settingsRow()
  const today = saved?.week?.[weekday]
  ok('horário por dia: hoje com 2 períodos (5h–11h e 12h–0h) no banco', today?.open === true && today.periods.length === 2 && today.periods[1].closesAt === 1440, JSON.stringify(today))
  await zonesKept('salvar o horário')
  await openSettings()
  ok('horário por dia continua depois de recarregar', await seller.run(`!__switch('Mesmo horário todos os dias').checked && ${dayInputs}.length === 4`))
  await customer.goto(`${site.url}/`)
  const dayName = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][weekday]
  ok(`rodapé do cliente mostra o horário de hoje (${dayName}: 5h às 11h e 12h às 0h)`, await customer.waitFor(`__q('footer')?.textContent.includes('${dayName}: 5h às 11h e 12h às 0h')`, 15000))

  // ------------------------------------------------------------------ o cliente no carrinho
  const cart = JSON.stringify({ v: 2, items: [{ kind: 'extra', id: 'e2e-c1', itemId: DIRETO, choices: [], quantity: 1 }] })
  await customer.run(`localStorage.setItem('acai-doce-sabor:carrinho', ${JSON.stringify(cart)}); sessionStorage.setItem('acai-doce-sabor:ofertas', JSON.stringify({ bag: [], last: null, dismissed: 3, stopped: true })); true`)
  await customer.send('Browser.grantPermissions', { origin: site.url, permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] }).catch(() => undefined)
  await customer.goto(`${site.url}/carrinho`)
  await customer.waitFor(`__q('[data-finalize]')`, 15000)
  ok('checkout: sem Cartão, só Pix e Dinheiro', (await customer.run(`__all('input[name="forma-de-pagamento"]').map((input) => input.value).join()`)) === 'pix,dinheiro')
  await customer.click(`__q('input[name="forma-de-pagamento"][value="pix"]')`, 300)
  ok('checkout: cartão do Pix com o tipo, a chave e o titular de teste', await customer.waitFor(`(() => { const t = __text(__q('[data-pix-card]')); return t.includes('CPF') && t.includes('529.982.247-25') && t.includes('Recebedor Teste E2E') })()`))
  await customer.realClick(`__q('[data-pix-copy]')`, 800)
  const copied = await customer.run(`navigator.clipboard.readText().catch(() => null)`)
  ok('"Copiar chave Pix": "Chave Pix copiada!" e a chave na área de transferência', (await customer.run(`__text(__q('[data-pix-card]')).includes('Chave Pix copiada!')`)) && copied === '529.982.247-25', String(copied))
  await customer.click(`__q('input[type="radio"][value="entrega"]')`, 400)
  const zoneOptions = await customer.run(`[...__q('select[data-field="zone"]').options].map((option) => option.textContent)`)
  ok('entrega: o bairro ligado com a taxa e "Outro bairro"; o desligado não aparece', zoneOptions.some((text) => text.includes(`${PREFIX}Bairro — R$ 4,00`)) && !zoneOptions.some((text) => text.includes('Desligado')) && zoneOptions.some((text) => text.startsWith('Outro bairro')), JSON.stringify(zoneOptions))
  await customer.shot('03-checkout-configuracoes-de-teste')

  // Cartão de volta (os pedidos de teste usam as 3 formas).
  await openSettings()
  if (!(await seller.run(`__q('input[name="pagamento-cartao"]').checked`))) await seller.click(`__q('input[name="pagamento-cartao"]')`, 200)
  await save()
  ok('Cartão ligado de novo no banco', (await settingsRow())?.payments?.cartao === true)
  await zonesKept('recarregar a página e ligar o Cartão')

  // ------------------------------------------------------------------ fechamento temporário
  await seller.click(`__q('input[name="loja-fechada"][value="bloquear"]')`, 200)
  await save()
  await seller.click(`__q('[data-store-close]')`, 1500)
  saved = await settingsRow()
  ok('"Fechar agora": exceção "fechada" e "não aceitar pedidos" no banco', saved?.override?.state === 'closed' && saved.closedOrders === 'bloquear', JSON.stringify(saved?.override))
  await zonesKept('"Fechar agora"')
  await customer.goto(`${site.url}/carrinho`)
  await customer.waitFor(`__q('[data-finalize]')`, 15000)
  ok('cliente: botão "Loja fechada: pedidos bloqueados", desligado', (await customer.run(`[__q('[data-finalize]').textContent.trim(), __q('[data-finalize]').disabled].join('|')`)) === 'Loja fechada: pedidos bloqueados|true')
  const closedTry = await fetch(`${secrets.url}/functions/v1/pedido`, {
    method: 'POST',
    headers: { apikey: secrets.publicKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ cart, customer: { name: `${PREFIX}Cliente Loja Fechada`, phone: '', kind: 'retirada', street: '', number: '', district: '', zoneId: null, reference: '', gps: null }, payment: { method: 'pix', changeFor: '', exact: false }, expectedTotalCents: 400 }),
  })
  const closedBody = await closedTry.json()
  ok('servidor: pedido com a loja fechada é recusado ("loja-fechada"), sem gravar', closedBody.ok === false && closedBody.reason === 'loja-fechada', JSON.stringify(closedBody))
  await openSettings()
  await seller.click(`__q('[data-store-normal]')`, 1500)
  await seller.click(`__q('input[name="loja-fechada"][value="antecipado"]')`, 200)
  await save()
  saved = await settingsRow()
  ok('"Voltar ao horário" e "aceitar antecipado": sem exceção no banco', !saved?.override && saved?.closedOrders === 'antecipado', JSON.stringify({ override: saved?.override, closedOrders: saved?.closedOrders }))
  await zonesKept('"Voltar ao horário"')
  await customer.goto(`${site.url}/carrinho`)
  await customer.waitFor(`__q('[data-finalize]')`, 15000)
  ok('cliente: o botão de finalizar volta', (await customer.run(`__q('[data-finalize]').textContent.trim()`)) !== 'Loja fechada: pedidos bloqueados')

  // ------------------------------------------------------------------ backup v2 (arquivo baixado)
  await seller.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: OUT })
  // Tira os backups baixados antes (o navegador sobrescreve o arquivo de mesmo nome).
  for (const old of readdirSync(OUT).filter((name) => name.startsWith('acai-doce-sabor-backup-'))) rmSync(join(OUT, old))
  const existing = new Set(readdirSync(OUT))
  await seller.goto(`${site.url}/monte-seu-pedido`)
  await seller.waitFor(`__q('[data-seller-bar]')`)
  await seller.click(`__button('Backup / Restaurar')`, 700)
  await seller.click(`__button('Baixar backup', __dialog())`, 2500)
  const file = readdirSync(OUT).find((name) => name.startsWith('acai-doce-sabor-backup-') && !existing.has(name))
  const text = file && existsSync(join(OUT, file)) ? readFileSync(join(OUT, file), 'utf8') : ''
  let backup = null
  try {
    backup = JSON.parse(text)
  } catch {
    backup = null
  }
  ok('backup: o navegador baixou um arquivo .json não vazio, com "Backup baixado."', Boolean(file) && text.length > 1000 && (await seller.run(`__text(__dialog()).includes('Backup baixado.')`)), `${file} (${text.length} bytes)`)
  ok('backup: versão 2, com o cardápio (produtos de teste) e as configurações da loja', backup?.v === 2 && backup.catalog?.products?.some((product) => product.id === DIRETO) && backup.changes?.settings?.loja?.identity?.name === storeName)
  const forbidden = [secrets.serverKey, secrets.publicKey, secrets.seller.password, secrets.dbPassword, 'access_token', 'refresh_token', 'sb_secret_', 'customer_name', 'orders']
  ok('backup: sem chaves, senhas, tokens nem dados de pedidos', !forbidden.some((value) => value && text.includes(value)))
  // Restaurar o mesmo arquivo (só no projeto de TESTE): as configurações ficam iguais.
  const beforeRestore = JSON.stringify(await settingsRow())
  const { root } = await seller.send('DOM.getDocument', { depth: -1, pierce: true })
  const { nodeIds } = await seller.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: 'dialog[open] input[type=file]' })
  await seller.send('DOM.setFileInputFiles', { nodeId: nodeIds.at(-1), files: [join(OUT, file).replaceAll('\\', '/')] })
  await seller.waitFor(`__text(__dialog())?.includes('Backup restaurado.')`, 15000)
  ok('restaurar o backup (projeto de teste): "Backup restaurado." e as configurações iguais no banco', (await seller.run(`__text(__dialog()).includes('Backup restaurado.')`)) && JSON.stringify(await settingsRow()) === beforeRestore)
  ok('backup: o arquivo traz os bairros gravados nesta seção (nunca uma cópia velha)', JSON.stringify((backup?.changes?.settings?.loja?.delivery?.zones ?? []).map((zone) => zone.id)) === zoneIds)
  await zonesKept('baixar e restaurar o backup')
  await seller.run(`__dialog()?.close(); true`)
  await sleep(300)
  ok('console do vendedor sem erros nesta seção', seller.problems().length === 0, JSON.stringify(seller.problems()).slice(0, 300))
  ok('console do cliente sem erros nesta seção', customer.problems().length === 0, JSON.stringify(customer.problems()).slice(0, 300))
}
