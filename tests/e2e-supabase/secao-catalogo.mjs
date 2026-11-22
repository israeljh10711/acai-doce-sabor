// Seção "catalogo": grupos e complementos de teste (com as regras do pedido da auditoria), os 3
// tipos de produto, foto no Storage (enviar, trocar, tirar; SVG recusado), duplicar, esgotar, mudar
// de categoria e uma oferta com preço promocional. Cada gravação é conferida no banco e na loja.
import { PREFIX, publicApi, sleep, svgFile, testImage } from './harness.mjs'

const CATEGORY = 'e2e-acai-test-sorvetes'
const SABORES = 'e2e-acai-test-sabores-de-sorvete'
const COBERTURAS = 'e2e-acai-test-coberturas'
const MONTAVEL = 'e2e-acai-test-monte-seu-sorvete'
const SABORES_PRODUTO = 'e2e-acai-test-produto-sabores'
const DIRETO = 'e2e-acai-test-produto-direto'
const OFERTA = 'e2e-acai-test-oferta'

export default async function catalogo({ secrets, db, site, seller, customer, state, record, ok }) {
  const remember = (table, filter) => {
    if (!state.created.some((entry) => entry.table === table && entry.filter === filter)) state.created.push({ table, filter })
  }
  const saveDialog = async () => {
    await seller.click(`__dialog().querySelector('[data-save]')`, 600)
    await seller.waitFor(`!__dialog() || __dialog().querySelector('[data-save-ok], [data-save-error]')`, 15000)
    await sleep(500)
  }
  const dialogError = () => seller.run(`__dialog()?.querySelector('[data-save-error]')?.textContent ?? null`)

  // ------------------------------------------------------------------ grupos de complementos
  await seller.goto(`${site.url}/vendedor?aba=complementos`)
  await seller.waitFor(`__q('[data-admin-complements]')`)
  const newGroup = async ({ name, rule, min, max, free, extra }) => {
    await seller.click(`__q('[data-new-group]')`, 500)
    await seller.waitFor(`__q('#grupo-nome')`)
    await seller.set('#grupo-nome', name)
    await seller.click(`__q('input[name="regra-grupo"][value="${rule}"]')`, 150)
    await seller.set('#grupo-minimo', String(min))
    await seller.set('#grupo-maximo', String(max))
    if (free !== undefined) {
      await seller.click(`__switch('Cobrar a partir de certa quantidade', __dialog())`, 200)
      await seller.set('#grupo-gratis', String(free))
      await seller.set('#grupo-extra', extra)
    }
    await saveDialog()
  }
  await newGroup({ name: `${PREFIX}Sabores de Sorvete`, rule: 'included', min: 1, max: 2 })
  await newGroup({ name: `${PREFIX}Coberturas`, rule: 'included', min: 0, max: 5, free: 2, extra: '2,00' })
  const groups = await db.rows('catalog_groups', `id=in.(${SABORES},${COBERTURAS})&select=id,name,rule,min_select,max_select,free_count,extra_price_cents`)
  remember('catalog_groups', `id=eq.${SABORES}`)
  remember('catalog_groups', `id=eq.${COBERTURAS}`)
  const sabores = groups.find((group) => group.id === SABORES)
  const coberturas = groups.find((group) => group.id === COBERTURAS)
  ok('grupo "Sabores de Sorvete": mínimo 1, máximo 2 no banco', sabores?.min_select === 1 && sabores.max_select === 2 && sabores.rule === 'included', JSON.stringify(sabores))
  ok('grupo "Coberturas": mínimo 0, máximo 5, 2 grátis e R$ 2,00 cada a mais no banco', coberturas?.min_select === 0 && coberturas.max_select === 5 && coberturas.free_count === 2 && coberturas.extra_price_cents === 200, JSON.stringify(coberturas))
  ok('a lista mostra a regra do grupo', await seller.waitFor(`__text(__q('[data-group="${COBERTURAS}"]'))?.includes('2 grátis, depois R$ 2,00 cada')`))

  const newOption = async (group, name, price = '0,00') => {
    await seller.click(`__q('[data-group="${group}"] [data-new-option]')`, 500)
    await seller.waitFor(`__q('#complemento-nome')`)
    await seller.set('#complemento-nome', name)
    await seller.set('#complemento-preco', price)
    await saveDialog()
  }
  for (const flavor of ['Chocolate', 'Morango', 'Creme']) await newOption(SABORES, `${PREFIX}Sabor ${flavor}`)
  for (const topping of ['A', 'B', 'C', 'D']) await newOption(COBERTURAS, `${PREFIX}Cobertura ${topping}`)
  await newOption(COBERTURAS, `${PREFIX}Complemento`, '1,50')
  const options = await db.rows('catalog_options', `id=like.e2e-acai-test-*&select=id,group_id,name,price_cents,position,available&order=group_id,position`)
  for (const option of options) remember('catalog_options', `id=eq.${option.id}`)
  ok('8 complementos de teste gravados, cada um no grupo certo', options.length === 8 && options.filter((option) => option.group_id === SABORES).length === 3, options.map((option) => option.id).join(', '))

  // Complemento: renomear, preço, ordem, esgotado e de volta.
  const COMPLEMENTO = 'e2e-acai-test-complemento'
  await seller.click(`__q('[data-option="${COMPLEMENTO}"] [data-edit-option]')`, 500)
  await seller.waitFor(`__q('#complemento-nome')`)
  await seller.set('#complemento-nome', `${PREFIX}Complemento Renomeado`)
  await seller.set('#complemento-preco', '2,50')
  await saveDialog()
  const renamed = await db.one('catalog_options', `id=eq.${COMPLEMENTO}&select=name,price_cents`)
  ok('complemento: nome e preço novos no banco (o id fica o mesmo)', renamed?.name === `${PREFIX}Complemento Renomeado` && renamed.price_cents === 250, JSON.stringify(renamed))
  await seller.run(`__dialog()?.close(); true`)
  const position = async () => (await db.one('catalog_options', `id=eq.${COMPLEMENTO}&select=position`))?.position
  const beforeMove = await position()
  await seller.click(`__q('[data-option="${COMPLEMENTO}"] [data-move="subir"]')`, 1200)
  ok('complemento "↑ Subir" muda a posição no banco', (await position()) === beforeMove - 1, `${beforeMove} → ${await position()}`)
  await seller.click(`__q('[data-option="${COMPLEMENTO}"] [data-toggle-option]')`, 1200)
  ok('complemento esgotado no banco', (await db.one('catalog_options', `id=eq.${COMPLEMENTO}&select=available`))?.available === false)
  await seller.click(`__q('[data-option="${COMPLEMENTO}"] [data-toggle-option]')`, 1200)
  ok('complemento disponível de novo', (await db.one('catalog_options', `id=eq.${COMPLEMENTO}&select=available`))?.available === true)

  // ------------------------------------------------------------------ produto montável
  await seller.goto(`${site.url}/vendedor?aba=produtos`)
  await seller.waitFor(`__q('[data-admin-products]')`)
  const openNew = async (kind) => {
    await seller.click(`__q('[data-new-product]')`, 600)
    await seller.waitFor(`__q('[data-product-editor]')`)
    await seller.click(`__q('input[data-kind="${kind}"]')`, 200)
  }
  let since = Date.now()
  await openNew('montavel')
  await seller.set('#produto-nome', `${PREFIX}Monte-Seu-Sorvete`)
  await seller.run(`__set(__q('#produto-categoria'), ${JSON.stringify(CATEGORY)})`)
  await seller.set('#produto-descricao', 'Produto montável da auditoria E2E.')
  await seller.set('#produto-botao', 'Montar sorvete')
  await seller.click(`__q('[data-add-variant]')`, 200)
  await seller.set('#tamanho-0-nome', '3 bolas')
  await seller.set('#tamanho-0-preco', '15,00')
  await seller.click(`__q('[data-add-variant]')`, 200)
  await seller.set('#tamanho-1-nome', '2 bolas')
  await seller.set('#tamanho-1-preco', '12,00')
  await seller.click(`__q('[data-variant="1"] [data-move="subir"]')`, 200)
  await seller.click(`__switch(${JSON.stringify(`${PREFIX}Sabores de Sorvete`)}, __q('[data-product-group="${SABORES}"]'))`, 200)
  await seller.click(`__switch(${JSON.stringify(`${PREFIX}Coberturas`)}, __q('[data-product-group="${COBERTURAS}"]'))`, 200)
  await saveDialog()
  const rpc = seller.calls(since, '/rest/v1/rpc/catalogo_salvar_produto')
  const montavel = await db.one('catalog_products', `id=eq.${MONTAVEL}&select=id,kind,category_id,name,price_cents`)
  const montavelSizes = await db.rows('catalog_variants', `product_id=eq.${MONTAVEL}&select=id,name,price_cents,position&order=position`)
  const montavelGroups = await db.rows('catalog_product_groups', `product_id=eq.${MONTAVEL}&select=group_id,position&order=position`)
  remember('catalog_product_groups', `product_id=eq.${MONTAVEL}`)
  remember('catalog_variants', `product_id=eq.${MONTAVEL}`)
  remember('catalog_products', `id=eq.${MONTAVEL}`)
  ok('produto montável: catalogo_salvar_produto 200 pelo navegador', rpc.some((call) => call.status === 200), JSON.stringify(rpc.map((call) => call.status)))
  ok(
    'montável no banco: tipo, categoria, tamanhos na ordem ("2 bolas" subiu) e preço "a partir de"',
    montavel?.kind === 'montavel' && montavel.category_id === CATEGORY && montavelSizes.map((size) => size.name).join() === '2 bolas,3 bolas' && montavel.price_cents === 1200,
    JSON.stringify({ montavel, montavelSizes }),
  )
  ok('montável no banco: os 2 grupos ligados, na ordem', montavelGroups.map((link) => link.group_id).join() === `${SABORES},${COBERTURAS}`)

  // ------------------------------------------------------------------ produto com sabores
  since = Date.now()
  await openNew('variacoes')
  await seller.set('#produto-nome', `${PREFIX}Produto-Sabores`)
  await seller.run(`__set(__q('#produto-categoria'), ${JSON.stringify(CATEGORY)})`)
  await seller.set('#produto-preco', '8,00')
  await seller.click(`__q('[data-add-choice]')`, 200)
  for (const [index, flavor] of ['Uva', 'Limão', 'Manga', 'Coco'].entries()) {
    await seller.click(`__q('[data-choice="0"] [data-add-option]')`, 150)
    await seller.set(`#opcao-0-${index}`, flavor)
  }
  await seller.click(`[...__q('[data-choice-options="0"]').querySelectorAll('li')][2].querySelector('[data-move="subir"]')`, 150)
  await seller.click(`__switch('Disponível', [...__q('[data-choice-options="0"]').querySelectorAll('li')][3])`, 150)
  await saveDialog()
  remember('catalog_choice_options', `product_id=eq.${SABORES_PRODUTO}`)
  remember('catalog_choices', `product_id=eq.${SABORES_PRODUTO}`)
  remember('catalog_products', `id=eq.${SABORES_PRODUTO}`)
  const flavorRows = await db.rows('catalog_choice_options', `product_id=eq.${SABORES_PRODUTO}&select=id,name,available,position&order=position`)
  ok(
    'produto com sabores: opções na ordem nova (Manga subiu) e Coco esgotado no banco',
    flavorRows.map((row) => row.name).join() === 'Uva,Manga,Limão,Coco' && flavorRows.find((row) => row.name === 'Coco')?.available === false,
    JSON.stringify(flavorRows),
  )
  // Tirar um sabor e salvar de novo (substitui a lista).
  await seller.goto(`${site.url}/vendedor?aba=produtos`)
  await seller.waitFor(`__q('[data-product="${SABORES_PRODUTO}"]')`)
  await seller.click(`__q('[data-product="${SABORES_PRODUTO}"] [data-edit-product]')`, 600)
  await seller.waitFor(`__q('[data-product-editor]')`)
  await seller.click(`__button('Remover', [...__q('[data-choice-options="0"]').querySelectorAll('li')][1])`, 150)
  await saveDialog()
  ok('tirar um sabor: "Alterações salvas com sucesso" e 3 opções no banco', (await seller.run(`__dialog()?.querySelector('[data-save-ok]')?.textContent`)) === 'Alterações salvas com sucesso' && (await db.rows('catalog_choice_options', `product_id=eq.${SABORES_PRODUTO}&select=name`)).length === 3)
  await seller.run(`__dialog()?.close(); true`)

  // ------------------------------------------------------------------ produto direto com foto
  const photo1 = testImage('e2e-foto-1', [106, 22, 80])
  const photo2 = testImage('e2e-foto-2', [240, 180, 30])
  await openNew('direto')
  await seller.set('#produto-nome', `${PREFIX}Produto-Direto`)
  await seller.run(`__set(__q('#produto-categoria'), ${JSON.stringify(CATEGORY)})`)
  await seller.set('#produto-preco', '5,00')
  await seller.set('#produto-selo', 'Teste')
  await seller.set('#produto-descricao', 'Produto direto da auditoria E2E.')
  await seller.upload('dialog[open] input[data-photo-input]', svgFile())
  ok('foto SVG recusada com aviso, sem enviar', await seller.waitFor(`__text(__q('[data-photo-picker]'))?.includes('Use uma foto JPEG, PNG ou WebP.')`))
  since = Date.now()
  await seller.upload('dialog[open] input[data-photo-input]', photo1)
  const uploaded = await seller.waitFor(`__q('[data-photo-pick]')?.textContent.includes('Trocar foto') && !__text(__q('[data-photo-picker]')).includes('Enviando')`, 20000)
  const storagePost = seller.calls(since, '/storage/v1/object/catalogo/fotos/')
  ok('foto enviada ao Storage (POST 200, pasta fotos/)', uploaded && storagePost.some((call) => call.method === 'POST' && call.status === 200), JSON.stringify(storagePost.map((call) => `${call.method} ${call.status} ${call.path.split('/').pop()}`)))
  await saveDialog()
  remember('catalog_products', `id=eq.${DIRETO}`)
  const direct = await db.one('catalog_products', `id=eq.${DIRETO}&select=kind,price_cents,badge,image`)
  const imageUrl = direct?.image ?? ''
  if (imageUrl) state.uploads.push(imageUrl.split('/object/public/catalogo/')[1])
  const imageResponse = imageUrl ? await fetch(imageUrl) : null
  ok(
    'produto direto no banco com a foto do Storage, e a foto abre (200, imagem)',
    direct?.kind === 'direto' && direct.price_cents === 500 && direct.badge === 'Teste' && imageUrl.startsWith(`${secrets.url}/storage/v1/object/public/catalogo/fotos/`) && imageResponse?.status === 200 && /^image\//.test(imageResponse.headers.get('content-type') ?? ''),
    `${imageResponse?.status} ${imageResponse?.headers.get('content-type')}`,
  )

  // Trocar e tirar a foto.
  await seller.goto(`${site.url}/vendedor?aba=produtos`)
  await seller.waitFor(`__q('[data-product="${DIRETO}"]')`)
  await seller.click(`__q('[data-product="${DIRETO}"] [data-edit-product]')`, 600)
  await seller.waitFor(`__q('[data-product-editor]')`)
  await seller.upload('dialog[open] input[data-photo-input]', photo2)
  await seller.waitFor(`!__text(__q('[data-photo-picker]')).includes('Enviando') && !__text(__q('[data-photo-picker]')).includes('Preparando')`, 20000)
  await saveDialog()
  const replaced = (await db.one('catalog_products', `id=eq.${DIRETO}&select=image`))?.image ?? ''
  if (replaced) state.uploads.push(replaced.split('/object/public/catalogo/')[1])
  ok('trocar foto: endereço novo no banco, diferente do anterior', replaced !== imageUrl && replaced.includes('/catalogo/fotos/'))
  await seller.click(`__q('[data-photo-remove]')`, 200)
  await saveDialog()
  ok('tirar foto: o produto fica sem foto no banco', (await db.one('catalog_products', `id=eq.${DIRETO}&select=image`))?.image === '')
  // Foto de volta para a loja mostrar.
  await seller.upload('dialog[open] input[data-photo-input]', photo1)
  await seller.waitFor(`!__text(__q('[data-photo-picker]')).includes('Enviando') && !__text(__q('[data-photo-picker]')).includes('Preparando')`, 20000)
  await saveDialog()
  const finalPhoto = (await db.one('catalog_products', `id=eq.${DIRETO}&select=image`))?.image ?? ''
  if (finalPhoto) state.uploads.push(finalPhoto.split('/object/public/catalogo/')[1])
  await seller.run(`__dialog()?.close(); true`)

  // ------------------------------------------------------------------ duplicar, esgotar, categoria
  await seller.goto(`${site.url}/vendedor?aba=produtos`)
  await seller.waitFor(`__q('[data-product="${DIRETO}"]')`)
  await seller.click(`__q('[data-product="${DIRETO}"] [data-duplicate-product]')`, 600)
  await seller.waitFor(`__q('[data-product-editor]')`)
  await seller.set('#produto-nome', `${PREFIX}Produto-Direto Copia`)
  await saveDialog()
  const copies = await db.rows('catalog_products', `id=like.e2e-acai-test-produto-direto-*&select=id,name,visible,price_cents`)
  for (const copy of copies) remember('catalog_products', `id=eq.${copy.id}`)
  const copy = copies[0]
  ok('duplicar: id novo, nome próprio, oculto até revisar, mesmo preço', copy && copy.id !== DIRETO && copy.visible === false && copy.price_cents === 500, JSON.stringify(copies))
  ok('o original não mudou', (await db.one('catalog_products', `id=eq.${DIRETO}&select=name,visible`))?.name === `${PREFIX}Produto-Direto`)
  await seller.goto(`${site.url}/vendedor?aba=produtos`)
  await seller.waitFor(`__q('[data-product="${DIRETO}"]')`)
  await seller.click(`__q('[data-product="${DIRETO}"] [data-toggle-available]')`, 1500)
  ok('"Marcar esgotado": disponível falso no banco', (await db.one('catalog_products', `id=eq.${DIRETO}&select=available`))?.available === false)
  await seller.click(`__q('[data-product="${DIRETO}"] [data-toggle-available]')`, 1500)
  ok('"Marcar disponível": de volta no banco', (await db.one('catalog_products', `id=eq.${DIRETO}&select=available`))?.available === true)
  await seller.click(`__q('[data-product="${DIRETO}"] [data-edit-product]')`, 600)
  await seller.waitFor(`__q('[data-product-editor]')`)
  await seller.run(`__set(__q('#produto-categoria'), 'bebidas')`)
  await saveDialog()
  ok('mudar de categoria: grava a categoria nova', (await db.one('catalog_products', `id=eq.${DIRETO}&select=category_id`))?.category_id === 'bebidas')
  await seller.run(`__set(__q('#produto-categoria'), ${JSON.stringify(CATEGORY)})`)
  await saveDialog()
  ok('e de volta para a categoria de teste', (await db.one('catalog_products', `id=eq.${DIRETO}&select=category_id`))?.category_id === CATEGORY)
  await seller.run(`__dialog()?.close(); true`)
  await seller.goto(`${site.url}/vendedor?aba=categorias`)
  await seller.waitFor(`__q('[data-category="${CATEGORY}"]')`)
  await seller.click(`__q('[data-category="${CATEGORY}"] [data-edit-category]')`, 600)
  await seller.waitFor(`__q('[data-category-editor]')`)
  ok('a categoria de teste, agora com produtos, não arquiva', await seller.run(`__q('[data-archive-category]')?.disabled === true`))
  await seller.run(`__dialog()?.close(); true`)

  // ------------------------------------------------------------------ oferta
  await seller.goto(`${site.url}/vendedor?aba=ofertas`)
  await seller.waitFor(`__q('[data-admin-offers]')`)
  await seller.click(`__q('[data-new-offer]')`, 600)
  await seller.waitFor(`__q('#oferta-titulo')`)
  await seller.set('#oferta-titulo', `${PREFIX}Oferta`)
  await seller.set('#oferta-frase', 'Produto de teste por apenas {preco} (de {preco_antigo})!')
  await seller.set('#oferta-selo', 'Teste E2E')
  await seller.run(`__set(__q('#oferta-produto'), ${JSON.stringify(DIRETO)})`)
  await seller.set('#oferta-preco', '4,00')
  ok('prévia da oferta com os preços', await seller.waitFor(`__text(__q('[data-offer-preview]'))?.includes('por apenas R$ 4,00 (de R$ 5,00)')`))
  await saveDialog()
  remember('catalog_offers', `id=eq.${OFERTA}`)
  const offer = await db.one('catalog_offers', `id=eq.${OFERTA}&select=product_id,promo_price_cents,status,position`)
  ok('oferta no banco: produto, preço promocional 4,00 e ativa', offer?.product_id === DIRETO && offer.promo_price_cents === 400 && offer.status === 'ativa', JSON.stringify(offer))
  await seller.goto(`${site.url}/vendedor?aba=ofertas`)
  await seller.waitFor(`__q('[data-offer="${OFERTA}"]')`)
  const offerPosition = async () => (await db.one('catalog_offers', `id=eq.${OFERTA}&select=position`))?.position
  const beforeOffer = await offerPosition()
  await seller.click(`__q('[data-offer="${OFERTA}"] [data-move="subir"]')`, 1200)
  ok('oferta "↑ Subir": posição nova no banco', (await offerPosition()) === beforeOffer - 1, `${beforeOffer} → ${await offerPosition()}`)
  await seller.click(`__q('[data-offer="${OFERTA}"] [data-edit-offer]')`, 600)
  await seller.waitFor(`__q('#oferta-titulo')`)
  await seller.set('#oferta-titulo', `${PREFIX}Oferta Editada`)
  await saveDialog()
  ok('editar o título da oferta: grava (o id fica o mesmo)', (await db.one('catalog_offers', `id=eq.${OFERTA}&select=title`))?.title === `${PREFIX}Oferta Editada`)
  await seller.run(`__dialog()?.close(); true`)

  // ------------------------------------------------------------------ na loja (cliente sem login)
  await customer.goto(`${site.url}/monte-seu-pedido`)
  await customer.run(`sessionStorage.setItem('acai-doce-sabor:ofertas', JSON.stringify({ bag: [], last: null, dismissed: 3, stopped: true })); true`)
  await customer.waitFor(`__q('[data-item="${DIRETO}"]')`, 20000)
  const card = await customer.run(`__text(__q('[data-item="${DIRETO}"]'))`)
  ok('loja: a categoria renomeada com os produtos de teste', await customer.run(`__text(__q('#secao-${CATEGORY}'))?.includes('${PREFIX}Sorvetes Renomeada')`), card)
  ok('loja: oferta muda o preço do cartão para R$ 4,00, com R$ 5,00 riscado', card?.includes('R$ 4,00') && card.includes('R$ 5,00'), card)
  ok(
    'loja: a foto do Storage aparece no cartão',
    // A foto do cartão carrega só quando aparece (loading=lazy): rola até ela antes de conferir.
    await customer.run(`(async () => { const card = __q('[data-item="${DIRETO}"]'); card.scrollIntoView({ block: 'center' }); const img = card.querySelector('img'); await img?.decode().catch(() => null); await new Promise((r) => setTimeout(r, 800)); return [...card.querySelectorAll('img')].some((img) => img.currentSrc.includes('/storage/v1/object/public/catalogo/fotos/') && img.complete && img.naturalWidth > 0) })()`),
  )
  ok('loja: a cópia oculta não aparece', await customer.run(`!__q('[data-item^="e2e-acai-test-produto-direto-"]')`))
  await customer.shot('02-loja-produtos-de-teste')
  // Pausar a oferta: o preço volta.
  await seller.goto(`${site.url}/vendedor?aba=ofertas`)
  await seller.waitFor(`__q('[data-offer="${OFERTA}"]')`)
  await seller.click(`__q('[data-offer="${OFERTA}"] [data-toggle-offer]')`, 1500)
  ok('pausar a oferta: situação "pausada" no banco', (await db.one('catalog_offers', `id=eq.${OFERTA}&select=status`))?.status === 'pausada')
  await customer.waitFor(`__text(__q('[data-item="${DIRETO}"]')) && !__text(__q('[data-item="${DIRETO}"]')).includes('R$ 4,00')`, 15000)
  ok('loja ao vivo (sem recarregar): oferta pausada, o preço volta a R$ 5,00', (await customer.run(`__text(__q('[data-item="${DIRETO}"]'))`))?.includes('R$ 5,00'))
  await seller.click(`__q('[data-offer="${OFERTA}"] [data-toggle-offer]')`, 1500)
  ok('reativar a oferta: situação "ativa" no banco', (await db.one('catalog_offers', `id=eq.${OFERTA}&select=status`))?.status === 'ativa')
  ok('loja ao vivo: oferta de volta (R$ 4,00)', await customer.waitFor(`__text(__q('[data-item="${DIRETO}"]'))?.includes('R$ 4,00')`, 15000))

  // Visitante pelo banco: só o público.
  const anon = await publicApi(secrets)('/rest/v1/rpc/catalogo_publico', { method: 'POST', body: '{}' })
  ok('visitante pelo banco: recebe os 3 produtos de teste e não a cópia oculta', [MONTAVEL, SABORES_PRODUTO, DIRETO].every((id) => anon.body.products.some((product) => product.id === id)) && !anon.body.products.some((product) => product.id.startsWith(`${DIRETO}-`)))
  state.products = { MONTAVEL, SABORES_PRODUTO, DIRETO, CATEGORY, SABORES, COBERTURAS, OFERTA, COMPLEMENTO }
  ok('console do vendedor sem erros nesta seção', seller.problems().length === 0, JSON.stringify(seller.problems()).slice(0, 300))
  ok('console do cliente sem erros nesta seção', customer.problems().length === 0, JSON.stringify(customer.problems()).slice(0, 300))
  void (await dialogError())
}
