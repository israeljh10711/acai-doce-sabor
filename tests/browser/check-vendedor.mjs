// Confere no navegador o Modo Vendedor na própria loja, gravando NESTE aparelho (sem as chaves do
// Supabase). Desde o cardápio dinâmico (2026-11-21), "Editar", "+ Adicionar", "Duplicar" e
// "Renomear" abrem os editores do painel do vendedor, que gravam os registros do cardápio:
// - "Senha para vendedor": senha errada mostra o aviso; a senha certa liga a faixa e as ferramentas;
// - "+ Adicionar produto" numa seção: produto com foto da galeria, preço e descrição aparece na
//   seção (com a foto), na busca e vai para o carrinho;
// - "Editar": preço novo do Sundae chega ao cartão e ao carrinho;
// - "Disponível/Esgotado" em 1 toque: item, complemento e sabor do milk-shake; esgotado fica fora do
//   Completo;
// - "+ Adicionar complemento" no personalizador: o novo entra no grupo e no Completo;
// - "Renomear": a seção Bebidas e o título "Monte do seu jeito";
// - "Duplicar": a cópia nasce oculta (não aparece na loja até o vendedor mostrar);
// - backup baixado (v2, com o cardápio) e restaurado devolve o cardápio e as fotos;
// - "Sair" esconde as ferramentas; no celular, o acesso fica no menu Categorias.
//
// A senha inicial fica no código do site como hash; aqui ela vem da variável SENHA_VENDEDOR
// (ou do pedido de 2026-11-16, quando a variável não existe).
//
// Uso (com o site rodando SEM o Supabase): node tests/browser/check-vendedor.mjs [endereçoBase]
import { mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openBrowser, sleep } from './lib.mjs'

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:5173'
const outDir = join(tmpdir(), 'acai-doce-sabor-conferencia', 'vendedor')
mkdirSync(outDir, { recursive: true })
const PHOTO = join(process.cwd(), 'public', 'images', 'catalogo', 'picole-trufado.jpg').replaceAll('\\', '/')
const PASSWORD = process.env.SENHA_VENDEDOR ?? `vendedor${2000 + 26}`
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
  window.__all = (selector) => [...document.querySelectorAll(selector)];
  window.__dialog = () => [...document.querySelectorAll('dialog[open]')].at(-1) ?? null;
  window.__set = (el, text) => {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, text);
    el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
    return true;
  };
  window.__type = (selector, text) => __set(__q(selector), text);
  window.__item = (id) => __q('[data-item="' + id + '"]');
  window.__buy = (id) => __item(id)?.querySelector('button:not([data-zoom]):not([data-seller-edit]):not([data-seller-stock]):not([data-seller-duplicate])');
  window.__lastIn = (section) => [...document.querySelectorAll('[data-section="' + section + '"] [data-item]')].at(-1);
  window.__label = (b) => b.getAttribute('aria-label') ?? b.textContent.trim();
  window.__topping = (label) => [...document.querySelectorAll('button')].find((b) => __label(b) === label);
  window.__cartCount = () => Number((__q('header a[href="/carrinho"]')?.textContent.match(/[0-9]+/) ?? ['0'])[0]);
  window.__records = () => JSON.parse(localStorage.getItem('acai_doce_sabor_catalogo_v2') ?? 'null');
  true;
`

const browser = await openBrowser(join(outDir, 'edge-profile'), 9366)
const run = async (expression) => {
  await browser.evaluate(helpers)
  return browser.evaluate(expression)
}
const quiet = `sessionStorage.setItem('acai-doce-sabor:ofertas', JSON.stringify({ bag: [], last: null, dismissed: 3, stopped: true })); true`
const OPEN_NOW = JSON.stringify({ settings: { loja: { override: { state: 'open', until: Date.now() + 3_600_000 } } } })
const goto = async (path, viewport, reset = false) => {
  await browser.goto(baseUrl + path, viewport)
  await sleep(500)
  if (reset) {
    await run(`localStorage.clear(); indexedDB.deleteDatabase('acai_doce_sabor_seller_images'); localStorage.setItem('acai_doce_sabor_seller_catalog_v1', ${JSON.stringify(OPEN_NOW)}); true`)
    await sleep(300)
  }
  await run(quiet)
  await browser.goto(baseUrl + path, viewport)
  for (let i = 0; i < 50 && !(await run(`!!document.querySelector('h1')`)); i++) await sleep(100)
  await sleep(400)
}
const click = async (expression, pause = 500) => {
  const ok = await run(`(() => { const el = ${expression}; if (!el) return false; el.scrollIntoView({ block: 'center' }); el.click(); return true })()`)
  if (!ok) throw new Error(`Elemento não encontrado: ${expression}`)
  await sleep(pause)
}
const waitFor = async (condition, timeout = 6000) => {
  for (let waited = 0; waited < timeout; waited += 100) {
    if (await run(`(() => { try { return !!(${condition}) } catch { return false } })()`)) return true
    await sleep(100)
  }
  return false
}
const save = async () => {
  await click(`__dialog().querySelector('[data-save]')`, 900)
}
const choosePhoto = async () => {
  await waitFor("__dialog()?.querySelector('input[data-photo-input]')", 10000)
  const { root } = await browser.send('DOM.getDocument', { depth: -1, pierce: true })
  const { nodeIds } = await browser.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: 'dialog[open] input[data-photo-input]' })
  await browser.send('DOM.setFileInputFiles', { nodeId: nodeIds.at(-1), files: [PHOTO] })
  await waitFor(`__dialog().querySelector('[data-photo-pick]')?.textContent.includes('Trocar foto') && !__dialog().querySelector('[data-photo-picker]').textContent.includes('Enviando')`)
}
/** "Backup / Restaurar" mora no painel (/painel), bloco "Segurança e sessão" (2026-11-23). */
const openBackup = async (viewport) => {
  await goto('/painel', viewport)
  await waitFor(`__q('[data-panel-backup]')`, 10000)
  await click(`__q('[data-panel-backup]')`, 900)
}
const login = async (password) => {
  await waitFor("__q('#senha-vendedor')", 8000)
  await run(`__type('#senha-vendedor', ${JSON.stringify(password)})`)
  await run(`__q('#senha-vendedor').form.requestSubmit(); true`)
  await sleep(900)
}

try {
  const desktop = { width: 1280, height: 800 }

  // --- Acesso ---
  await goto('/monte-seu-pedido', desktop, true)
  check('sem o modo vendedor: nenhum "Editar" nem "+ Adicionar"', await run(`[__all('[data-seller-edit]').length, __all('[data-seller-add]').length, !!__q('[data-seller-bar]')]`), [0, 0, false])
  check('visão do cliente: o topo mostra só "Cardápio" e "Carrinho", sem aba de vendedor', await run(`[[...__q('nav[aria-label="Navegação principal"]').querySelectorAll('a')].map((a) => a.textContent.trim()), !!__q('[data-seller-panel-link]')]`), [['Cardápio', 'Carrinho'], false])
  check('"Senha para vendedor" no rodapé da barra lateral', await run(`__q('nav[aria-label="Categorias do cardápio"]').parentElement.querySelector('[data-seller-access]')?.textContent.trim()`), 'Senha para vendedor')
  await click(`__q('[data-seller-access]')`, 900)
  await login('1111')
  check('senha errada: aviso e modo desligado', await run(`[__q('#senha-vendedor-erro')?.textContent, !!__q('[data-seller-bar]')]`), ['Senha incorreta. Tente novamente.', false])
  await login(PASSWORD)
  await waitFor("__q('[data-seller-bar]')", 10000)
  check('senha certa: aba "Painel" ao lado de Cardápio e Carrinho, sem a faixa roxa, selo e ferramentas', await run(`[!!__dialog(), [...__q('nav[aria-label="Navegação principal"]').querySelectorAll('a')].map((a) => a.textContent.trim()), !/Alterar senha|Backup|Sair do Modo|Pedidos|Tempo:/.test(__q('[data-seller-bar]').textContent), __q('[data-seller-active]')?.textContent.trim(), __all('[data-seller-add]').length > 0, __all('[data-seller-edit]').length > 40]`), [
    false,
    ['Cardápio', 'Painel', 'Carrinho'],
    true,
    'Modo Vendedor Ativo',
    true,
    true,
  ])

  // --- Aba "Painel" (2026-11-23): a área dedicada, em três blocos ---
  await click(`__q('[data-seller-panel-link]')`, 900)
  await waitFor(`__q('[data-panel-block]')`, 10000)
  check('aba "Painel" abre /painel, com a aba marcada como atual', await run(`[location.pathname, __q('[data-seller-panel-link]')?.getAttribute('aria-current')]`), ['/painel', 'page'])
  check('painel: três blocos, na ordem Operação, Loja e cardápio, Segurança e sessão', await run(`__all('[data-panel-block]').map((b) => b.querySelector('h2').textContent)`), ['Operação', 'Loja e cardápio', 'Segurança e sessão'])
  check(
    'painel, Operação: Pedidos, Loja Aberta/Fechada e Tempo de entrega',
    await run(`(() => { const b = __q('[data-panel-block="operacao"]'); return [!!b.querySelector('[data-orders-link]'), !!b.querySelector('[data-store-switch]'), b.querySelector('[data-delivery-time]')?.textContent.trim().startsWith('Tempo:')] })()`),
    [true, true, true],
  )
  check(
    'painel, Loja e cardápio: Cardápio, cardápio da loja, Entrega / Frete e Horários e Contato',
    await run(`(() => { const b = __q('[data-panel-block="loja"]'); const href = (s) => b.querySelector(s)?.getAttribute('href'); return [href('[data-admin-link]'), href('[data-panel-menu-link]'), href('[data-delivery-settings]'), href('[data-hours-contact]')] })()`),
    ['/vendedor', '/monte-seu-pedido', '/vendedor?aba=loja#loja-entrega', '/vendedor?aba=loja#loja-horario'],
  )
  check(
    'painel, Segurança e sessão: Alterar senha, Backup / Restaurar e Sair do Modo Vendedor',
    await run(`(() => { const b = __q('[data-panel-block="sessao"]'); return [b.querySelector('[data-panel-password]')?.textContent.includes('Alterar senha'), b.querySelector('[data-panel-backup]')?.textContent.includes('Backup / Restaurar'), b.querySelector('[data-panel-signout]')?.textContent.trim()] })()`),
    [true, true, 'Sair do Modo Vendedor'],
  )
  check('painel: diz onde as mudanças ficam salvas', await run(`__q('[data-panel-active]')?.textContent.includes('Salvo só neste aparelho')`), true)
  await click(`__q('[data-panel-password]')`, 600)
  check('painel: "Alterar senha" abre a janela', await run(`__dialog()?.querySelector('h2, [id]')?.textContent.includes('Alterar senha') ?? false`), true)
  await run(`__dialog()?.close(); true`)
  // O cardápio da loja (pelo painel) continua com os botões rápidos de editar e esgotar.
  await click(`__q('[data-panel-menu-link]')`, 900)
  await waitFor(`__all('[data-seller-edit]').length > 40`, 10000)
  check('painel → cardápio da loja: botões "Editar" e "Disponível / Esgotado" nos itens', await run(`[location.pathname, __all('[data-seller-edit]').length > 40, __all('[data-seller-stock]').length > 40]`), ['/monte-seu-pedido', true, true])

  // --- "+ Adicionar produto" com foto ---
  await click(`__q('[data-section="picoles-e-sorvetes"] [data-seller-add]')`, 300)
  await waitFor("__dialog()?.querySelector('[data-product-editor]')", 10000)
  check('"+ Adicionar produto" abre o editor com a seção certa', await run(`[!!__dialog()?.querySelector('[data-product-editor]'), __q('#produto-categoria')?.value]`), [true, 'picoles-e-sorvetes'])
  await choosePhoto()
  await run(`__type('#produto-nome', 'Picolé trufado especial')`)
  await run(`__type('#produto-preco', '3,00')`)
  await run(`__type('#produto-descricao', 'Picolé trufado sabor chocolate')`)
  await save()
  check('o editor fecha depois de salvar o produto novo', await waitFor(`!__dialog()`), true)
  const created = await run(`(async () => { const card = __item('picole-trufado-especial'); card.scrollIntoView({ block: 'center' }); const img = card.querySelector('img'); await img?.decode().catch(() => null); return [card.textContent.includes('Picolé trufado especial'), card.textContent.includes('R$ 3,00'), card.textContent.includes('Picolé trufado sabor chocolate'), !!img && img.naturalWidth > 0, img?.currentSrc.startsWith('blob:')] })()`)
  check('produto novo na seção: nome, preço, descrição e a foto do aparelho', created, [true, true, true, true, true])
  await run(`__type('#busca-cardapio', 'especial')`)
  await sleep(500)
  check('a busca acha o produto novo', await run(`!!__item('picole-trufado-especial')`), true)
  await run(`__type('#busca-cardapio', '')`)
  await sleep(300)
  await click(`__buy('picole-trufado-especial')`, 900)
  await click(`__dialog()?.querySelector('button.btn-primary') ?? [...document.querySelectorAll('dialog[open] button')].find((b) => /Adicionar|Confirmar/.test(b.textContent))`, 900)
  check('produto novo vai para o carrinho', await run(`__cartCount()`), 1)
  // A confirmação pode levar ao carrinho: volta ao cardápio.
  await goto('/monte-seu-pedido', desktop)

  // --- "Editar": preço novo ---
  await click(`__item('sundae').querySelector('[data-seller-edit]')`, 300)
  await waitFor(`__q('#produto-nome')?.value`, 10000)
  check('"Editar" abre o editor do produto', await run(`__q('#produto-nome')?.value`), 'Sundae')
  await run(`__type('#produto-preco', '9,50')`)
  check('"Há alterações não salvas."', await waitFor(`__dialog().querySelector('[data-dirty]')`), true)
  await save()
  check('"Alterações salvas com sucesso"', await waitFor(`__dialog()?.querySelector('[data-save-ok]')?.textContent === 'Alterações salvas com sucesso'`), true)
  await run(`__dialog().close(); true`)
  await sleep(400)
  check('preço novo no cartão', await run(`__item('sundae').textContent.includes('R$ 9,50')`), true)

  // --- Esgotado em 1 toque ---
  await click(`__item('jujuba').querySelector('[data-seller-stock]')`, 900)
  check('Jujuba esgotada: selo e botão desligado', await run(`[__item('jujuba').textContent.includes('Esgotado'), __buy('jujuba').disabled]`), [true, true])
  check('o esgotado ficou nos registros do aparelho', await run(`__records().products.find((p) => p.id === 'jujuba').available`), false)

  // --- "Renomear" ---
  await click(`__q('[data-seller-rename="bebidas"]')`, 300)
  await waitFor(`__q('#categoria-nome')`, 10000)
  await run(`__type('#categoria-nome', 'Bebidas geladas')`)
  await save()
  await run(`__dialog()?.close(); true`)
  await sleep(400)
  check('seção renomeada', await run(`__q('[data-section="bebidas"]')?.textContent.includes('Bebidas geladas')`), true)
  await click(`__q('[data-seller-rename="monte"]')`, 300)
  await waitFor(`__q('#categoria-nome')`, 10000)
  await run(`__type('#categoria-nome', 'Monte o seu açaí')`)
  await save()
  await run(`__dialog()?.close(); true`)
  await sleep(400)
  check('"Monte do seu jeito" renomeado', await run(`document.body.textContent.includes('Monte o seu açaí')`), true)

  // --- "Duplicar" ---
  await click(`__item('sundae').querySelector('[data-seller-duplicate]')`, 300)
  await waitFor(`__q('#produto-nome')?.value`, 10000)
  check('"Duplicar" abre a cópia', await run(`__q('#produto-nome')?.value`), 'Sundae (cópia)')
  await save()
  check('a cópia nasce oculta: não aparece na loja', await waitFor(`!__dialog() && !__item('sundae-copia') && __records().products.some((p) => p.id === 'sundae-copia' && !p.visible)`), true)

  // --- Tradicional: complemento novo, esgotado e o Completo ---
  await goto('/monte-seu-pedido/acai-tradicional', desktop)
  await click(`[...document.querySelectorAll('[data-seller-add]')].find((b) => b.textContent.includes('complemento'))`, 300)
  await waitFor("__dialog()?.querySelector('[data-option-editor]')", 10000)
  check('"+ Adicionar complemento" abre o editor do complemento', await run(`!!__dialog()?.querySelector('[data-option-editor]')`), true)
  await run(`__type('#complemento-nome', 'Ovomaltine')`)
  await save()
  check('complemento novo nos adicionais', await waitFor(`!__dialog() && !!__q('button[aria-label="Ovomaltine"]')`), true)
  await click(`[...document.querySelectorAll('[data-seller-stock]')].find((b) => b.textContent.includes('Granola'))`, 900)
  check('Granola esgotada: o botão fica desligado', await run(`__q('button[aria-label="Granola"]')?.disabled`), true)
  await click(`__q('input[value="pote-200"]')`)
  await click(`[...__q('[data-complete-bar]').querySelectorAll('button')].find((b) => b.textContent.trim().startsWith('Completo'))`, 700)
  check('Completo: entra o complemento novo, fica de fora o esgotado', await run(`[__q('#resumo').innerText.includes('Ovomaltine'), __q('#resumo').innerText.includes('Granola')]`), [true, false])

  await goto('/monte-seu-pedido/milk-shake', desktop)
  await click(`[...document.querySelectorAll('[data-seller-stock]')].find((b) => b.textContent.includes('Pitaya'))`, 900)
  check('sabor do milk-shake esgotado', await run(`[...document.querySelectorAll('[data-seller-stock]')].find((b) => b.textContent.includes('Pitaya'))?.dataset.sellerStock`), 'esgotado')

  // --- Backup v2 com o cardápio, restaurado num aparelho limpo ---
  await goto('/monte-seu-pedido', desktop)
  await waitFor(`__q('[data-seller-bar]')`, 10000)
  await openBackup(desktop)
  const backup = await run(`(async () => { const button = [...__dialog().querySelectorAll('button')].find((b) => b.textContent.includes('Baixar')); const original = URL.createObjectURL; let blob = null; URL.createObjectURL = (b) => { blob = b; return original.call(URL, b) }; button.click(); await new Promise((r) => setTimeout(r, 1500)); URL.createObjectURL = original; return blob ? await blob.text() : null })()`)
  const parsed = backup ? JSON.parse(backup) : null
  check('backup v2 com o cardápio e a foto do produto novo', [parsed?.v, !!parsed?.catalog?.products?.some((p) => p.id === 'picole-trufado-especial'), Object.keys(parsed?.photos ?? {}).length > 0], [2, true, true])
  await run(`__dialog()?.close(); true`)
  await goto('/monte-seu-pedido', desktop, true)
  check('aparelho limpo: sem o produto novo', await run(`!__item('picole-trufado-especial')`), true)
  await click(`__q('[data-seller-access]')`, 900)
  await login(PASSWORD)
  await waitFor(`__q('[data-seller-bar]')`, 10000)
  await openBackup(desktop)
  const { root } = await browser.send('DOM.getDocument', { depth: -1, pierce: true })
  const restoreFile = join(outDir, 'backup.json').replaceAll('\\', '/')
  const { writeFileSync } = await import('node:fs')
  writeFileSync(restoreFile, backup ?? '')
  const { nodeIds } = await browser.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: 'dialog[open] input[type=file]' })
  await browser.send('DOM.setFileInputFiles', { nodeId: nodeIds.at(-1), files: [restoreFile] })
  await sleep(2000)
  await run(`__dialog()?.close(); true`)
  await goto('/monte-seu-pedido', desktop)
  check('backup restaurado: o produto novo volta, com a foto', await waitFor(`__item('picole-trufado-especial') && [...__item('picole-trufado-especial').querySelectorAll('img')].some((img) => img.src.startsWith('blob:'))`), true)
  check('backup restaurado: o preço editado volta', await run(`__item('sundae').textContent.includes('R$ 9,50')`), true)

  // --- Sair ---
  await goto('/painel', desktop)
  await waitFor(`__q('[data-panel-signout]')`, 10000)
  await click(`__q('[data-panel-signout]')`, 800)
  check('"Sair do Modo Vendedor" (no painel): o painel volta a pedir a senha, sem aba de vendedor', await run(`[!!__q('[data-panel-login]'), !!__q('[data-seller-panel-link]')]`), [true, false])
  await goto('/monte-seu-pedido', desktop)
  check('"Sair do Modo Vendedor": sem faixa, sem ferramentas', await run(`[!!__q('[data-seller-bar]'), __all('[data-seller-edit]').length, !!__q('[data-seller-access]')]`), [false, 0, true])

  // --- Celular: o acesso no menu Categorias ---
  const phone = { width: 390, height: 844, mobile: true }
  await goto('/monte-seu-pedido', phone)
  await click(`__q('button[aria-label^="Categorias"]') ?? [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Categorias'))`, 700)
  check('celular: "Senha para vendedor" no menu Categorias', await run(`!!__dialog()?.querySelector('[data-seller-access]') || !!__q('[data-seller-access]')`), true)
  check('celular: sem rolagem lateral', await run(`document.documentElement.scrollWidth <= window.innerWidth`), true)

  check('console sem erros', browser.consoleProblems(), [])
} catch (error) {
  failures.push(`erro na conferência: ${error.message}`)
} finally {
  browser.close()
}

console.log(`RESULTADO: ${failures.length === 0 ? `as ${checks} conferências passaram` : `${failures.length} falha(s) em ${checks} conferências`}`)
if (failures.length) {
  for (const failure of failures) console.log(`FALHOU: ${failure}`)
  process.exit(1)
}
