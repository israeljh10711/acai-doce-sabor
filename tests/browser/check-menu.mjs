// Confere no navegador o cardápio completo (pedido de 2026-11-15): busca com sinônimos, barra de
// atalhos, as 5 gavetas, itens das gavetas (diretos, com sabor e com "outro sabor"), o Pote de
// Açaí 1 Litro Montado e a Barca no personalizador, o carrinho e a mensagem do WhatsApp.
// Também confere que o destaque do Açaí Oca usa a foto com o adesivo, a mesma do personalizador.
//
// Uso (com o site rodando, por exemplo em `npm run dev`):
//   node tests/browser/check-menu.mjs [endereçoBase]
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openBrowser, sleep } from './lib.mjs'

const baseUrl = process.argv[2] ?? 'http://127.0.0.1:5173'
const outDir = join(tmpdir(), 'acai-doce-sabor-conferencia', 'cardapio')

const failures = []
let checks = 0

const helpers = `
  window.__q = (selector) => document.querySelector(selector);
  window.__type = (selector, text) => {
    const el = __q(selector);
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, text);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  };
  window.__search = (text) => __type('#busca-cardapio', text);
  window.__pills = () => [...document.querySelectorAll('nav[aria-label="Atalhos do cardápio"] a')].map((a) => a.textContent.trim());
  window.__pill = (label) => [...document.querySelectorAll('nav[aria-label="Atalhos do cardápio"] a')].find((a) => a.textContent.trim() === label);
  window.__drawers = () => [...document.querySelectorAll('[data-drawer]')].map((d) => d.id);
  window.__expanded = () => [...document.querySelectorAll('[data-drawer] > :first-child button')].map((b) => b.getAttribute('aria-expanded'));
  window.__badges = () => [...document.querySelectorAll('[data-drawer] > :first-child button .nums')].map((s) => s.textContent);
  window.__items = (drawer) => [...document.querySelectorAll('#' + drawer + ' [data-item] [id$="-nome"]')].map((h) => h.textContent);
  window.__mains = () => ['acai-oca', 'acai-tradicional', 'acai-batido', 'milk-shake'].filter((id) => document.getElementById(id));
  window.__itemButton = (id) => __q('[data-item="' + id + '"] button:not([data-zoom]), [data-item="' + id + '"] a');
  window.__confirm = () => __q('dialog[role="alertdialog"]');
  window.__confirmText = () => (__confirm()?.open ? __confirm().textContent : null);
  window.__options = () => __q('dialog[aria-labelledby="opcoes-item-titulo"]');
  window.__in = (dialog, text) => [...dialog.querySelectorAll('button')].find((b) => b.textContent.includes(text));
  window.__radio = (dialog, value) => [...dialog.querySelectorAll('input[type=radio]')].find((i) => i.value === value);
  window.__toast = () => __q('[role="status"].fixed')?.textContent ?? '';
  window.__cartCount = () => (__q('header a[href="/carrinho"]')?.textContent.match(/[0-9]+/) ?? ['0'])[0];
  window.__total = () => __q('[aria-labelledby="total-titulo"]')?.innerText ?? '';
  window.__lines = () => [...document.querySelectorAll('[aria-label="Itens do carrinho"] > li article')].map((a) => a.getAttribute('aria-label'));
  window.__top = (id) => Math.round(document.getElementById(id).getBoundingClientRect().top);
  window.__stubOpen = () => { window.__opened = []; window.open = (url) => { window.__opened.push(url); return {}; }; return true };
  window.__openedText = () => (window.__opened?.length ? new URL(window.__opened.at(-1)).searchParams.get('text') : null);
  true;
`

function check(label, actual, expected) {
  checks++
  const pass = JSON.stringify(actual) === JSON.stringify(expected)
  if (!pass) failures.push(`${label}: obtido ${JSON.stringify(actual)}, esperado ${JSON.stringify(expected)}`)
  return pass
}

const browser = await openBrowser(join(outDir, 'edge-profile'), 9353)
const waitFor = async (condition, label = condition) => {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await browser.evaluate(`(() => { try { return !!(${condition}) } catch { return false } })()`)) {
      await browser.evaluate(helpers)
      return
    }
    await sleep(100)
  }
  throw new Error(`Esperou 10 s e não aconteceu: ${label}`)
}
const page = async (path, viewport) => {
  await browser.goto(baseUrl + path, viewport)
  await waitFor(`document.querySelector('h1')`)
  await browser.evaluate(`window.scrollTo(0, 0); true`)
}
const click = async (expression) => {
  await browser.evaluate(helpers)
  const ok = await browser.evaluate(`(() => { const el = ${expression}; if (!el) return false; el.click(); return true })()`)
  if (!ok) throw new Error(`Elemento não encontrado: ${expression}`)
  await sleep(350)
}
const search = async (text) => {
  await browser.evaluate(`__search(${JSON.stringify(text)})`)
  await sleep(350)
}

const PILLS = [
  'Açaí Oca',
  'Açaí Tradicional',
  'Açaí Batido',
  'Milk-shake',
  'Combos e Ofertas',
  'Barcas e Potes 1L/2L',
  'Picolés e Sorvetes',
  'Bebidas',
  'Doces e Bomboniere',
]
const DRAWER_IDS = ['combos-e-ofertas', 'barcas-e-potes', 'picoles-e-sorvetes', 'bebidas', 'doces-e-bomboniere']

try {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
    const at = `${viewport.width}px`

    // --- Início: o destaque do Açaí Oca usa a foto com o adesivo, a mesma do personalizador ---
    await page('/', viewport)
    await browser.evaluate(`localStorage.clear(); true`)
    await page('/', viewport)
    const ocaHome = await browser.evaluate(`(async () => { const img = __q('#acai-oca [data-product-photo]'); await img.decode(); return [img.dataset.productPhoto, new URL(img.currentSrc).pathname.split('/').slice(-2).join('/').replace(/-\\d+\\.webp$/, '')] })()`)
    check(`${at} início: destaque do Oca com a foto oficial (produtos/acai-oca)`, ocaHome, ['acai-oca', 'produtos/acai-oca'])
    check(`${at} início: busca e gavetas também no início`, await browser.evaluate(`[!!__q('#busca-cardapio'), __drawers().length]`), [true, 5])
    await page('/monte-seu-pedido/acai-oca', viewport)
    check(`${at} personalizador do Oca com a mesma foto`, await browser.evaluate(`__q('[aria-label="Prévia do pedido"] [data-product-photo]').dataset.productPhoto`), 'acai-oca')

    // --- Cardápio: busca, atalhos e gavetas ---
    await page('/monte-seu-pedido', viewport)
    check(`${at} busca com o texto pedido`, await browser.evaluate(`__q('#busca-cardapio').placeholder`), 'Buscar açaí, barca, picolé, combo, refri, trufa...')
    check(`${at} busca acima da barra de atalhos`, await browser.evaluate(`__q('#busca-cardapio').getBoundingClientRect().top < __q('nav[aria-label="Atalhos do cardápio"]').getBoundingClientRect().top`), true)
    check(`${at} 9 atalhos, na ordem pedida`, await browser.evaluate(`__pills()`), PILLS)
    check(`${at} "Mais opções do cardápio"`, await browser.evaluate(`__q('#mais-opcoes-titulo')?.textContent`), 'Mais opções do cardápio')
    check(`${at} 5 gavetas, na ordem`, await browser.evaluate(`__drawers()`), DRAWER_IDS)
    check(`${at} só a primeira gaveta começa aberta`, await browser.evaluate(`__expanded()`), ['true', 'false', 'false', 'false', 'false'])
    check(`${at} contagem de itens de cada gaveta`, await browser.evaluate(`__badges()`), ['5 itens', '10 itens', '12 itens', '2 itens', '14 itens'])
    check(
      `${at} gaveta 1 com os 5 combos, cada um com a sua foto; emblema só no botão da gaveta`,
      await browser.evaluate(`[__items('combos-e-ofertas').length, document.querySelectorAll('#combos-e-ofertas [data-emblem]').length, document.querySelectorAll('#combos-e-ofertas img[data-item-photo]').length]`),
      [5, 1, 5],
    )
    // As 43 fotos das gavetas (pedido de 2026-11-15): abre as gavetas, rola até cada foto e espera
    // carregar. Nenhuma quebrada; todas quadradas, com 96 px, preenchendo o quadro, sem texto
    // alternativo (o nome está ao lado) e servidas da pasta local images/catalogo.
    for (const id of DRAWER_IDS.slice(1)) await click(`__q('#${id}-gaveta')`)
    const photos = await browser.evaluate(`(async () => {
      const imgs = [...document.querySelectorAll('[data-item] img[data-item-photo]')];
      const results = [];
      for (const img of imgs) {
        img.scrollIntoView({ block: 'center' });
        await Promise.race([img.decode().catch(() => null), new Promise((resolve) => setTimeout(resolve, 8000))]);
        const box = img.getBoundingClientRect();
        results.push({
          ok: img.complete && img.naturalWidth > 0,
          square: img.naturalWidth === img.naturalHeight,
          size: Math.round(box.width) + 'x' + Math.round(box.height),
          fit: getComputedStyle(img).objectFit,
          alt: img.alt,
          local: new URL(img.currentSrc).origin === location.origin && new URL(img.currentSrc).pathname.startsWith('/images/catalogo/'),
          id: img.dataset.itemPhoto,
        });
      }
      return results;
    })()`)
    check(`${at} as 43 fotos das gavetas carregam (nenhuma quebrada)`, [photos.length, photos.filter((p) => p.ok).map((p) => p.id).length], [43, 43])
    check(`${at} fotos das gavetas: quadradas, locais, sem texto alternativo`, photos.filter((p) => !p.square || !p.local || p.alt !== '').map((p) => p.id), [])
    check(`${at} fotos das gavetas: 96 px, preenchendo o quadro`, [...new Set(photos.map((p) => p.size + ' ' + p.fit))], ['96x96 cover'])
    await browser.evaluate(`window.scrollTo(0, 0); true`)
    for (const id of DRAWER_IDS.slice(1)) await click(`__q('#${id}-gaveta')`)
    check(
      `${at} preço riscado e selo de oferta no Pote 1 Litro`,
      await browser.evaluate(`(() => { const card = __q('[data-item="pote-de-acai-1-litro"]'); return [card.querySelector('s')?.textContent, card.querySelector('strong')?.textContent, card.textContent.includes('Oferta')] })()`),
      ['R$ 33,00', 'R$ 30,00', true],
    )
    check(
      `${at} botões certos para cada tipo de item`,
      await browser.evaluate(`['combo-de-sorvete', 'combo-1-litro', 'kit-completo', 'pote-de-acai-1-litro'].map((id) => __itemButton(id).textContent.trim().split(':')[0])`),
      ['Adicionar', 'Escolher sabor', 'Escolher sabores', 'Montar pote'],
    )
    await click(`__q('#barcas-e-potes-gaveta')`)
    check(`${at} abrir a gaveta 2: 10 itens à vista`, await browser.evaluate(`[__q('#barcas-e-potes-gaveta').getAttribute('aria-expanded'), __items('barcas-e-potes').length]`), ['true', 10])
    await click(`__q('#barcas-e-potes-gaveta')`)
    await sleep(400)
    check(`${at} fechar a gaveta 2`, await browser.evaluate(`[__q('#barcas-e-potes-gaveta').getAttribute('aria-expanded'), __items('barcas-e-potes').length]`), ['false', 0])

    await click(`__pill('Bebidas')`)
    await sleep(900)
    check(`${at} atalho "Bebidas" abre a gaveta`, await browser.evaluate(`__q('#bebidas-gaveta').getAttribute('aria-expanded')`), 'true')
    check(`${at} atalho "Bebidas" rola até ela (logo abaixo da barra)`, await browser.evaluate(`(() => { const top = __top('bebidas'); return top > 40 && top < 200 })()`), true)
    check(`${at} atalho "Bebidas" fica marcado`, await browser.evaluate(`__pill('Bebidas').getAttribute('aria-current')`), 'true')
    await click(`__pill('Milk-shake')`)
    await sleep(900)
    check(`${at} atalho "Milk-shake" rola até o cartão`, await browser.evaluate(`(() => { const top = __top('milk-shake'); return top > 40 && top < 220 })()`), true)

    // Busca e sinônimos.
    await browser.evaluate(`window.scrollTo(0, 0); true`)
    await search('batida')
    check(`${at} "batida": só o Açaí Batido`, await browser.evaluate(`[__mains(), __drawers()]`), [['acai-batido'], []])
    check(`${at} "batida": contagem`, await browser.evaluate(`document.body.textContent.includes('1 produto encontrado')`), true)
    await search('dindin')
    check(
      `${at} "dindin": Garrafinha e Cremosinho, gaveta aberta com "2 encontrados"`,
      await browser.evaluate(`[__mains(), __drawers(), __expanded(), __badges(), __items('picoles-e-sorvetes')]`),
      [[], ['picoles-e-sorvetes'], ['true'], ['2 encontrados'], ['Garrafinha', 'Cremosinho']],
    )
    await search('refri')
    check(`${at} "refri": Refrigerante 350 ml`, await browser.evaluate(`[__drawers(), __badges(), __items('bebidas')]`), [['bebidas'], ['1 encontrado'], ['Refrigerante 350 ml']])
    await search('casquinha')
    check(
      `${at} "casquinha": os itens com casquinha`,
      await browser.evaluate(`[...__items('combos-e-ofertas'), ...__items('picoles-e-sorvetes')]`),
      ['Kit Completo Casquinha', 'Kit Completo', 'Combo 1 Litro', 'Combo de Sorvete', 'Cascão DUO', 'Moreninha'],
    )
    await search('ACAI')
    check(`${at} "ACAI" (sem acento): os açaís`, await browser.evaluate(`__mains().slice(0, 3)`), ['acai-oca', 'acai-tradicional', 'acai-batido'])
    await search('2l')
    check(
      `${at} "2l": os potes e kits de 2 litros`,
      await browser.evaluate(`[...__items('combos-e-ofertas'), ...__items('barcas-e-potes')]`),
      ['Kit Completo Casquinha', 'Kit Completo', 'Pote de Açaí 2 Litros (Açaímix)', 'Pote de Sorvete 2 Litros (Sabores Especiais)', 'Pote de Sorvete 2 Litros (Tradicional)'],
    )
    await search('xyz123')
    check(`${at} sem resultado: mensagem`, await browser.evaluate(`document.body.textContent.includes('Nenhum produto encontrado para “xyz123”')`), true)
    check(`${at} sem resultado: nenhum atalho marcado`, await browser.evaluate(`__q('nav[aria-label="Atalhos do cardápio"] [aria-current]')`), null)
    await click(`[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Limpar busca')`)
    check(`${at} "Limpar busca" volta ao cardápio inteiro`, await browser.evaluate(`[__q('#busca-cardapio').value, __mains().length, __drawers().length]`), ['', 4, 5])
    await search('dindin')
    await click(`__pill('Doces e Bomboniere')`)
    await sleep(900)
    check(`${at} atalho escondido pela busca limpa a busca e abre a gaveta`, await browser.evaluate(`[__q('#busca-cardapio').value, __q('#doces-e-bomboniere-gaveta').getAttribute('aria-expanded'), __items('doces-e-bomboniere').length]`), ['', 'true', 14])

    // --- Item direto: Água Mineral ---
    await click(`__itemButton('agua-mineral-500-ml')`)
    check(`${at} água: confirmação sem adicionar`, await browser.evaluate(`[__confirm().open, __cartCount()]`), [true, '0'])
    const aguaText = await browser.evaluate(`__confirmText()`)
    check(`${at} água: produto e valor na confirmação`, ['Água Mineral 500 ml', 'Valor do item:R$ 2,00'].map((t) => aguaText.includes(t)), [true, true])
    check(
      `${at} água: os três botões (sem escolha, "Voltar")`,
      await browser.evaluate(`[...__confirm().querySelectorAll('button:not([data-zoom])')].map((b) => b.textContent.trim())`),
      ['Adicionar e ir para o carrinho', 'Adicionar e continuar comprando', 'Voltar'],
    )
    await click(`__in(__confirm(), 'Voltar')`)
    check(`${at} água: "Voltar" não adiciona e devolve o foco`, await browser.evaluate(`[__confirm().open, __cartCount(), document.activeElement === __itemButton('agua-mineral-500-ml')]`), [false, '0', true])
    for (let i = 0; i < 2; i++) {
      await click(`__itemButton('agua-mineral-500-ml')`)
      await click(`__in(__confirm(), 'continuar comprando')`)
    }
    await sleep(300)
    check(`${at} água duas vezes: aviso e 2 no carrinho`, await browser.evaluate(`[__toast().includes('Adicionado ao carrinhoÁgua Mineral 500 ml'), __cartCount()]`), [true, '2'])

    // --- Item com sabor: Picolé Gourmet (Voltar e editar mantém o sabor) ---
    await click(`__pill('Picolés e Sorvetes')`)
    await sleep(700)
    await click(`__itemButton('picole-gourmet')`)
    check(`${at} picolé: abre a escolha de sabor`, await browser.evaluate(`[__options()?.open, __q('#opcoes-item-titulo')?.textContent]`), [true, 'Escolha o sabor'])
    check(`${at} picolé: aviso de disponibilidade`, await browser.evaluate(`__options().textContent.includes('Favor verificar com a nossa atendente a disponibilidade de sabores.')`), true)
    await click(`__in(__options(), 'Continuar')`)
    check(`${at} picolé: sem sabor, pede para escolher`, await browser.evaluate(`[__options().open, __options().textContent.includes('Escolha uma opção.')]`), [true, true])
    await click(`__radio(__options(), 'Nutella')`)
    await click(`__in(__options(), 'Continuar')`)
    check(`${at} picolé: confirmação com o sabor`, await browser.evaluate(`[__options().open, __confirmText()?.includes('SaborNutella'), __confirmText()?.includes('Valor do item:R$ 3,00')]`), [false, true, true])
    await click(`__in(__confirm(), 'Voltar e editar')`)
    check(`${at} picolé: "Voltar e editar" volta com Nutella marcado`, await browser.evaluate(`[__confirm().open, __options()?.open, __radio(__options(), 'Nutella').checked]`), [false, true, true])
    await click(`__in(__options(), 'Continuar')`)
    await click(`__in(__confirm(), 'continuar comprando')`)
    check(`${at} picolé: 3 no carrinho`, await browser.evaluate(`__cartCount()`), '3')

    // --- Kit com "Outro sabor" ---
    await click(`__pill('Combos e Ofertas')`)
    await sleep(700)
    await click(`__itemButton('kit-completo-casquinha')`)
    check(`${at} kit: dois grupos de sabor`, await browser.evaluate(`[__q('#opcoes-item-titulo').textContent, __options().querySelectorAll('fieldset').length]`), ['Escolha os sabores', 2])
    await click(`__radio(__options(), '__outro__')`)
    await browser.evaluate(`__type('dialog[open] input[type=text]', '*Ninho* com morango')`)
    await click(`__radio(__options(), 'Caramelo')`)
    await click(`__in(__options(), 'Continuar')`)
    const kitText = await browser.evaluate(`__confirmText()`)
    check(
      `${at} kit: "outro sabor" limpo e a cobertura na confirmação`,
      ['Ninho com morango (outro sabor)', 'Sabor da coberturaCaramelo', 'Valor do item:R$ 41,00'].map((t) => kitText.includes(t)),
      [true, true, true],
    )
    await click(`__in(__confirm(), 'ir para o carrinho')`)
    await waitFor(`location.pathname === '/carrinho' && __q('[aria-label="Itens do carrinho"]')`)
    check(`${at} kit: vai para o carrinho`, await browser.evaluate(`__lines()`), ['Água Mineral 500 ml', 'Picolé Gourmet', 'Kit Completo Casquinha'])
    check(`${at} carrinho: total R$ 48,00 (2 + 2 + 3 + 41)`, await browser.evaluate(`__total().includes('R$ 48,00')`), true)
    check(`${at} carrinho: o sabor de cada item`, await browser.evaluate(`[document.body.textContent.includes('Sabor: Nutella'), document.body.textContent.includes('Sabor do sorvete (2 litros): Ninho com morango (outro sabor)')]`), [true, true])
    check(`${at} carrinho: itens das gavetas sem "Editar"`, await browser.evaluate(`[...document.querySelectorAll('[aria-label="Itens do carrinho"] > li')].map((li) => !!li.querySelector('a[href*="/monte-seu-pedido/"]'))`), [false, false, false])
    await click(`[...document.querySelectorAll('[aria-label="Itens do carrinho"] > li')][1].querySelector('[aria-label="Aumentar quantidade"]')`)
    check(`${at} carrinho: +1 picolé = R$ 51,00`, await browser.evaluate(`__total().includes('R$ 51,00')`), true)
    await click(`[...document.querySelectorAll('[aria-label="Itens do carrinho"] > li')][0].querySelector('button[class*="red"]')`)
    check(`${at} carrinho: remover a água = R$ 47,00`, await browser.evaluate(`[__lines().length, __total().includes('R$ 47,00')]`), [2, true])

    // --- Pote de Açaí 1 Litro Montado (personalizador) ---
    await page('/monte-seu-pedido', viewport)
    await click(`__itemButton('pote-de-acai-1-litro')`)
    await waitFor(`location.pathname === '/monte-seu-pedido/pote-de-acai-1-litro' && __q('h1')?.textContent === 'Pote de Açaí 1 Litro Montado'`)
    check(`${at} pote 1 L: tamanho já escolhido, R$ 30,00 e 7 grátis`, await browser.evaluate(`[__q('input[value="pote-1-litro"]').checked, __q('#resumo').innerText.includes('R$ 30,00'), document.body.textContent.includes('0 de 7 adicionais grátis')]`), [true, true, true])
    check(
      `${at} pote 1 L: a foto da gaveta na prévia, com texto alternativo, "Ver foto" e o aviso de imagem ilustrativa`,
      await browser.evaluate(`(async () => {
        const img = __q('[aria-label="Prévia do pedido"] img[data-item-photo="pote-de-acai-1-litro"]');
        if (!img) return null;
        await img.decode().catch(() => null);
        return [img.naturalWidth > 0, img.alt.length > 10, [...document.querySelectorAll('button')].some((b) => b.textContent.includes('Ver foto')), __q('[aria-label="Prévia do pedido"]').textContent.includes('Imagens meramente ilustrativas')];
      })()`),
      [true, true, true, true],
    )
    check(`${at} pote 1 L: selo e preço riscado no topo`, await browser.evaluate(`[document.body.textContent.includes('De R$ 33,00 por R$ 30,00'), __q('[aria-label="Destaques"]')?.textContent]`), [true, 'Oferta'])
    for (const name of ['Granola', 'Paçoca']) await click(`__q('[aria-label="Adicionar ${name}"]')`)
    await click(`__q('[aria-label="Kiwi"]')`)
    await click(`[...document.querySelectorAll('button')].find((b) => b.textContent.includes('Adicionar ao carrinho'))`)
    const poteText = await browser.evaluate(`__confirmText()`)
    check(`${at} pote 1 L: confirmação`, ['Pote de Açaí 1 Litro Montado', 'AdicionaisGranola e Paçoca', 'FrutasKiwi', 'Valor do item:R$ 30,00'].map((t) => poteText.includes(t)), [true, true, true, true])
    await click(`__in(__confirm(), 'continuar comprando')`)
    await waitFor(`location.pathname === '/monte-seu-pedido' && __toast().includes('Adicionado ao carrinho')`)
    check(`${at} pote 1 L: volta à gaveta Combos e Ofertas, com aviso`, await browser.evaluate(`[location.hash, __q('#combos-e-ofertas-gaveta').getAttribute('aria-expanded'), __toast().includes('Pote de Açaí 1 Litro Montado')]`), ['#combos-e-ofertas', 'true', true])

    // --- Barca de Açaí (personalizador) ---
    await click(`__pill('Barcas e Potes 1L/2L')`)
    await sleep(700)
    await click(`__itemButton('barca-de-acai')`)
    await waitFor(`location.pathname === '/monte-seu-pedido/barca-de-acai'`)
    check(`${at} barca: pede a cobertura antes de adicionar`, await browser.evaluate(`[__q('#resumo').innerText.includes('Falta escolher a cobertura.'), [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Adicionar ao carrinho')).getAttribute('aria-disabled')]`), [true, 'true'])
    check(`${at} barca: as 6 coberturas, com foto`, await browser.evaluate(`[document.querySelectorAll('input[name="barca-de-acai-sabor"]').length, document.querySelectorAll('input[name="barca-de-acai-sabor"] ~ span img').length]`), [6, 6])
    await click(`__q('input[value="calda-chocolate"]')`)
    await click(`__q('[aria-label="Adicionar Kit Kat"]')`)
    await click(`[...document.querySelectorAll('button')].find((b) => b.textContent.includes('Adicionar ao carrinho'))`)
    const barcaText = await browser.evaluate(`__confirmText()`)
    check(`${at} barca: confirmação`, ['Barca de Açaí', 'CoberturaChocolate', 'Kit Kat (+ R$ 4,00)', 'Valor do item:R$ 34,00'].map((t) => barcaText.includes(t)), [true, true, true, true])
    await click(`__in(__confirm(), 'ir para o carrinho')`)
    await waitFor(`location.pathname === '/carrinho' && __q('[aria-label="Itens do carrinho"]')`)
    check(`${at} carrinho completo: total R$ 111,00 (6 + 41 + 30 + 34)`, await browser.evaluate(`[__lines().length, __total().includes('R$ 111,00')]`), [4, true])

    // --- Mensagem do WhatsApp com tudo ---
    await browser.evaluate(`__stubOpen()`)
    await click(`__q('input[value="dinheiro"]')`)
    await browser.evaluate(`__type('#troco-para', '150')`)
    await sleep(250)
    await click(`[...document.querySelectorAll('button')].find((b) => b.textContent.includes('Confirmar e Enviar Pedido no WhatsApp'))`)
    const message = await browser.evaluate(`__openedText()`)
    check(
      `${at} WhatsApp: cada item com quantidade, sabor, adicionais e valor`,
      [
        '*2x Picolé Gourmet* — R$ 6,00 (R$ 3,00 cada)',
        '• Sabor: Nutella',
        '*1x Kit Completo Casquinha* — R$ 41,00',
        '• Sabor do sorvete (2 litros): Ninho com morango (outro sabor)',
        '• Sabor da cobertura: Caramelo',
        '*1x Pote de Açaí 1 Litro Montado* — R$ 30,00',
        '• Adicionais: Granola, Paçoca',
        '• Frutas: Kiwi',
        '*1x Barca de Açaí* — R$ 34,00',
        '• Cobertura: Chocolate',
        '• Adicionais pagos: Kit Kat (+ R$ 4,00)',
        '*TOTAL DO PEDIDO: R$ 111,00*',
        '*TROCO PARA:* R$ 150,00 *(Levar troco de R$ 39,00)*',
      ].map((line) => message?.split('\n').includes(line)),
      Array(13).fill(true),
    )
    await click(`__q('input[value="pix"]')`)
    await click(`[...document.querySelectorAll('button')].find((b) => b.textContent.includes('Confirmar e Enviar Pedido no WhatsApp'))`)
    check(`${at} WhatsApp com Pix`, (await browser.evaluate(`__openedText()`)).split('\n').slice(-2), ['*FORMA DE PAGAMENTO:* Pix', 'Envio o comprovante do Pix nesta conversa.'])
    check(`${at} console sem erros`, browser.consoleProblems(), [])
  }
} catch (error) {
  failures.push(`ERRO: ${error.message}`)
} finally {
  browser.close()
}

for (const failure of failures) console.log('FALHOU:', failure)
console.log(failures.length === 0 ? `RESULTADO: as ${checks} conferências passaram` : `RESULTADO: ${failures.length} falha(s) em ${checks} conferências`)
process.exit(failures.length === 0 ? 0 : 1)
