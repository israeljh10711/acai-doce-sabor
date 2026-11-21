// Confere no navegador o painel do vendedor e o cardápio dinâmico (2026-11-21), num site na porta
// 5184 SEM o Supabase (modo de demonstração: os registros ficam no aparelho; o caminho da tela é o
// mesmo do Supabase):
// - painel só com o Modo Vendedor; abas Pedidos, Catálogo, Categorias, Produtos, Complementos,
//   Ofertas e Configurações da loja;
// - categoria nova aparece na loja; ocultar tira da loja; "Subir" muda a ordem; arquivar com
//   produtos é recusado;
// - produto direto, com variações e montável criados no painel aparecem na loja (o montável abre o
//   personalizador); foto enviada (e SVG recusado); duplicar cria uma cópia oculta; esgotar e
//   ocultar valem na loja; avisos "Há alterações não salvas.", "Alterações salvas com sucesso" e o
//   erro do montável sem tamanho;
// - grupo com grátis e preço extra cobra no personalizador;
// - oferta com preço promocional muda o preço do cartão; pausar volta ao normal;
// - Configurações da loja: sem "Cartão" o carrinho não oferece crédito nem débito; a chave Pix
//   nova aparece no carrinho; o nome da loja muda no cabeçalho;
// - 390 px sem rolagem lateral; console sem erros.
//
// Uso: node tests/browser/check-catalogo-vendedor.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'vite'
import { openBrowser, sleep } from './lib.mjs'

const PORT = 5184
const outDir = join(tmpdir(), 'acai-doce-sabor-conferencia', 'catalogo-vendedor')
mkdirSync(outDir, { recursive: true })
const failures = []
let checks = 0
function check(label, actual, expected) {
  checks++
  const pass = JSON.stringify(actual) === JSON.stringify(expected)
  if (!pass) failures.push(`${label}: obtido ${JSON.stringify(actual)}, esperado ${JSON.stringify(expected)}`)
  return pass
}

process.env.VITE_SUPABASE_URL = ''
process.env.VITE_SUPABASE_ANON_KEY = ''
process.env.VITE_SELLER_EMAIL = ''
const site = await createServer({
  configFile: join(process.cwd(), 'vite.config.ts'),
  cacheDir: join(tmpdir(), 'acai-doce-sabor-vite-catalogo-vendedor'),
  server: { port: PORT, host: '127.0.0.1', strictPort: true },
  logLevel: 'error',
})
await site.listen()
const baseUrl = `http://127.0.0.1:${PORT}`

const helpers = `
  window.__q = (selector) => document.querySelector(selector);
  window.__all = (selector) => [...document.querySelectorAll(selector)];
  window.__text = (el) => el?.innerText.replace(/\\s+/g, ' ').trim() ?? null;
  window.__set = (el, text) => {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, text);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  };
  window.__pick = (el, value) => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(el, value);
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  };
  window.__button = (text, root = document) => [...root.querySelectorAll('button')].find((b) => b.textContent.replace(/\\s+/g, ' ').trim().startsWith(text));
  window.__switch = (text, root = document) => [...root.querySelectorAll('label')].find((l) => l.textContent.includes(text))?.querySelector('input[type=checkbox]');
  window.__noOverflow = () => document.documentElement.scrollWidth <= window.innerWidth;
  window.__records = () => JSON.parse(localStorage.getItem('acai_doce_sabor_catalogo_v2') ?? 'null');
  window.__photo = (input, type) => new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = 60; canvas.height = 40;
    const context = canvas.getContext('2d'); context.fillStyle = '#6a1650'; context.fillRect(0, 0, 60, 40);
    canvas.toBlob((blob) => {
      const file = type === 'image/svg+xml' ? new File(['<svg xmlns="http://www.w3.org/2000/svg"/>'], 'x.svg', { type }) : new File([blob], 'foto.png', { type: 'image/png' });
      const transfer = new DataTransfer(); transfer.items.add(file);
      input.files = transfer.files; input.dispatchEvent(new Event('change', { bubbles: true })); resolve(true);
    }, 'image/png');
  });
  true;
`

const browser = await openBrowser(join(outDir, 'edge-profile'), 9389)
const run = async (expression) => {
  await browser.evaluate(helpers)
  return browser.evaluate(expression)
}
const click = async (expression, pause = 350) => {
  const ok = await run(`(() => { const el = ${expression}; if (!el) return false; el.scrollIntoView({ block: 'center' }); el.click(); return true })()`)
  if (!ok) throw new Error(`Elemento não encontrado: ${expression}`)
  await sleep(pause)
}
const set = (selector, value) => run(`__set(__q(${JSON.stringify(selector)}), ${JSON.stringify(value)})`)
const pick = (selector, value) => run(`__pick(__q(${JSON.stringify(selector)}), ${JSON.stringify(value)})`)
const waitFor = async (condition, timeout = 8000) => {
  for (let waited = 0; waited < timeout; waited += 100) {
    if (await run(`(() => { try { return !!(${condition}) } catch { return false } })()`)) return true
    await sleep(100)
  }
  return false
}
const shot = async (name) => writeFileSync(join(outDir, `${name}.png`), Buffer.from((await browser.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'))
const quiet = `sessionStorage.setItem('acai-doce-sabor:ofertas', JSON.stringify({ bag: [], last: null, dismissed: 3, stopped: true })); true`
const OPEN_NOW = JSON.stringify({ settings: { loja: { override: { state: 'open', until: Date.now() + 3_600_000 } } } })
const desktop = { width: 1280, height: 900 }
const phone = { width: 390, height: 844, mobile: true }
const admin = async (tab = '', viewport = desktop) => {
  await browser.goto(`${baseUrl}/vendedor${tab ? `?aba=${tab}` : ''}`, viewport)
  await run(quiet)
  await waitFor(`__q('[data-admin-tab]')`)
}
const save = async () => {
  await click(`__q('[data-save]')`, 500)
}
const savedOk = () => waitFor(`__q('[data-save-ok]')`, 4000)
const closeDialog = () => run(`(() => { const d = [...document.querySelectorAll('dialog[open]')].at(-1); d?.close(); return true })()`)
const menuCard = (id) => run(`__text(__q('[data-item="${id}"]'))`)

try {
  await browser.goto(`${baseUrl}/`, desktop)
  await run(`localStorage.clear(); sessionStorage.clear(); localStorage.setItem('acai_doce_sabor_seller_catalog_v1', ${JSON.stringify(OPEN_NOW)}); ${quiet}`)

  // --- Sem o Modo Vendedor: o painel pede a senha ---
  await browser.goto(`${baseUrl}/vendedor`, desktop)
  check('painel sem o Modo Vendedor pede a senha', await waitFor(`__q('[data-admin-login]')`), true)

  // --- Entra no Modo Vendedor ---
  await browser.goto(`${baseUrl}/monte-seu-pedido`, desktop)
  await run(quiet)
  await waitFor(`__q('[data-seller-access]')`)
  await click(`__q('[data-seller-access]')`, 800)
  await run(`(() => { const el = __q('#senha-vendedor'); __set(el, 'vendedor2026'); el.form.requestSubmit(); return true })()`)
  check('Modo Vendedor ligado', await waitFor(`__q('[data-seller-bar]')`), true)
  check('faixa do vendedor leva ao painel', await run(`__q('[data-admin-link]')?.getAttribute('href')`), '/vendedor')

  await admin()
  check('abas do painel', await run(`[__q('nav[aria-label="Seções do painel"] a')?.textContent, ...__all('[data-admin-tab]').map((a) => a.textContent)]`), [
    'Pedidos',
    'Catálogo',
    'Categorias',
    'Produtos',
    'Complementos',
    'Ofertas',
    'Configurações da loja',
  ])
  check('resumo do catálogo', await run(`!!__q('[data-admin-overview]')`), true)

  // --- Categorias ---
  await admin('categorias')
  await click(`__q('[data-new-category]')`)
  await set('#categoria-nome', 'Salgados')
  check('categoria nova: "Há alterações não salvas."', await waitFor(`__q('[data-dirty]')`), true)
  await save()
  check('categoria nova aparece na lista', await waitFor(`__q('[data-category="salgados"]')`), true)
  await click(`__q('[data-category="bebidas"] [data-move="subir"]')`, 600)
  const order = await run(`__all('[data-category]').map((li) => li.dataset.category)`)
  check('"Subir" muda a ordem das categorias', order.indexOf('bebidas') < order.indexOf('picoles-e-sorvetes'), true)
  await click(`__q('[data-category="bebidas"] [data-edit-category]')`)
  check('categoria com produtos não arquiva (botão desligado e aviso)', await run(`[__q('[data-archive-category]').disabled, __text(__q('[data-category-editor]')).includes('Mova ou arquive os produtos antes')]`), [true, true])
  await set('#categoria-nome', 'Bebidas geladas')
  await save()
  check('editar categoria: "Alterações salvas com sucesso"', await savedOk(), true)
  check('o aviso diz exatamente "Alterações salvas com sucesso"', await run(`__text(__q('[data-save-ok]'))`), 'Alterações salvas com sucesso')
  await closeDialog()

  // --- Produto direto na categoria nova ---
  await admin('produtos')
  await click(`__q('[data-new-product]')`)
  await click(`__q('input[data-kind="direto"]')`)
  await set('#produto-nome', 'Coxinha de Frango')
  await pick('#produto-categoria', 'salgados')
  await set('#produto-preco', '6,00')
  await set('#produto-descricao', 'Coxinha frita na hora.')
  await run(`__photo(__q('[data-product-editor] [data-photo-input]'), 'image/svg+xml')`)
  check('foto SVG recusada', await waitFor(`__text(__q('[data-photo-picker]'))?.includes('Use uma foto JPEG, PNG ou WebP.')`), true)
  await run(`__photo(__q('[data-product-editor] [data-photo-input]'), 'image/png')`)
  check('foto enviada (prévia e "Trocar foto")', await waitFor(`__q('[data-product-editor] [data-photo-picker] img') && __text(__q('[data-photo-pick]')) === 'Trocar foto'`, 6000), true)
  await waitFor("!__text(__q('[data-photo-picker]'))?.includes('Enviando')", 6000)
  await save()
  check('produto direto salvo', await waitFor(`__q('[data-product="coxinha-de-frango"]')`), true)
  check('produto direto guardado com a foto do aparelho', await run(`__records().products.find((p) => p.id === 'coxinha-de-frango')?.image.startsWith('idb:')`), true)

  // --- Produto com variações ---
  await click(`__q('[data-new-product]')`)
  await click(`__q('input[data-kind="variacoes"]')`)
  await set('#produto-nome', 'Pastel')
  await pick('#produto-categoria', 'salgados')
  await set('#produto-preco', '7,00')
  await click(`__q('[data-add-choice]')`)
  await click(`__q('[data-choice="0"] [data-add-option]')`)
  await set('#opcao-0-0', 'Carne')
  await click(`__q('[data-choice="0"] [data-add-option]')`)
  await set('#opcao-0-1', 'Queijo')
  await save()
  check('produto com variações salvo', await waitFor(`__q('[data-product="pastel"]')`), true)

  // --- Montável: sem tamanho é recusado; com tamanho e grupos, vai ao personalizador ---
  await click(`__q('[data-new-product]')`)
  await click(`__q('input[data-kind="montavel"]')`)
  await set('#produto-nome', 'Açaí Teste')
  await pick('#produto-categoria', 'barcas-e-potes')
  await save()
  check('montável sem tamanho: o erro aparece', await waitFor(`__text(__q('[data-save-error]')) === 'Produto montável precisa de pelo menos um tamanho.'`), true)
  await click(`__q('[data-add-variant]')`)
  await set('#tamanho-0-nome', 'Copo 300 ml')
  await set('#tamanho-0-preco', '15,00')
  await set('#tamanho-0-gratis', '2')
  await click(`__switch('Adicionais', __q('[data-product-group="dry"]'))`)
  await click(`__switch('Frutas', __q('[data-product-group="fruit"]'))`)
  await set('#produto-botao', 'Montar açaí Teste')
  await save()
  check('montável salvo', await waitFor(`__q('[data-product="acai-teste"]')`), true)

  // --- Duplicar, esgotar ---
  await click(`__q('[data-product="pastel"] [data-duplicate-product]')`)
  await save()
  check('"Duplicar produto" cria a cópia oculta', await waitFor(`__text(__q('[data-product="pastel-copia"]'))?.includes('Oculto')`), true)
  await click(`__q('[data-product="pastel"] [data-toggle-available]')`, 600)
  check('marcar esgotado no painel', await waitFor(`__text(__q('[data-product="pastel"]'))?.includes('Esgotado')`), true)

  // --- Na loja ---
  await run(`localStorage.setItem('acai_doce_sabor_seller_catalog_v1', ${JSON.stringify(OPEN_NOW)}); true`)
  await browser.goto(`${baseUrl}/monte-seu-pedido`, desktop)
  await run(quiet)
  await waitFor(`__q('[data-item="coxinha-de-frango"]')`)
  check('loja: a categoria nova com a coxinha', await run(`[!!__q('#secao-salgados'), __text(__q('[data-item="coxinha-de-frango"]'))?.includes('R$ 6,00')]`), [true, true])
  check('loja: a categoria renomeada', await run(`__text(__q('#secao-bebidas'))?.includes('Bebidas geladas')`), true)
  check('loja: a foto enviada aparece na coxinha', await waitFor(`[...__q('[data-item="coxinha-de-frango"]').querySelectorAll('img')].some((img) => img.src.startsWith('blob:'))`), true)
  check('loja: o pastel esgotado', await run(`/esgotado/i.test(__text(__q('[data-item="pastel"]')) ?? '')`), true)
  check('loja: a cópia oculta não aparece', await run(`!__q('[data-item="pastel-copia"]')`), true)
  check('loja: o montável novo tem o botão', await run(`__text(__q('[data-item="acai-teste"]'))?.includes('Montar açaí Teste')`), true)
  await browser.goto(`${baseUrl}/monte-seu-pedido/acai-teste`, desktop)
  await run(quiet)
  check('personalizador do montável novo abre', await waitFor(`__q('h1')?.textContent.includes('Açaí Teste')`), true)
  await click(`[...__all('button, label')].find((el) => el.textContent.includes('Copo 300 ml'))`, 500)
  check('personalizador: preço do tamanho', await waitFor(`__text(document.body).includes('R$ 15,00')`), true)

  // --- Grupo com grátis e preço extra ---
  await admin('complementos')
  await click(`__q('[data-group="fruit"] [data-edit-group]')`)
  await click(`__switch('Cobrar a partir de certa quantidade')`)
  await set('#grupo-gratis', '1')
  await set('#grupo-extra', '2,00')
  await save()
  check('grupo com grátis e preço extra salvo', await savedOk(), true)
  await closeDialog()
  check('o resumo do grupo mostra a regra', await waitFor(`__text(__q('[data-group="fruit"]'))?.includes('1 grátis, depois R$ 2,00 cada')`), true)
  check('o grupo mostra onde é usado', await run(`__text(__q('[data-group="fruit"]'))?.includes('Açaí Teste')`), true)
  await browser.goto(`${baseUrl}/monte-seu-pedido/acai-teste`, desktop)
  await run(quiet)
  await waitFor(`__q('h1')?.textContent.includes('Açaí Teste')`)
  await click(`[...__all('button, label')].find((el) => el.textContent.includes('Copo 300 ml'))`, 400)
  // O botão do complemento pelo rótulo exato (o da lupa também cita o nome).
  for (const fruit of ['Kiwi', 'Morango']) await click(`[...__all('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent.trim()) === '${fruit}')`, 300)
  check('personalizador: a segunda fruta custa o preço extra (R$ 17,00)', await waitFor(`__text(document.body).includes('R$ 17,00')`), true)

  // --- Oferta com preço promocional ---
  await admin('ofertas')
  await click(`__q('[data-new-offer]')`)
  await set('#oferta-titulo', 'Água gelada')
  await pick('#oferta-produto', 'agua-mineral-500-ml')
  await set('#oferta-preco', '1,50')
  await set('#oferta-frase', 'Água por apenas {preco}!')
  check('prévia da oferta com o preço', await waitFor(`__text(__q('[data-offer-preview]'))?.includes('Água por apenas R$ 1,50!')`), true)
  await save()
  check('oferta salva e ativa', await waitFor(`__q('[data-offer="agua-gelada"]')?.dataset.offerState === 'ativa'`), true)
  await browser.goto(`${baseUrl}/monte-seu-pedido`, desktop)
  await run(quiet)
  await waitFor(`__q('[data-item="agua-mineral-500-ml"]')`)
  check('loja: o preço promocional no cartão', (await menuCard('agua-mineral-500-ml'))?.includes('R$ 1,50'), true)
  await admin('ofertas')
  await click(`__q('[data-offer="agua-gelada"] [data-toggle-offer]')`, 600)
  check('oferta pausada', await waitFor(`__q('[data-offer="agua-gelada"]')?.dataset.offerState === 'pausada'`), true)
  await browser.goto(`${baseUrl}/monte-seu-pedido`, desktop)
  await run(quiet)
  await waitFor(`__q('[data-item="agua-mineral-500-ml"]')`)
  check('loja: pausada, o preço volta', (await menuCard('agua-mineral-500-ml'))?.includes('R$ 1,50'), false)

  // --- Configurações da loja ---
  await admin('loja')
  await waitFor(`__q('[data-admin-store]')`)
  await set('#loja-name', 'Açaí Doce Sabor Teste')
  await click(`__q('input[name="pagamento-cartao"]')`)
  await set('#loja-pixKey', '(83) 98888-7777')
  check('configurações: "Há alterações não salvas."', await waitFor(`__q('[data-dirty]')`), true)
  await save()
  check('configurações salvas', await savedOk(), true)
  check('cabeçalho com o nome novo', await waitFor(`__q('header')?.textContent.includes('Açaí Doce Sabor Teste')`), true)
  await run(`localStorage.setItem('acai-doce-sabor:carrinho', JSON.stringify({ v: 2, items: [{ kind: 'extra', id: 'c1', itemId: 'coxinha-de-frango', choices: [], quantity: 1 }] })); true`)
  await browser.goto(`${baseUrl}/carrinho`, desktop)
  await run(quiet)
  await waitFor(`__q('[data-finalize]')`)
  check('carrinho: o item novo do vendedor fica no carrinho', await run(`__text(document.body).includes('Coxinha de Frango')`), true)
  check('carrinho: sem "Cartão", só Pix e Dinheiro', await run(`__all('input[name="forma-de-pagamento"]').map((input) => input.value)`), ['pix', 'dinheiro'])
  await click(`__q('input[name="forma-de-pagamento"][value="pix"]')`)
  check('carrinho: a chave Pix nova', await waitFor(`__text(__q('[data-pix-card]'))?.includes('(83) 98888-7777')`), true)

  // --- Celular ---
  for (const tab of ['', 'categorias', 'produtos', 'complementos', 'ofertas', 'loja']) {
    await admin(tab, phone)
    await sleep(300)
    check(`390 px sem rolagem lateral (${tab || 'catalogo'})`, await run(`__noOverflow()`), true)
  }
  await admin('produtos', phone)
  await click(`__q('[data-product="acai-teste"] [data-edit-product]')`, 600)
  check('390 px: editor de produto sem rolagem lateral', await run(`__noOverflow()`), true)
  await shot('editor-produto-390')
  await closeDialog()

  check('console sem erros', browser.consoleProblems(), [])
} catch (error) {
  failures.push(`erro na conferência: ${error.message}`)
  await shot('erro').catch(() => undefined)
} finally {
  browser.close()
  await site.close()
}

console.log(`${checks - failures.length}/${checks} conferências passaram. Fotos em ${outDir}`)
if (failures.length) {
  console.log(failures.map((failure) => `FALHA ${failure}`).join('\n'))
  process.exit(1)
}
