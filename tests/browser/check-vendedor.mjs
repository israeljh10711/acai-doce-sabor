// Confere no navegador o modo vendedor gravando NESTE aparelho (sem as chaves do Supabase), no
// computador (1280 px) e o acesso pelo menu do celular (390 px), pedido de 2026-11-16:
// - "Senha para vendedor": senha errada mostra o aviso; a senha inicial do pedido entra;
// - cadastro de "Picolé trufado" com foto da galeria, R$ 3,00 e descrição: aparece na seção (com a
//   foto), na contagem e na busca, vai para o carrinho e para o WhatsApp;
// - preço editado (Sundae R$ 9,50) chega ao carrinho; "Restaurar original" volta a R$ 7,00;
// - complemento novo (Ovomaltine) entra no personalizador e no Completo; complemento e item
//   esgotados ficam desligados e fora do Completo;
// - backup baixado e restaurado devolve as mudanças; "Sair" esconde as ferramentas.
//
// A senha inicial fica no código do site como hash; aqui ela vem da variável SENHA_VENDEDOR
// (ou do pedido de 2026-11-16, quando a variável não existe).
//
// Uso (com o site rodando, sem .env.local do Supabase): node tests/browser/check-vendedor.mjs [endereçoBase]
import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openBrowser, sleep } from './lib.mjs'

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:5173'
const outDir = join(tmpdir(), 'acai-doce-sabor-conferencia', 'vendedor')
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
  window.__dialog = () => [...document.querySelectorAll('dialog[open]')].at(-1) ?? null;
  window.__button = (text, root = document) => [...root.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(text));
  window.__set = (el, text) => {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, text);
    el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
    return true;
  };
  window.__field = (end) => __dialog().querySelector('[id$="' + end + '"]');
  window.__item = (id) => __q('[data-item="' + id + '"]');
  window.__lastIn = (section) => [...document.querySelectorAll('[data-section="' + section + '"] [data-item]')].at(-1);
  window.__cartCount = () => Number((__q('header a[href="/carrinho"]')?.textContent.match(/[0-9]+/) ?? ['0'])[0]);
  window.__stubOpen = () => { window.__opened = []; window.open = (url) => { window.__opened.push(url); return {}; }; return true };
  window.__openedText = () => (window.__opened?.length ? new URL(window.__opened.at(-1)).searchParams.get('text') : null);
  window.__type = (selector, text) => __set(__q(selector), text);
  true;
`

const browser = await openBrowser(join(outDir, 'edge-profile'), 9366)
const run = async (expression) => {
  await browser.evaluate(helpers)
  return browser.evaluate(expression)
}
const quiet = `sessionStorage.setItem('acai-doce-sabor:ofertas', JSON.stringify({ bag: [], last: null, dismissed: 3, stopped: true })); true`
const goto = async (path, viewport, reset = false) => {
  await browser.goto(baseUrl + path, viewport)
  await sleep(500)
  if (reset) {
    await run(`localStorage.clear(); indexedDB.deleteDatabase('acai_doce_sabor_seller_images'); true`)
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
const submitDialog = async (pause = 1200) => {
  await run(`__dialog().querySelector('form').requestSubmit(); true`)
  await sleep(pause)
}
const choosePhoto = async (file) => {
  const { root } = await browser.send('DOM.getDocument', { depth: -1, pierce: true })
  const { nodeIds } = await browser.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: 'dialog[open] input[data-photo-input]' })
  await browser.send('DOM.setFileInputFiles', { nodeId: nodeIds.at(-1), files: [file] })
  for (let i = 0; i < 30 && !(await run(`!!__dialog().querySelector('button img[src^="blob:"]')`)); i++) await sleep(100)
}
const login = async (password) => {
  await run(`__type('#senha-vendedor', ${JSON.stringify(password)})`)
  await run(`__q('#senha-vendedor').form.requestSubmit(); true`)
  await sleep(900)
}

try {
  const desktop = { width: 1280, height: 800 }

  // --- Acesso ---
  await goto('/monte-seu-pedido', desktop, true)
  check('sem o modo vendedor: nenhum "Editar" nem "+ Adicionar"', await run(`[document.querySelectorAll('[data-seller-edit]').length, document.querySelectorAll('[data-seller-add]').length, !!__q('[data-seller-bar]')]`), [0, 0, false])
  check('"Senha para vendedor" no rodapé da barra lateral', await run(`__q('nav[aria-label="Categorias do cardápio"]').parentElement.querySelector('[data-seller-access]')?.textContent.trim()`), 'Senha para vendedor')
  await click(`__q('[data-seller-access]')`, 900)
  check('janela "Acesso do Vendedor / Dono"', await run(`__dialog()?.querySelector('h2')?.textContent`), 'Acesso do Vendedor / Dono')
  await login('1111')
  check('senha errada: aviso e modo desligado', await run(`[__q('#senha-vendedor-erro')?.textContent, !!__q('[data-seller-bar]')]`), ['Senha incorreta. Tente novamente.', false])
  await login(PASSWORD)
  check(
    'senha certa: faixa no topo (salvo neste aparelho), selo "Modo Vendedor Ativo" e ferramentas',
    await run(`[!!__dialog(), __q('[data-seller-bar]')?.textContent.includes('Salvo só neste aparelho'), __q('[data-seller-active]')?.textContent.trim(), document.querySelectorAll('[data-seller-add]').length, document.querySelectorAll('[data-seller-edit]').length > 40]`),
    [false, true, 'Modo Vendedor Ativo', 5, true],
  )

  // --- Cadastro de produto com foto ---
  await click(`__q('[data-section="picoles-e-sorvetes"] [data-seller-add]')`, 900)
  check('"+ Adicionar produto" abre o formulário com a seção certa', await run(`[__dialog()?.querySelector('h2')?.textContent, __field('-secao')?.value]`), ['Adicionar produto', 'picoles-e-sorvetes'])
  await choosePhoto(PHOTO)
  await run(`__set(__field('-nome'), 'Picolé trufado')`)
  await run(`__set(__field('-preco'), '3,00')`)
  await run(`__set(__field('-descricao'), 'Picolé trufado sabor chocolate')`)
  await submitDialog(1600)
  const created = await run(`(async () => { const card = __lastIn('picoles-e-sorvetes'); card.scrollIntoView({ block: 'center' }); const img = card.querySelector('img'); await img?.decode().catch(() => null); return [card.querySelector('[id$="-nome"]').textContent, card.querySelector('strong').textContent, card.querySelector('p').textContent, !!img && img.naturalWidth > 0, img?.currentSrc.startsWith('blob:'), __q('[data-section="picoles-e-sorvetes"] [data-flash-target] .nums').textContent] })()`)
  check('produto novo na seção: nome, preço, descrição, foto do aparelho e contagem 13', created, ['Picolé trufado', 'R$ 3,00', 'Picolé trufado sabor chocolate', true, true, '13 itens'])
  await run(`__type('#busca-cardapio', 'trufado')`)
  await sleep(500)
  check('a busca acha o produto novo', await run(`[...document.querySelectorAll('[data-item] [id$="-nome"]')].map((h) => h.textContent).includes('Picolé trufado')`), true)
  await run(`__type('#busca-cardapio', '')`)
  await sleep(400)

  // --- Preço editado ---
  await click(`__item('sundae').querySelector('[data-seller-edit]')`, 900)
  await run(`__set(__field('-preco'), '9,50')`)
  await submitDialog()
  check('Sundae editado para R$ 9,50 no cartão', await run(`__item('sundae').querySelector('strong').textContent`), 'R$ 9,50')

  // --- Item esgotado ---
  await click(`__item('jujuba').querySelector('[data-seller-edit]')`, 900)
  await click(`[...__dialog().querySelectorAll('label')].find((l) => l.textContent.trim() === 'Esgotado')`, 200)
  await submitDialog()
  check('Jujuba esgotada: selo e botão desligado', await run(`[__item('jujuba').textContent.includes('Esgotado'), __item('jujuba').querySelector('button:not([data-zoom]):not([data-seller-edit])').disabled]`), [true, true])

  // --- Carrinho e WhatsApp com o produto novo e o preço editado ---
  await click(`__lastIn('picoles-e-sorvetes').querySelector('button:not([data-zoom]):not([data-seller-edit])')`, 800)
  await click(`[...__dialog().querySelectorAll('button')].find((b) => b.textContent.includes('continuar comprando'))`, 900)
  await click(`__item('sundae').querySelector('button:not([data-zoom]):not([data-seller-edit])')`, 800)
  await click(`[...__dialog().querySelectorAll('input[type=radio]')][0]`, 200)
  await click(`__button('Continuar', __dialog())`, 700)
  await click(`[...__dialog().querySelectorAll('button')].find((b) => b.textContent.includes('ir para o carrinho'))`, 1200)
  check('carrinho: Picolé trufado R$ 3,00 e Sundae R$ 9,50 (total R$ 12,50)', await run(`[document.body.innerText.includes('Picolé trufado'), document.body.innerText.includes('R$ 12,50')]`), [true, true])
  await run(`__stubOpen()`)
  await click(`__q('input[value="pix"]')`)
  await click(`__button('Confirmar e Enviar Pedido no WhatsApp')`, 700)
  const message = (await run(`__openedText()`)) ?? ''
  check('WhatsApp com o produto novo e o preço editado', [message.includes('*1x Picolé trufado* — R$ 3,00'), message.includes('*1x Sundae* — R$ 9,50')], [true, true])

  // --- Complemento novo e esgotado no personalizador (Completo) ---
  await goto('/monte-seu-pedido/acai-oca', desktop)
  check('personalizador: "+ Adicionar complemento" em cada grupo', await run(`document.querySelectorAll('[data-seller-add]').length`), 4)
  await click(`[...document.querySelectorAll('[data-seller-add]')][0]`, 900)
  await choosePhoto(PHOTO)
  await run(`__set(__field('-nome'), 'Ovomaltine')`)
  await run(`__set(__field('-preco'), '0,00')`)
  await submitDialog(1500)
  check('complemento novo aparece nos adicionais', await run(`!!__q('button[aria-label="Adicionar Ovomaltine"]')`), true)
  await click(`[...document.querySelectorAll('[data-seller-edit]')].find((b) => b.textContent.trim().endsWith(': Granola'))`, 900)
  await click(`[...__dialog().querySelectorAll('label')].find((l) => l.textContent.trim() === 'Esgotado')`, 200)
  await submitDialog()
  await click(`__q('input[value="pote-200"]')`)
  await click(`__button('Completo', __q('[data-complete-bar]'))`, 600)
  check(
    'Completo: entra o complemento novo, fica de fora o esgotado (24 itens)',
    await run(`[__q('#resumo').innerText.includes('24 itens selecionados'), __q('#resumo').innerText.includes('Ovomaltine'), __q('#resumo').innerText.includes('Granola'), __q('button[aria-label="Adicionar Granola"]').getAttribute('aria-disabled')]`),
    [true, true, false, 'true'],
  )

  // --- Backup e restauração ---
  await goto('/monte-seu-pedido', desktop)
  await run(`(() => { window.__backup = null; const original = URL.createObjectURL; URL.createObjectURL = (blob) => { if (blob.type === 'application/json') blob.text().then((t) => { window.__backup = t }); return original(blob) }; HTMLAnchorElement.prototype.click = function () {}; return true })()`)
  await click(`__button('Backup / Restaurar')`, 800)
  await click(`__button('Baixar backup', __dialog())`, 1200)
  const backup = await run(`window.__backup`)
  check('backup baixado com as mudanças e a foto', [typeof backup === 'string' && backup.includes('Picolé trufado'), typeof backup === 'string' && backup.includes('data:image/')], [true, true])
  const file = join(outDir, 'backup.json')
  writeFileSync(file, backup ?? '')
  // Apaga as mudanças deste aparelho e restaura pelo arquivo.
  await run(`localStorage.removeItem('acai_doce_sabor_seller_catalog_v1'); true`)
  const { root } = await browser.send('DOM.getDocument', { depth: -1, pierce: true })
  const { nodeId } = await browser.send('DOM.querySelector', { nodeId: root.nodeId, selector: 'dialog[open] input[type=file]' })
  await browser.send('DOM.setFileInputFiles', { nodeId, files: [file.replaceAll('\\', '/')] })
  await sleep(1500)
  check('restaurar: aviso e o produto novo de volta', await run(`[__dialog()?.textContent.includes('Backup restaurado.'), [...document.querySelectorAll('[data-item] [id$="-nome"]')].some((h) => h.textContent === 'Picolé trufado')]`), [true, true])
  await run(`__dialog()?.close(); true`)
  await sleep(400)

  // --- Restaurar original e excluir ---
  await click(`__item('sundae').querySelector('[data-seller-edit]')`, 900)
  await click(`__button('Restaurar original', __dialog())`, 1200)
  check('"Restaurar original" devolve o Sundae a R$ 7,00', await run(`__item('sundae').querySelector('strong').textContent`), 'R$ 7,00')
  await click(`__lastIn('picoles-e-sorvetes').querySelector('[data-seller-edit]')`, 900)
  await click(`__button('Excluir item', __dialog())`, 300)
  await click(`__button('Excluir', __dialog().querySelector('[role=alertdialog]'))`, 1200)
  check('excluir com confirmação: o produto novo some (12 itens)', await run(`[[...document.querySelectorAll('[data-item] [id$="-nome"]')].some((h) => h.textContent === 'Picolé trufado'), __q('[data-section="picoles-e-sorvetes"] [data-flash-target] .nums').textContent]`), [false, '12 itens'])

  // --- Sair ---
  await click(`__button('Sair do Modo Vendedor')`, 600)
  check('"Sair do Modo Vendedor": sem faixa, sem ferramentas', await run(`[!!__q('[data-seller-bar]'), document.querySelectorAll('[data-seller-edit]').length, !!__q('[data-seller-access]')]`), [false, 0, true])

  // --- Celular: acesso pelo menu Categorias ---
  await goto('/monte-seu-pedido', { width: 390, height: 844 })
  await click(`[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Categorias')`, 700)
  check('celular: "Senha para vendedor" no rodapé do menu', await run(`__q('dialog[aria-labelledby="menu-categorias-titulo"] [data-seller-access]')?.textContent.trim()`), 'Senha para vendedor')
  await click(`__q('dialog[aria-labelledby="menu-categorias-titulo"] [data-seller-access]')`, 900)
  check('celular: o menu fecha e abre a janela da senha', await run(`[__q('dialog[aria-labelledby="menu-categorias-titulo"]').open, __dialog()?.querySelector('h2')?.textContent]`), [false, 'Acesso do Vendedor / Dono'])
  await login(PASSWORD)
  check('celular: modo vendedor ligado', await run(`!!__q('[data-seller-bar]')`), true)
  await click(`__button('Sair do Modo Vendedor')`, 500)

  check('console sem erros', browser.consoleProblems(), [])
} catch (error) {
  failures.push(`erro: ${error.message}`)
} finally {
  await run(`localStorage.clear(); indexedDB.deleteDatabase('acai_doce_sabor_seller_images'); true`).catch(() => {})
  browser.close()
}

if (failures.length) {
  console.log(`FALHAS (${failures.length} de ${checks}):`)
  for (const failure of failures) console.log(`- ${failure}`)
  process.exit(1)
}
console.log(`RESULTADO: as ${checks} conferências passaram`)
