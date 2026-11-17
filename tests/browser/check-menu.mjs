// Confere no navegador o cardápio completo (pedidos de 2026-11-15 e 2026-11-16): busca com sinônimos,
// a navegação (barra lateral no computador, botões da barra fixa no celular), as 5 seções abertas,
// itens do catálogo (diretos, com sabor e com "outro sabor"), o Pote de Açaí 1 Litro Montado e a
// Barca no personalizador, o carrinho e a mensagem do WhatsApp. A navegação em detalhe (menu do
// celular, seção marcada, contorno, destaques) fica em check-navigation.mjs.
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
  window.__shown = (el) => !!el && el.getBoundingClientRect().width > 0;
  // A navegação visível: a barra lateral no computador, os botões da barra fixa no celular.
  window.__navLinks = () => [...document.querySelectorAll('nav[aria-label="Categorias do cardápio"] a[data-nav], nav[aria-label="Atalhos do cardápio"] a[data-target]')].filter(__shown);
  window.__go = (anchor) => __navLinks().find((a) => (a.dataset.nav ?? a.dataset.target) === anchor);
  window.__drawers = () => [...document.querySelectorAll('[data-section]')].map((d) => d.dataset.section);
  window.__expanded = () => [...document.querySelectorAll('[data-section] [data-toggle]')].map((b) => b.getAttribute('aria-expanded'));
  window.__badges = () => [...document.querySelectorAll('[data-section] [data-flash-target] .nums')].map((s) => s.textContent);
  window.__items = (drawer) => [...document.querySelectorAll('[data-section="' + drawer + '"] [data-item] [id$="-nome"]')].map((h) => h.textContent);
  window.__mains = () => [['acai-oca', 'secao-acai-oca'], ['acai-tradicional', 'secao-acai-tradicional'], ['acai-batido', 'secao-acai-batido'], ['milk-shake', 'secao-milkshake']].filter(([, anchor]) => document.getElementById(anchor)).map(([slug]) => slug);
  window.__barBottom = () => { const bar = __q('[data-menu-bar]'); return getComputedStyle(bar).position === 'sticky' ? bar.getBoundingClientRect().bottom : 0 };
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
/** Comanda de 2026-11-17: nome e retirada na loja (sem endereço), antes de enviar o pedido. */
const FILL_CUSTOMER = `(() => {
  const name = document.querySelector('input[autocomplete="name"]');
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(name, 'Cliente Teste');
  name.dispatchEvent(new Event('input', { bubbles: true }));
  document.querySelector('input[type="radio"][value="retirada"]').click();
  return true;
})()`

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

const ANCHORS = [
  'secao-acai-oca',
  'secao-acai-tradicional',
  'secao-acai-batido',
  'secao-milkshake',
  'secao-combos',
  'secao-barcas-potes',
  'secao-picoles-sorvetes',
  'secao-bebidas',
  'secao-doces-bomboniere',
]
const DRAWER_IDS = ['combos-e-ofertas', 'barcas-e-potes', 'picoles-e-sorvetes', 'bebidas', 'doces-e-bomboniere']

try {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
    const at = `${viewport.width}px`

    // --- Início: o destaque do Açaí Oca usa a foto com o adesivo, a mesma do personalizador ---
    await page('/', viewport)
    await browser.evaluate(`localStorage.clear(); true`)
    await page('/', viewport)
    const ocaHome = await browser.evaluate(`(async () => { const img = __q('#secao-acai-oca [data-product-photo]'); img.scrollIntoView({ block: 'center' }); await Promise.race([img.decode().catch(() => null), new Promise((resolve) => setTimeout(resolve, 8000))]); return [img.dataset.productPhoto, new URL(img.currentSrc).pathname.split('/').slice(-2).join('/').replace(/-\\d+\\.webp$/, '')] })()`)
    check(`${at} início: destaque do Oca com a foto oficial (produtos/acai-oca)`, ocaHome, ['acai-oca', 'produtos/acai-oca'])
    check(`${at} início: busca e seções também no início`, await browser.evaluate(`[!!__q('#busca-cardapio'), __drawers().length]`), [true, 5])
    await page('/monte-seu-pedido/acai-oca', viewport)
    check(`${at} personalizador do Oca com a mesma foto`, await browser.evaluate(`__q('[aria-label="Prévia do pedido"] [data-product-photo]').dataset.productPhoto`), 'acai-oca')

    // --- Cardápio: busca, navegação e seções ---
    await page('/monte-seu-pedido', viewport)
    check(`${at} busca com o texto pedido`, await browser.evaluate(`__q('#busca-cardapio').placeholder`), 'Buscar açaí, barca, picolé, combo, refri, trufa...')
    check(`${at} busca acima da faixa de destaques`, await browser.evaluate(`__q('#busca-cardapio').getBoundingClientRect().top < __q('[data-highlights]').getBoundingClientRect().top`), true)
    check(`${at} as 9 seções na navegação, na ordem pedida`, await browser.evaluate(`__navLinks().map((a) => a.dataset.nav ?? a.dataset.target)`), ANCHORS)
    check(`${at} "Catálogo completo"`, await browser.evaluate(`__q('#catalogo-completo-titulo')?.textContent`), 'Catálogo completo')
    check(`${at} 5 seções, na ordem`, await browser.evaluate(`__drawers()`), DRAWER_IDS)
    check(`${at} as 5 seções começam abertas`, await browser.evaluate(`__expanded()`), ['true', 'true', 'true', 'true', 'true'])
    check(`${at} contagem de itens de cada seção`, await browser.evaluate(`__badges()`), ['5 itens', '11 itens', '12 itens', '2 itens', '14 itens'])
    check(
      `${at} seção Combos com os 5 combos, cada um com a sua foto`,
      await browser.evaluate(`[__items('combos-e-ofertas').length, document.querySelectorAll('[data-section="combos-e-ofertas"] img[data-item-photo]').length]`),
      [5, 5],
    )
    // As 44 fotos das seções (desde 2026-11-16, as da loja): rola até cada foto e espera carregar.
    // Nenhuma quebrada; todas num quadro quadrado, sem texto alternativo (o nome está ao lado) e
    // servidas da pasta local images/catalogo.
    const photos = await browser.evaluate(`(async () => {
      const imgs = [...document.querySelectorAll('[data-item] img[data-item-photo]')];
      const results = [];
      for (const img of imgs) {
        img.scrollIntoView({ block: 'center' });
        await Promise.race([img.decode().catch(() => null), new Promise((resolve) => setTimeout(resolve, 8000))]);
        const box = img.getBoundingClientRect();
        results.push({
          ok: img.complete && img.naturalWidth > 0,
          square: Math.round(box.width) === Math.round(box.height),
          size: Math.round(box.width),
          fit: getComputedStyle(img).objectFit,
          alt: img.alt,
          local: new URL(img.currentSrc).origin === location.origin && new URL(img.currentSrc).pathname.startsWith('/images/catalogo/'),
          id: img.dataset.itemPhoto,
        });
      }
      return results;
    })()`)
    check(`${at} as 44 fotos das seções carregam (nenhuma quebrada)`, [photos.length, photos.filter((p) => p.ok).map((p) => p.id).length], [44, 44])
    // As fotos da loja são em pé (o recorte da captura); o quadro do cartão é que é quadrado: 112 px no
    // celular (ao lado do texto) e a largura do cartão a partir de 640 px (em cima).
    check(`${at} fotos das seções: locais, sem texto alternativo`, photos.filter((p) => !p.local || p.alt !== '').map((p) => p.id), [])
    check(`${at} fotos das seções: todas num quadro quadrado`, photos.filter((p) => !p.square).map((p) => p.id), [])
    check(
      `${at} fotos das seções: ${viewport.width < 640 ? '112 px' : 'a largura do cartão (mais de 200 px)'}`,
      viewport.width < 640 ? [...new Set(photos.map((p) => p.size))] : photos.every((p) => p.size > 200),
      viewport.width < 640 ? [112] : true,
    )
    // Inteiras: as artes com texto e as embalagens que o corte tiraria; as outras preenchem o quadro.
    check(
      `${at} fotos das seções: inteiras só as 6 com texto ou embalagem`,
      photos.filter((p) => p.fit === 'contain').map((p) => p.id),
      ['kit-completo-casquinha', 'combo-1-litro', 'combo-de-sorvete', 'picole-gourmet', 'refrigerante-350-ml', 'fini-gelatinas'],
    )
    await browser.evaluate(`window.scrollTo(0, 0); true`)
    check(
      `${at} preço riscado e selo de oferta no Pote 1 Litro`,
      await browser.evaluate(`(() => { const card = __q('[data-item="pote-de-acai-1-litro"]'); return [card.querySelector('s')?.textContent, card.querySelector('strong')?.textContent, card.textContent.includes('Oferta')] })()`),
      ['R$ 33,00', 'R$ 30,00', true],
    )
    check(
      `${at} botões certos para cada tipo de item`,
      await browser.evaluate(`['combo-de-sorvete', 'combo-1-litro', 'kit-completo', 'pote-de-acai-1-litro'].map((id) => __itemButton(id).textContent.trim().split(':')[0])`),
      ['Escolher sabor', 'Escolher sabor', 'Escolher sabores', 'Montar pote'],
    )
    check(`${at} seção Barcas e Potes: 11 itens à vista`, await browser.evaluate(`[__q('[data-toggle="barcas-e-potes"]').getAttribute('aria-expanded'), __items('barcas-e-potes').length]`), ['true', 11])
    check(
      `${at} Açaí do Oca: "a partir de R$ 17,00" e "Escolher tamanho"; potes prontos: "Adicionar"`,
      await browser.evaluate(`[__q('[data-item="acai-do-oca-pronto"]').textContent.includes('a partir deR$ 17,00'), ...['acai-do-oca-pronto', 'pote-de-acai-2-litros'].map((id) => __itemButton(id).textContent.trim().split(':')[0])]`),
      [true, 'Escolher tamanho', 'Adicionar'],
    )
    await click(`__q('[data-toggle="barcas-e-potes"]')`)
    await sleep(400)
    check(
      `${at} "Recolher" fecha a seção Barcas e Potes e vira "Expandir"`,
      await browser.evaluate(`[__q('[data-toggle="barcas-e-potes"]').getAttribute('aria-expanded'), __items('barcas-e-potes').length, __q('[data-toggle="barcas-e-potes"]').textContent.trim().split(':')[0]]`),
      ['false', 0, 'Expandir'],
    )

    // A navegação leva à seção (e abre a recolhida): o título para logo abaixo da barra fixa (celular)
    // ou do topo da tela (computador), e a seção fica marcada.
    await click(`__go('secao-barcas-potes')`)
    await sleep(1000)
    check(`${at} navegação "Barcas e Potes" abre a seção recolhida`, await browser.evaluate(`[__q('[data-toggle="barcas-e-potes"]').getAttribute('aria-expanded'), __items('barcas-e-potes').length]`), ['true', 11])
    check(`${at} navegação "Barcas e Potes" para no título da seção`, await browser.evaluate(`(() => { const gap = __top('secao-barcas-potes') - __barBottom(); return gap > 0 && gap < 60 })()`), true)
    await click(`__go('secao-bebidas')`)
    await sleep(1000)
    check(`${at} navegação "Bebidas" rola até ela (logo abaixo da barra)`, await browser.evaluate(`(() => { const gap = __top('secao-bebidas') - __barBottom(); return gap > 0 && gap < 60 })()`), true)
    check(`${at} navegação "Bebidas" fica marcada`, await browser.evaluate(`__go('secao-bebidas').getAttribute('aria-current')`), 'true')
    await click(`__go('secao-milkshake')`)
    await sleep(1000)
    check(`${at} navegação "Milk-shake" rola até o cartão e o marca`, await browser.evaluate(`(() => { const gap = __top('secao-milkshake') - __barBottom(); return [gap > 0 && gap < 60, __go('secao-milkshake').getAttribute('aria-current')] })()`), [true, 'true'])

    // Busca e sinônimos.
    await browser.evaluate(`window.scrollTo(0, 0); true`)
    await search('batida')
    check(`${at} "batida": só o Açaí Batido`, await browser.evaluate(`[__mains(), __drawers()]`), [['acai-batido'], []])
    check(`${at} "batida": contagem`, await browser.evaluate(`__q('[data-search-summary]')?.textContent.includes('1 resultado encontrado para “batida”')`), true)
    await search('dindin')
    check(
      `${at} "dindin": Garrafinha e Cremosinho, seção aberta com "2 encontrados"`,
      await browser.evaluate(`[__mains(), __drawers(), __expanded(), __badges(), __items('picoles-e-sorvetes')]`),
      [[], ['picoles-e-sorvetes'], ['true'], ['2 encontrados'], ['Garrafinha', 'Cremosinho']],
    )
    await search('refri')
    check(`${at} "refri": Refrigerante 350 ml`, await browser.evaluate(`[__drawers(), __badges(), __items('bebidas')]`), [['bebidas'], ['1 encontrado'], ['Refrigerante 350 ml']])
    await search('casquinha')
    check(
      `${at} "casquinha": os itens com casquinha`,
      await browser.evaluate(`[...__items('combos-e-ofertas'), ...__items('picoles-e-sorvetes')]`),
      ['Kit Completo Casquinha DUO', 'Kit Completo', 'Combo 1 Litro', 'Combo de Sorvete', 'Cascão DUO', 'Moreninha'],
    )
    await search('ACAI')
    check(`${at} "ACAI" (sem acento): os açaís`, await browser.evaluate(`__mains().slice(0, 3)`), ['acai-oca', 'acai-tradicional', 'acai-batido'])
    await search('2l')
    check(
      `${at} "2l": os potes e kits de 2 litros`,
      await browser.evaluate(`[...__items('combos-e-ofertas'), ...__items('barcas-e-potes')]`),
      [
        'Kit Completo Casquinha DUO',
        'Kit Completo',
        'Pote de Açaí 2 Litros (Açaímix Brazil)',
        'Pote de Sorvete 2 Litros (Qbombom Premium)',
        'Pote de Sorvete 2 Litros (Ster Bom Clássicos 4 em 1)',
      ],
    )
    await search('xyz123')
    check(`${at} sem resultado: mensagem`, await browser.evaluate(`document.body.textContent.includes('Nenhum produto encontrado para “xyz123”')`), true)
    check(`${at} sem resultado: nenhuma seção marcada`, await browser.evaluate(`__q('[data-nav][aria-current], [data-target][aria-current]')`), null)
    await click(`[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Limpar busca')`)
    check(`${at} "Limpar busca" volta ao cardápio inteiro`, await browser.evaluate(`[__q('#busca-cardapio').value, __mains().length, __drawers().length]`), ['', 4, 5])
    await search('dindin')
    await click(`__go('secao-doces-bomboniere')`)
    await sleep(1000)
    check(`${at} seção escondida pela busca: a navegação limpa a busca e mostra a seção`, await browser.evaluate(`[__q('#busca-cardapio').value, __q('[data-toggle="doces-e-bomboniere"]').getAttribute('aria-expanded'), __items('doces-e-bomboniere').length]`), ['', 'true', 14])

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
    await click(`__go('secao-picoles-sorvetes')`)
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
    await click(`__go('secao-combos')`)
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
    check(`${at} kit: vai para o carrinho`, await browser.evaluate(`__lines()`), ['Água Mineral 500 ml', 'Picolé Gourmet', 'Kit Completo Casquinha DUO'])
    check(`${at} carrinho: total R$ 48,00 (2 + 2 + 3 + 41)`, await browser.evaluate(`__total().includes('R$ 48,00')`), true)
    check(`${at} carrinho: o sabor de cada item`, await browser.evaluate(`[document.body.textContent.includes('Sabor: Nutella'), document.body.textContent.includes('Sabor do sorvete (2 litros): Ninho com morango (outro sabor)')]`), [true, true])
    check(`${at} carrinho: itens do catálogo sem "Editar"`, await browser.evaluate(`[...document.querySelectorAll('[aria-label="Itens do carrinho"] > li')].map((li) => !!li.querySelector('a[href*="/monte-seu-pedido/"]'))`), [false, false, false])
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
      `${at} pote 1 L: a foto do item na prévia, com texto alternativo, "Ver foto" e o aviso de imagem ilustrativa`,
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
    check(`${at} pote 1 L: volta à seção Combos e Ofertas, com aviso`, await browser.evaluate(`[location.hash, __q('[data-toggle="combos-e-ofertas"]').getAttribute('aria-expanded'), __toast().includes('Pote de Açaí 1 Litro Montado')]`), ['#secao-combos', 'true', true])

    // --- Barca de Açaí (personalizador) ---
    await click(`__go('secao-barcas-potes')`)
    await sleep(700)
    await click(`__itemButton('barca-de-acai')`)
    await waitFor(`location.pathname === '/monte-seu-pedido/barca-de-acai'`)
    check(`${at} barca: pede a cobertura antes de adicionar`, await browser.evaluate(`[__q('#resumo').innerText.includes('Falta escolher a cobertura.'), [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Adicionar ao carrinho')).getAttribute('aria-disabled')]`), [true, 'true'])
    check(`${at} barca: as 6 coberturas, com foto`, await browser.evaluate(`[document.querySelectorAll('input[name="barca-de-acai-sabor"]').length, document.querySelectorAll('input[name="barca-de-acai-sabor"] ~ span img').length]`), [6, 6])
    check(`${at} barca: 7 adicionais grátis`, await browser.evaluate(`document.body.textContent.includes('0 de 7 adicionais grátis')`), true)
    await click(`__q('input[value="calda-chocolate"]')`)
    // 2 frutas: depois da segunda, a terceira fica bloqueada.
    await click(`__q('[aria-label="Kiwi"]')`)
    await click(`__q('[aria-label="Morango"]')`)
    check(
      `${at} barca: 2 frutas, a terceira bloqueada`,
      await browser.evaluate(`[__q('[aria-label="Kiwi"]').getAttribute('aria-pressed'), __q('[aria-label="Morango"]').getAttribute('aria-pressed'), __q('[aria-label="Banana"]').disabled, document.body.textContent.includes('2 de 2 frutas, sem custo · limite atingido')]`),
      ['true', 'true', true, true],
    )
    await click(`__q('[aria-label="Adicionar Kit Kat"]')`)
    await click(`[...document.querySelectorAll('button')].find((b) => b.textContent.includes('Adicionar ao carrinho'))`)
    const barcaText = await browser.evaluate(`__confirmText()`)
    check(`${at} barca: confirmação`, ['Barca de Açaí', 'CoberturaChocolate', 'FrutasKiwi e Morango', 'Kit Kat (+ R$ 4,00)', 'Valor do item:R$ 34,00'].map((t) => barcaText.includes(t)), [true, true, true, true, true])
    await click(`__in(__confirm(), 'ir para o carrinho')`)
    await waitFor(`location.pathname === '/carrinho' && __q('[aria-label="Itens do carrinho"]')`)
    check(`${at} carrinho completo: total R$ 111,00 (6 + 41 + 30 + 34)`, await browser.evaluate(`[__lines().length, __total().includes('R$ 111,00')]`), [4, true])

    // --- Mensagem do WhatsApp com tudo ---
    await browser.evaluate(`__stubOpen()`)
    await browser.evaluate(FILL_CUSTOMER)
    await sleep(300)
    await click(`__q('input[value="dinheiro"]')`)
    await browser.evaluate(`__type('#troco-para', '150')`)
    await sleep(250)
    await click(`[...document.querySelectorAll('button')].find((b) => b.textContent.includes('Confirmar e Enviar Pedido no WhatsApp'))`)
    const message = await browser.evaluate(`__openedText()`)
    // Comanda de 2026-11-17: o título vem depois do número (1️⃣, 2️⃣...); as outras linhas, inteiras.
    const has = (text) => (message ?? '').split('\n').some((line) => line === text || line.endsWith(` ${text}`))
    check(
      `${at} WhatsApp: cada item com quantidade, sabor, adicionais e valor`,
      [
        '*2x Picolé Gourmet* (Sabor: Nutella) — *R$ 6,00*',
        '*1x Kit Completo Casquinha DUO* — *R$ 41,00*',
        '   • *Sabor do sorvete (2 litros):* Ninho com morango (outro sabor)',
        '   • *Sabor da cobertura:* Caramelo',
        '*1x Pote de Açaí 1 Litro Montado* — *R$ 30,00*',
        '      • Adicionais: Granola, Paçoca',
        '      • Frutas: Kiwi',
        '*1x Barca de Açaí* (Cobertura: Chocolate) — *R$ 34,00*',
        '   ➕ *Cremes / Extras Pagos:* Kit Kat (+R$ 4,00)',
        '      • Frutas: Kiwi, Morango',
        '💰 *TOTAL A PAGAR:* *R$ 111,00*',
        '  🪙 *Troco para:* R$ 150,00 *(Levar R$ 39,00 de troco)*',
      ].map(has),
      Array(12).fill(true),
    )
    await click(`__q('input[value="pix"]')`)
    await click(`[...document.querySelectorAll('button')].find((b) => b.textContent.includes('Confirmar e Enviar Pedido no WhatsApp'))`)
    const pixLines = (await browser.evaluate(`__openedText()`)).split('\n')
    check(
      `${at} WhatsApp com Pix`,
      ['• *Método escolhido:* 💠 *Pix* — *R$ 111,00*', '  📎 _Envio o comprovante do Pix nesta conversa._'].map((t) => pixLines.includes(t)),
      [true, true],
    )
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
