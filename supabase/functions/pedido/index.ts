// @ts-nocheck
// Função "pedido" do Açaí Doce Sabor (Supabase Edge Function).
// ARQUIVO GERADO por `npm run build:pedido` a partir de src/server/pedidoFunction.ts: não edite aqui.
// Cole este arquivo inteiro no editor da função "pedido" (veja docs/supabase.md).
// src/utils/text.ts
/**
* Texto em forma de comparação: sem acentos e em minúsculas. "Açaí" e "acai" ficam iguais.
* O cedilha também sai (é um sinal combinado na forma decomposta), então "ç" vira "c".
*/
function foldText(text) {
	return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}
/** Primeira letra maiúscula, o resto como veio. */
function capitalize(text) {
	return text.charAt(0).toUpperCase() + text.slice(1);
}
// src/features/catalog/extras.ts
/**
* "Mais opções do cardápio": as 5 gavetas da vitrine, com os itens, preços e sabores enviados
* pelo responsável em 2026-11-15 e, nas gavetas 1 e 2, atualizados pelo catálogo do WhatsApp da
* loja (pedido de 2026-11-16). Preços em centavos.
*
* - Cada item tem uma foto (`image`, em `public/images/catalogo/`). Desde 2026-11-16 são fotos da
*   loja, recortadas das capturas do catálogo do WhatsApp (`scripts/fotos/whatsapp.json` e
*   `importar-whatsapp.mjs`); só uma continua de banco (`scripts/fotos/catalogo.json`). Alguns
*   sabores têm a foto do pote daquele sabor (`photos` na escolha). Créditos em /creditos.
* - Uma escolha pode mudar o preço (`prices`: o tamanho do Açaí do Oca).
* - `keywords` alimentam a busca, com os sinônimos do pedido ("dindin", "refri", "cascão"...).
* - `action` decide o botão do cartão:
*   - `direct_confirm`: vai direto para a confirmação;
*   - `flavor_modal`: abre a escolha de sabor (`choices`);
*   - `customizer`: abre o personalizador de um produto (`menu.ts`).
*/
/** As seções como estão no código (a base das mudanças do vendedor). */
var BASE_DRAWERS = [
	{
		id: "combos-e-ofertas",
		title: "Combos e Ofertas",
		navLabel: "Combos e Ofertas",
		pillLabel: "Combos",
		subtitle: "Kits com casquinhas, combos de sorvete e o pote de 1 litro montado.",
		anchor: "secao-combos",
		icon: "gift",
		keywords: [
			"combo",
			"combos",
			"oferta",
			"ofertas",
			"promocao"
		]
	},
	{
		id: "barcas-e-potes",
		title: "Barcas e Potes Família (1L, 1,5L e 2L)",
		navLabel: "Barcas e Potes Família",
		pillLabel: "Barcas e Potes",
		subtitle: "Barca, potes de açaí e potes de sorvete de 1, 1,5 e 2 litros.",
		anchor: "secao-barcas-potes",
		icon: "sailboat",
		keywords: ["familia", "potes familia"]
	},
	{
		id: "picoles-e-sorvetes",
		title: "Picolés e Sorvetes",
		navLabel: "Picolés e Sorvetes",
		pillLabel: "Picolés e Sorvetes",
		subtitle: "Picolés, copos de sorvete, sundae, cascão, cremosinho e coberturas.",
		anchor: "secao-picoles-sorvetes",
		icon: "popsicle",
		keywords: ["gelado", "gelados"]
	},
	{
		id: "bebidas",
		title: "Bebidas",
		navLabel: "Bebidas",
		pillLabel: "Bebidas",
		subtitle: "Refrigerante em lata e água mineral.",
		anchor: "secao-bebidas",
		icon: "glassWater",
		keywords: ["bebida", "bebidas"]
	},
	{
		id: "doces-e-bomboniere",
		title: "Doces e Bomboniere",
		navLabel: "Doces e Bomboniere",
		pillLabel: "Doces",
		subtitle: "Brownie, trufas, balas, chicletes, pipocas, salgadinho e chocolates.",
		anchor: "secao-doces-bomboniere",
		icon: "candy",
		keywords: [
			"doce",
			"doces",
			"bomboniere"
		]
	}
];
var POTE_2L_QBOMBOM = [
	"Sensação",
	"Chocolate",
	"Napolitano",
	"Unicórnio",
	"Pavê",
	"Toffee",
	"Crocante",
	"Brownie",
	"Creme com passas",
	"Nata com goiabada",
	"Sonho de valsa",
	"Trio (Chocolate, flocos e creme)"
];
var POTE_1_5L_QBOMBOM = [
	"Mousse de maracujá",
	"Leitinho trufado",
	"Iogurte grego",
	"Qmaltine",
	"Cookies cream",
	"Qgresco"
];
var POTE_1L_QBOMBOM = [
	"Qbrounie",
	"Brigadeiro",
	"Flocos",
	"Napolitano"
];
var STER_BOM_DUETO = [
	"Azul com Creme",
	"Nata Uva",
	"Abacaxi com Coco",
	"Nata com Morango",
	"Nata com Chocolate",
	"Morango com Chocolate"
];
var COBERTURAS_STERBOM = [
	"Uva",
	"Morango",
	"Chocolate",
	"Caramelo",
	"Leite condensado"
];
var TRADICIONAIS = [
	"Napolitano",
	"Chocolate",
	"Morango",
	"Flocos",
	"Creme"
];
var direct = { type: "direct_confirm" };
var flavor = (options, allowOther = false) => ({
	type: "flavor_modal",
	choices: [{
		id: "sabor",
		label: "Sabor",
		options,
		...allowOther ? { allowOther } : {}
	}]
});
/** Escolha de sabor com a foto do pote de cada sabor (`fotos`: sabor → arquivo em images/catalogo). */
var flavorWithPhotos = (options, fotos, photoAlt, allowOther = false) => ({
	type: "flavor_modal",
	choices: [{
		id: "sabor",
		label: "Sabor",
		options,
		photos: Object.fromEntries(Object.entries(fotos).map(([option, file]) => [option, `images/catalogo/${file}`])),
		photoAlt,
		...allowOther ? { allowOther } : {}
	}]
});
var kitChoices = {
	type: "flavor_modal",
	choices: [{
		id: "sorvete",
		label: "Sabor do sorvete (2 litros)",
		options: POTE_2L_QBOMBOM,
		allowOther: true
	}, {
		id: "cobertura",
		label: "Sabor da cobertura",
		options: COBERTURAS_STERBOM
	}]
};
var inDrawer = (drawer, items) => items.map((item) => ({
	...item,
	drawer
}));
/** O cardápio das seções como está no código (a base das mudanças do vendedor). */
var BASE_EXTRA_ITEMS = [
	...inDrawer("combos-e-ofertas", [
		{
			id: "kit-completo-casquinha",
			name: "Kit Completo Casquinha DUO",
			description: "Pote 2 litros + cobertura 300g da sua preferência e 10 und de casquinha DUO.",
			image: "images/catalogo/kit-completo-casquinha-duo.jpg",
			imageAlt: "Kit com pacote de casquinhas DUO, frasco de cobertura e pote de sorvete Qbombom Trio de 2 litros",
			priceCents: 4100,
			keywords: [
				"kit",
				"completo",
				"casquinha",
				"duo",
				"pote",
				"2 litros",
				"2l",
				"cobertura",
				"combo",
				"oferta",
				"cascao"
			],
			action: kitChoices
		},
		{
			id: "kit-completo",
			name: "Kit Completo",
			description: "1 Pote de sorvete 2 litros da sua preferência + 1 cobertura da sua preferência + 1 pacote com 10 und de casquinhas.",
			image: "images/catalogo/kit-completo.jpg",
			imageAlt: "Kit com frasco de cobertura de chocolate, pacote de casquinhas e pote de sorvete Qbombom Napolitano",
			priceCents: 4100,
			keywords: [
				"kit",
				"completo",
				"combo",
				"sorvete",
				"2 litros",
				"2l",
				"oferta"
			],
			action: kitChoices
		},
		{
			id: "pote-de-acai-1-litro",
			name: "Pote de Açaí 1 Litro Montado",
			description: "Pote de 1 Litro com até 7 adicionais grátis à sua escolha.",
			image: "images/catalogo/pote-1-litro-acai-montado.jpg",
			imageAlt: "Pote de 1 litro de açaí com morango, banana, gotas de chocolate e calda de chocolate",
			priceCents: 3e3,
			originalPriceCents: 3300,
			badge: "Oferta",
			keywords: [
				"pote",
				"1 litro",
				"1l",
				"acai",
				"montado",
				"oferta",
				"promocao"
			],
			action: {
				type: "customizer",
				product: "pote-de-acai-1-litro",
				label: "Montar pote"
			}
		},
		{
			id: "combo-1-litro",
			name: "Combo 1 Litro",
			description: "Pote de sorvete 1 litro + 10 casquinhas.",
			image: "images/catalogo/combo-1-litro.jpg",
			imageAlt: "Arte do combo: pote de sorvete Qbombom Napolitano de 1 litro e 10 casquinhas",
			priceCents: 2399,
			keywords: [
				"combo",
				"1 litro",
				"1l",
				"casquinhas",
				"sorvete",
				"oferta",
				"cascao",
				"qbombom"
			],
			action: {
				type: "flavor_modal",
				choices: [{
					id: "sorvete",
					label: "Sabor do sorvete (1 litro)",
					options: POTE_1L_QBOMBOM
				}]
			}
		},
		{
			id: "combo-de-sorvete",
			name: "Combo de Sorvete",
			description: "1 litro do sorvete Ster Bom Dueto + 10 unidades de casquinhas para compartilhar.",
			image: "images/catalogo/combo-de-sorvete.jpg",
			imageAlt: "Arte do combo: potes de sorvete Ster Bom Dueto de 1 litro e 10 casquinhas",
			priceCents: 2e3,
			keywords: [
				"combo",
				"sorvete",
				"casquinhas",
				"oferta",
				"cascao",
				"1 litro",
				"1l",
				"dueto",
				"ster bom",
				"sterbom"
			],
			action: {
				type: "flavor_modal",
				choices: [{
					id: "sorvete",
					label: "Sabor do Ster Bom Dueto (1 litro)",
					options: STER_BOM_DUETO
				}]
			}
		}
	]),
	...inDrawer("barcas-e-potes", [
		{
			id: "barca-de-acai",
			name: "Barca de Açaí",
			description: "Inclui 1 Cobertura, 2 Frutas e 7 Adicionais à sua escolha.",
			image: "images/catalogo/barca-de-acai.jpg",
			imageAlt: "Barca de açaí com confetes, gotas de chocolate, morango e cobertura, diante do coração de neon da loja",
			priceCents: 3e3,
			keywords: [
				"barca",
				"acai",
				"cobertura",
				"frutas",
				"adicionais"
			],
			action: {
				type: "customizer",
				product: "barca-de-acai",
				label: "Montar barca"
			}
		},
		{
			id: "pote-de-acai-2-litros",
			name: "Pote de Açaí 2 Litros (Açaímix Brazil)",
			description: "Pote família 2 litros de Açaí Cremoso Açaímix pronto para consumo.",
			image: "images/catalogo/pote-acai-2-litros.jpg",
			imageAlt: "Pote de 2 litros de açaí Açaímix Brazil",
			priceCents: 3500,
			keywords: [
				"pote",
				"dois litros",
				"2 litros",
				"2l",
				"acai",
				"acaimix",
				"brazil",
				"pronto"
			],
			action: direct
		},
		{
			id: "acai-de-1-litro",
			name: "Açaí de 1 Litro (Açaímix Brazil)",
			description: "Pote de 1 litro de Açaí Cremoso Açaímix pronto para consumo.",
			image: "images/catalogo/acai-1-litro.jpg",
			imageAlt: "Pote de 1 litro de açaí Açaímix Brazil, pronto para consumo",
			priceCents: 2300,
			keywords: [
				"acai",
				"1 litro",
				"1l",
				"pote",
				"acaimix",
				"brazil",
				"pronto"
			],
			action: direct
		},
		{
			id: "acai-do-oca-pronto",
			name: "Açaí do Oca (Pote Pronto)",
			description: "Pote pronto original Oca do Açaí Tradicional (escolha 500 ml ou 1 Litro).",
			image: "images/catalogo/acai-do-oca-pote.jpg",
			imageAlt: "Potes de açaí Oca do Açaí, sabor tradicional",
			priceCents: 1700,
			keywords: [
				"acai",
				"oca",
				"oca do acai",
				"pote",
				"pronto",
				"tradicional",
				"500ml",
				"1 litro",
				"1l"
			],
			action: {
				type: "flavor_modal",
				choices: [{
					id: "tamanho",
					label: "Tamanho",
					options: ["500 ml", "1 Litro"],
					prices: {
						"500 ml": 1700,
						"1 Litro": 3300
					}
				}]
			}
		},
		{
			id: "pote-de-sorvete-1-5-litro",
			name: "Pote de Sorvete 1,5 Litro (Qbombom)",
			description: "Pote de sorvete cremoso 1,5L em 6 sabores especiais.",
			image: "images/catalogo/pote-1-5l-qgresco.jpg",
			imageAlt: "Pote de sorvete Qbombom de 1,5 litro, sabor Qgresco",
			priceCents: 3e3,
			keywords: [
				"pote",
				"1,5 litros",
				"1.5l",
				"sorvete",
				"qbombom",
				"torta gelada"
			],
			action: flavorWithPhotos(POTE_1_5L_QBOMBOM, {
				Qgresco: "pote-1-5l-qgresco.jpg",
				"Mousse de maracujá": "pote-1-5l-maracuja.jpg",
				"Leitinho trufado": "pote-1-5l-leitinho-trufado.jpg",
				"Iogurte grego": "pote-1-5l-iogurte-grego.jpg",
				"Cookies cream": "pote-1-5l-cookies-cream.jpg",
				Qmaltine: "pote-1-5l-qmaltine.jpg"
			}, "Pote de sorvete Qbombom de 1,5 litro", true)
		},
		{
			id: "pote-de-sorvete-2-litros-especiais",
			name: "Pote de Sorvete 2 Litros (Qbombom Premium)",
			description: "Pote de sorvete 2L em 12 sabores irresistíveis.",
			image: "images/catalogo/pote-2l-sensacao.jpg",
			imageAlt: "Pote de sorvete Qbombom Premium de 2 litros, sabor Sensação",
			priceCents: 2800,
			keywords: [
				"pote",
				"2 litros",
				"2l",
				"sorvete",
				"qbombom",
				"premium"
			],
			action: flavorWithPhotos(POTE_2L_QBOMBOM, {
				Sensação: "pote-2l-sensacao.jpg",
				Chocolate: "pote-2l-chocolate.jpg",
				Unicórnio: "pote-2l-unicornio.jpg",
				Pavê: "pote-2l-pave.jpg",
				Crocante: "pote-2l-crocante.jpg",
				"Creme com passas": "pote-2l-creme-passas.jpg",
				"Nata com goiabada": "pote-2l-nata-goiabada.jpg",
				"Sonho de valsa": "pote-2l-sonho-de-valsa.jpg",
				"Trio (Chocolate, flocos e creme)": "pote-2l-trio.jpg",
				Napolitano: "pote-2l-napolitano.jpg"
			}, "Pote de sorvete Qbombom Premium de 2 litros", true)
		},
		{
			id: "pote-de-sorvete-2-litros-tradicional",
			name: "Pote de Sorvete 2 Litros (Ster Bom Clássicos 4 em 1)",
			description: "Pote 2L Clássicos 4 em 1: Chocolate meio amargo, Creme, Morango e Flocos.",
			image: "images/catalogo/pote-2l-sterbom-4em1.jpg",
			imageAlt: "Pote de sorvete Ster Bom Clássicos 4 em 1 de 2 litros",
			priceCents: 2600,
			keywords: [
				"pote",
				"2 litros",
				"2l",
				"sorvete",
				"ster bom",
				"sterbom",
				"classicos",
				"4 em 1"
			],
			action: direct
		},
		{
			id: "pote-de-sorvete-1-litro-especiais",
			name: "Pote de Sorvete 1 Litro (Qbombom Premium)",
			description: "Pote de sorvete 1L Premium nos sabores Qbrounie, Brigadeiro, Flocos e Napolitano.",
			image: "images/catalogo/pote-1l-qbrounie.jpg",
			imageAlt: "Pote de sorvete Qbombom Premium de 1 litro, sabor Qbrounie",
			priceCents: 1800,
			keywords: [
				"pote",
				"1 litro",
				"1l",
				"sorvete",
				"qbombom",
				"qbombon",
				"premium"
			],
			action: flavorWithPhotos(POTE_1L_QBOMBOM, {
				Qbrounie: "pote-1l-qbrounie.jpg",
				Brigadeiro: "pote-1l-brigadeiro.jpg",
				Flocos: "pote-1l-flocos.jpg",
				Napolitano: "pote-1l-napolitano.jpg"
			}, "Pote de sorvete Qbombom Premium de 1 litro")
		},
		{
			id: "pote-de-sorvete-1-litro-tradicional",
			name: "Pote de Sorvete 1 Litro (Tradicional)",
			description: "Pote de sorvete 1 litro — sabores tradicionais",
			image: "images/catalogo/pote-sorvete-1l-tradicional.jpg",
			imageAlt: "Sorvete com gotas de chocolate servido com a concha",
			priceCents: 1600,
			keywords: [
				"pote",
				"1 litro",
				"1l",
				"sorvete"
			],
			action: flavor(TRADICIONAIS)
		},
		{
			id: "acai-com-creme-ninho",
			name: "Açaí com Creme Ninho (Pronto)",
			description: "Copo montado com açaí, creme de Ninho e amendoim",
			image: "images/catalogo/acai-creme-ninho-pronto.jpg",
			imageAlt: "Copo de açaí em camadas com creme ninho, frutas, granola, jujuba e amendoim",
			priceCents: 1200,
			keywords: [
				"acai",
				"creme ninho",
				"ninho",
				"amendoim",
				"pronto"
			],
			action: direct
		},
		{
			id: "acai-mix-150-ml",
			name: "Açaí Mix 150 ml",
			description: "Potinho individual de açaí 150 ml",
			image: "images/catalogo/acai-mix-150ml.jpg",
			imageAlt: "Potinho de 150 ml de açaí Açaímix Brazil",
			priceCents: 500,
			keywords: [
				"acai",
				"mix",
				"150ml",
				"potinho"
			],
			action: direct
		}
	]),
	...inDrawer("picoles-e-sorvetes", [
		{
			id: "copo-diamante-negro",
			name: "Copo Diamante Negro",
			description: "Sorvete sabor Diamante Negro com cobertura e morango",
			image: "images/catalogo/copo-diamante-negro.jpg",
			imageAlt: "Copo de sorvete Diamante Negro com gotas de chocolate e morango, com tampa bolha",
			priceCents: 1200,
			keywords: [
				"copo",
				"diamante negro",
				"sorvete",
				"chocolate"
			],
			action: direct
		},
		{
			id: "copao-400-ml",
			name: "Copão 400 ml",
			description: "Copão de sorvete 400 ml (Napolitano e sabores)",
			image: "images/catalogo/copao-400ml.jpg",
			imageAlt: "Dois copões de sorvete Qbombom, Trio e Napolitano",
			priceCents: 950,
			keywords: [
				"copao",
				"400ml",
				"sorvete",
				"napolitano"
			],
			action: flavor([
				"Napolitano",
				"Chocolate",
				"Morango",
				"Flocos"
			])
		},
		{
			id: "sundae",
			name: "Sundae",
			description: "Sorvete cremoso no copo com calda especial",
			image: "images/catalogo/sundae.jpg",
			imageAlt: "Sundae Qbombom no copo, com calda e farofa por cima",
			priceCents: 700,
			keywords: [
				"sundae",
				"sorvete",
				"calda",
				"morango",
				"chocolate"
			],
			action: flavor([
				"Morango",
				"Chocolate",
				"Caramelo"
			])
		},
		{
			id: "cascao-duo",
			name: "Cascão DUO",
			description: "Cascão crocante recheado sabor baunilha com chocolate",
			image: "images/catalogo/cascao-duo.jpg",
			imageAlt: "Pacote de cascões DUO de baunilha e chocolate",
			priceCents: 700,
			keywords: [
				"cascao",
				"duo",
				"casquinha",
				"baunilha",
				"chocolate"
			],
			action: direct
		},
		{
			id: "cobertura-sterbom",
			name: "Cobertura Sterbom (Frasco)",
			description: "Frasco de cobertura para sorvete (sabores variados)",
			image: "images/catalogo/cobertura-sterbom.jpg",
			imageAlt: "Cinco frascos de cobertura Ster Bom",
			priceCents: 700,
			keywords: [
				"cobertura",
				"sterbom",
				"calda",
				"sorvete"
			],
			action: flavor([
				"Chocolate",
				"Morango",
				"Caramelo",
				"Leite Condensado",
				"Uva"
			])
		},
		{
			id: "moreninha",
			name: "Moreninha",
			description: "Casquinha com sorvete banhada na cobertura crocante de chocolate",
			image: "images/catalogo/moreninha.jpg",
			imageAlt: "Moreninha: casquinha com sorvete banhada em chocolate",
			priceCents: 350,
			keywords: [
				"moreninha",
				"casquinha",
				"sorvete",
				"chocolate",
				"cascao"
			],
			action: direct
		},
		{
			id: "picole-trufado",
			name: "Picolé Trufado",
			description: "Picolé cremoso recheado (Mousse de Maracujá e sabores)",
			image: "images/catalogo/picole-trufado.jpg",
			imageAlt: "Picolé trufado mordido, com recheio vermelho",
			priceCents: 300,
			keywords: [
				"picole",
				"trufado",
				"mousse",
				"maracuja",
				"recheado"
			],
			action: flavor([
				"Mousse de Maracujá",
				"Chocolate",
				"Morango",
				"Ninho com Nutella"
			])
		},
		{
			id: "picole-gourmet",
			name: "Picolé Gourmet",
			description: "Picolé artesanal super cremoso",
			image: "images/catalogo/picole-gourmet.jpg",
			imageAlt: "Tabela dos picolés gourmet, com os sabores",
			priceCents: 300,
			keywords: [
				"picole",
				"gourmet",
				"nutella",
				"pacoca",
				"iogurte"
			],
			action: flavor([
				"Nutella",
				"Paçoca",
				"Morango com Chocolate",
				"Iogurte",
				"Maracujá"
			])
		},
		{
			id: "garrafinha",
			name: "Garrafinha",
			description: "Geladinho cremoso na garrafinha",
			image: "images/catalogo/garrafinha.jpg",
			imageAlt: "Duas garrafinhas de geladinho, uma azul e uma de chocolate",
			priceCents: 300,
			keywords: [
				"garrafinha",
				"geladinho",
				"dindin",
				"sacole"
			],
			action: flavor([
				"Chocolate",
				"Morango",
				"Blue Ice",
				"Coco"
			])
		},
		{
			id: "roscao-mel",
			name: "Roscão Mel",
			description: "Sorvete no roscão / copinho",
			image: "images/catalogo/roscao-mel.jpg",
			imageAlt: "Sorvete branco com calda vermelha por cima",
			priceCents: 200,
			keywords: [
				"roscao",
				"mel",
				"sorvete"
			],
			action: direct
		},
		{
			id: "picole-comum",
			name: "Picolé Comum",
			description: "Picolé refrescante em sabores variados",
			image: "images/catalogo/picole-comum.jpg",
			imageAlt: "Picolé de coco da Welder ao lado da embalagem",
			priceCents: 150,
			keywords: [
				"picole",
				"comum",
				"fruta"
			],
			action: flavor([
				"Coco",
				"Chocolate",
				"Morango",
				"Uva",
				"Limão",
				"Maracujá"
			])
		},
		{
			id: "cremosinho",
			name: "Cremosinho",
			description: "Dindin / geladinho cremoso",
			image: "images/catalogo/cremosinho.jpg",
			imageAlt: "Pacotes de cremosinho Gostosinho de 80 g",
			priceCents: 150,
			keywords: [
				"cremosinho",
				"dindin",
				"geladinho",
				"sacole"
			],
			action: flavor([
				"Chocolate",
				"Morango",
				"Coco",
				"Maracujá",
				"Ninho"
			])
		}
	]),
	...inDrawer("bebidas", [{
		id: "refrigerante-350-ml",
		name: "Refrigerante 350 ml",
		description: "Lata 350 ml bem gelada",
		image: "images/catalogo/refrigerante-350ml.jpg",
		imageAlt: "Latas de Fanta Uva, Fanta Laranja, Guaraná Antarctica Zero e Coca-Cola",
		priceCents: 500,
		keywords: [
			"refrigerante",
			"refri",
			"350ml",
			"lata",
			"coca",
			"guarana",
			"fanta"
		],
		action: flavor([
			"Coca-Cola",
			"Guaraná Antarctica",
			"Fanta Laranja",
			"Fanta Uva",
			"Sprite"
		])
	}, {
		id: "agua-mineral-500-ml",
		name: "Água Mineral 500 ml",
		description: "Garrafa de água mineral sem gás 500 ml",
		image: "images/catalogo/agua-mineral-500ml.jpg",
		imageAlt: "Garrafa de água mineral Indaiá de 500 ml",
		priceCents: 200,
		keywords: [
			"agua",
			"mineral",
			"500ml",
			"indaia"
		],
		action: direct
	}]),
	...inDrawer("doces-e-bomboniere", [
		{
			id: "quadradinho-de-brownie",
			name: "Quadradinho de Brownie",
			description: "Brownie artesanal macio de chocolate",
			image: "images/catalogo/quadradinho-brownie.jpg",
			imageAlt: "Quadradinho de brownie embalado, com o adesivo da Açaí Doce Sabor",
			priceCents: 599,
			originalPriceCents: 600,
			keywords: [
				"brownie",
				"quadradinho",
				"chocolate",
				"doce"
			],
			action: direct
		},
		{
			id: "pippos",
			name: "Pippo's",
			description: "Salgadinho Pippo's sabor Churrasco",
			image: "images/catalogo/pippos.jpg",
			imageAlt: "Pacotes de salgadinho Pippo's Vitaminado",
			priceCents: 375,
			keywords: [
				"pippos",
				"pippo's",
				"salgadinho",
				"churrasco"
			],
			action: direct
		},
		{
			id: "trufas",
			name: "Trufas",
			description: "Trufa artesanal recheada",
			image: "images/catalogo/trufas.jpg",
			imageAlt: "Trufa de chocolate cortada, com recheio cremoso",
			priceCents: 250,
			originalPriceCents: 300,
			keywords: [
				"trufa",
				"trufas",
				"chocolate",
				"beijinho",
				"maracuja",
				"coco"
			],
			action: flavor([
				"Chocolate 50%",
				"Beijinho",
				"Maracujá",
				"Coco"
			])
		},
		{
			id: "trident",
			name: "Trident",
			description: "Chiclete Trident sem açúcar",
			image: "images/catalogo/trident.jpg",
			imageAlt: "Pacotes de chiclete Trident",
			priceCents: 250,
			keywords: [
				"trident",
				"chiclete",
				"goma",
				"menta"
			],
			action: flavor([
				"Menta",
				"Hortelã",
				"Melancia",
				"Tutti-Frutti"
			])
		},
		{
			id: "batom-ao-leite",
			name: "Batom ao Leite",
			description: "Chocolate Garoto Batom ao Leite",
			image: "images/catalogo/batom-ao-leite.jpg",
			imageAlt: "Caixa de chocolates Baton ao leite",
			priceCents: 200,
			keywords: [
				"batom",
				"chocolate",
				"ao leite"
			],
			action: direct
		},
		{
			id: "mentos",
			name: "Mentos",
			description: "Bala mastigável Mentos",
			image: "images/catalogo/mentos.jpg",
			imageAlt: "Rolos de bala Mentos Fruit",
			priceCents: 200,
			keywords: [
				"mentos",
				"bala",
				"fruit",
				"menta"
			],
			action: flavor([
				"Fruit (Frutas)",
				"Mint (Menta)",
				"Rainbow"
			])
		},
		{
			id: "halls",
			name: "Halls",
			description: "Bala refrescante Halls",
			image: "images/catalogo/halls.jpg",
			imageAlt: "Pacotes de bala Halls de morango",
			priceCents: 200,
			keywords: [
				"halls",
				"bala",
				"menta",
				"cereja",
				"morango"
			],
			action: flavor([
				"Extra Forte",
				"Menta",
				"Cereja",
				"Morango",
				"Melancia"
			])
		},
		{
			id: "pipoca-kigarot-75g",
			name: "Pipoca Kigarot 75g",
			description: "Pipoca doce/salgada Kigarot pacote 75g — Sabor Manteiga",
			image: "images/catalogo/pipoca-kigarot-75g.jpg",
			imageAlt: "Pacote de pipoca Kigarot sabor manteiga de 75 g",
			priceCents: 200,
			keywords: [
				"pipoca",
				"kigarot",
				"75g",
				"manteiga"
			],
			action: direct
		},
		{
			id: "pipoca-kigarot-45g",
			name: "Pipoca Kigarot 45g",
			description: "Pipoca Kigarot pacote 45g — Sabor Manteiga",
			image: "images/catalogo/pipoca-kigarot-45g.jpg",
			imageAlt: "Pacotes de pipoca Kigarot sabor manteiga de 45 g",
			priceCents: 150,
			keywords: [
				"pipoca",
				"kigarot",
				"45g",
				"manteiga"
			],
			action: direct
		},
		{
			id: "fini-gelatinas",
			name: "Fini Gelatinas",
			description: "Pacotinho individual de balas de gelatina Fini",
			image: "images/catalogo/fini-gelatinas.jpg",
			imageAlt: "Pacotinhos de balas de gelatina Fini",
			priceCents: 150,
			keywords: [
				"fini",
				"gelatina",
				"bala",
				"doce"
			],
			action: direct
		},
		{
			id: "docile-canudinho",
			name: "Docile Canudinho",
			description: "Canudinho doce Docile",
			image: "images/catalogo/docile-canudinho.jpg",
			imageAlt: "Canudinhos doces Docile",
			priceCents: 150,
			keywords: [
				"docile",
				"canudinho",
				"fini",
				"doce"
			],
			action: direct
		},
		{
			id: "jujuba",
			name: "Jujuba",
			description: "Pacote de balas de goma / jujuba colorida",
			image: "images/catalogo/jujuba.jpg",
			imageAlt: "Rolos de balas de goma Gomets",
			priceCents: 100,
			keywords: [
				"jujuba",
				"goma",
				"bala",
				"gomets"
			],
			action: direct
		},
		{
			id: "nucita",
			name: "Nucita",
			description: "Creme doce Napolitano Nucita",
			image: "images/catalogo/nucita.jpg",
			imageAlt: "Caixa do doce Ducrem Napolitano",
			priceCents: 50,
			keywords: [
				"nucita",
				"creme",
				"napolitano",
				"doce"
			],
			action: direct
		},
		{
			id: "chocolate-recheado",
			name: "Chocolate Recheado",
			description: "Bombom / chocolate recheado individual",
			image: "images/catalogo/chocolate-recheado.jpg",
			imageAlt: "Bombons Bee recheados de vários sabores",
			priceCents: 50,
			keywords: [
				"chocolate",
				"recheado",
				"bombom",
				"uva"
			],
			action: direct
		}
	])
];
/**
* Os itens como aparecem agora: a base com as mudanças do vendedor (`catalogStore.ts`). É uma
* ligação viva: quem importa vê a troca feita por `setExtraItems`.
*/
var EXTRA_ITEMS = BASE_EXTRA_ITEMS;
/** As seções como aparecem agora (o vendedor pode renomear). Ligação viva. */
var DRAWERS = BASE_DRAWERS;
var drawersById = new Map(DRAWERS.map((drawer) => [drawer.id, drawer]));
/** Troca as seções (só `catalogStore.ts` chama). */
function setDrawers(drawers) {
	DRAWERS = drawers;
	drawersById = new Map(drawers.map((drawer) => [drawer.id, drawer]));
}
var itemsById = new Map(EXTRA_ITEMS.map((item) => [item.id, item]));
/** Troca os itens (só `catalogStore.ts` chama). */
function setExtraItems(items) {
	EXTRA_ITEMS = items;
	itemsById = new Map(items.map((item) => [item.id, item]));
}
function drawerById(id) {
	return drawersById.get(id);
}
function getExtraItem(id) {
	return itemsById.get(id);
}
/** Escolhas obrigatórias do item. Vazio nos itens sem escolha. */
function choiceGroupsOf(item) {
	return item.action.type === "flavor_modal" ? item.action.choices : [];
}
/**
* Limpa o "outro sabor" escrito pelo cliente: tira caracteres de controle e os símbolos que
* formatam texto no WhatsApp (* _ ~ `), junta os espaços e corta em 40 caracteres.
*/
function cleanOtherText(text) {
	return text.replace(/[\p{Cc}\p{Cf}*_~`]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 40).trim();
}
/**
* Confere as escolhas de um item pelas regras dele: cada grupo precisa de uma opção da lista
* ou, quando o grupo aceita, de um "outro sabor" escrito. Um "outro sabor" igual a uma opção
* (ignorando acentos e maiúsculas) vira a própria opção. Devolve `null` quando falta ou sobra
* algo inválido; chaves que o item não tem são ignoradas.
*/
function normalizeChoices(item, raw, options = {}) {
	if (item.action.type === "customizer" || !options.ignoreStock && item.available === false) return null;
	const choices = {};
	for (const group of choiceGroupsOf(item)) {
		const value = raw[group.id];
		if (typeof value !== "string") return null;
		if (group.options.includes(value)) {
			if (!options.ignoreStock && group.unavailable?.includes(value)) return null;
			choices[group.id] = value;
			continue;
		}
		if (!group.allowOther) return null;
		const text = cleanOtherText(value);
		if (!text) return null;
		choices[group.id] = group.options.find((option) => foldText(option) === foldText(text)) ?? text;
	}
	return Object.freeze(choices);
}
/** Valor de uma escolha como o cliente lê: a opção, ou "Morango com ninho (outro sabor)". */
function choiceValueText(group, value) {
	return group.options.includes(value) ? value : `${capitalize(value)} (outro sabor)`;
}
/** Linhas "Sabor: Nutella" de um item com as escolhas feitas, na ordem dos grupos. */
function choiceRows(item, choices) {
	return choiceGroupsOf(item).filter((group) => choices[group.id] !== void 0).map((group) => ({
		label: group.label,
		value: choiceValueText(group, choices[group.id])
	}));
}
/**
* Preço de uma unidade do item com as escolhas feitas: o da opção escolhida, quando a opção tem
* preço próprio; senão o do item. Sem escolha ainda, o do item (o menor).
*/
function extraPriceCents(item, choices = {}) {
	for (const group of choiceGroupsOf(item)) {
		const price = group.prices?.[choices[group.id]];
		if (price !== void 0) return price;
	}
	return item.priceCents;
}
// src/features/catalog/notices.ts
/** Acompanha a escolha de sabores do milk-shake. */
var FLAVOR_AVAILABILITY_NOTICE = "Favor verificar com a nossa atendente a disponibilidade de sabores.";
// src/features/catalog/menu.ts
var DEFAULT_FLAVOR_TERM = {
	label: "Sabor",
	missing: "o sabor"
};
/** Sabores tirados de um grupo de complementos: os sem custo e que não são só de um produto. */
function flavorsFromToppings(toppings, group) {
	return toppings.filter((topping) => topping.group === group && topping.priceCents === 0 && !topping.onlyIn).map((topping) => ({
		id: topping.id,
		name: topping.name,
		...topping.available === false ? { available: false } : {}
	}));
}
var TOPPING_GROUPS = {
	dry: {
		id: "dry",
		name: "Adicionais",
		rule: "limited"
	},
	fruit: {
		id: "fruit",
		name: "Frutas",
		rule: "included"
	},
	syrup: {
		id: "syrup",
		name: "Caldas e cremes",
		rule: "included"
	},
	paid: {
		id: "paid",
		name: "Adicionais pagos",
		rule: "paid"
	},
	batido: {
		id: "batido",
		name: "Adicionais",
		rule: "paid"
	}
};
var free = (group, id, name, extra = {}) => ({
	id,
	name,
	group,
	priceCents: 0,
	...extra
});
var paid = (id, name, priceCents, group = "paid", look) => ({
	id,
	name,
	group,
	priceCents,
	...look ? { look } : {}
});
/** Todos os ingredientes, na ordem do cardápio. */
/** Os ingredientes como estão no código (a base das mudanças do vendedor). */
var BASE_TOPPINGS = [
	free("dry", "leite-em-po", "Leite em pó"),
	free("dry", "granola", "Granola"),
	free("dry", "pacoca", "Paçoca"),
	free("dry", "chocoball", "Chocoball"),
	free("dry", "amendoim", "Amendoim"),
	free("dry", "gotas-de-chocolate", "Gotas de chocolate"),
	free("dry", "canudinho", "Canudinho"),
	free("dry", "bis", "BIS"),
	free("dry", "farinha-lactea", "Farinha láctea"),
	free("dry", "sucrilhos", "Sucrilhos"),
	free("dry", "marshmallow", "Marshmallow"),
	free("dry", "leite-condensado", "Leite condensado"),
	free("dry", "disquete", "Disquete (confete)"),
	free("fruit", "kiwi", "Kiwi"),
	free("fruit", "morango", "Morango"),
	free("fruit", "banana", "Banana"),
	paid("creme-de-ninho", "Creme de ninho", 300, "syrup"),
	paid("creme-de-avela", "Creme de avelã", 300, "syrup"),
	free("syrup", "calda-frutas-vermelhas", "Frutas vermelhas"),
	free("syrup", "calda-doce-de-leite", "Doce de leite"),
	free("syrup", "calda-acai", "Açaí"),
	free("syrup", "calda-banana-caramelizada", "Banana caramelada"),
	free("syrup", "calda-chocolate", "Chocolate"),
	free("syrup", "calda-morango", "Morango"),
	free("syrup", "calda-leite-condensado", "Leite condensado", {
		look: "leite-condensado",
		onlyIn: ["milk-shake"]
	}),
	paid("cereja", "Cereja", 300),
	paid("kit-kat", "Kit Kat", 400),
	paid("batido-creme-de-avela", "Creme de avelã", 300, "batido", "creme-de-avela"),
	paid("batido-creme-de-morango", "Creme de morango", 300, "batido", "creme-de-morango"),
	paid("batido-creme-de-cookies", "Creme de cookies", 300, "batido", "creme-de-cookies"),
	paid("batido-creme-de-ninho", "Creme de ninho", 300, "batido", "creme-de-ninho"),
	paid("batido-ovomaltine", "Ovomaltine", 300, "batido", "ovomaltine")
];
/** Os ingredientes como aparecem agora (base com as mudanças do vendedor). Ligação viva. */
var TOPPINGS = BASE_TOPPINGS;
var size = (id, name, container, priceCents, freeToppings) => ({
	id,
	name,
	container,
	priceCents,
	freeToppings
});
var ACAI_GROUPS = [
	"dry",
	"fruit",
	"syrup",
	"paid"
];
/** Os produtos como estão no código (a base das mudanças do vendedor). */
var BASE_PRODUCTS = {
	"acai-oca": {
		slug: "acai-oca",
		completo: true,
		name: "Açaí Oca",
		groups: ACAI_GROUPS,
		flavors: [],
		sizes: [
			size("pote-200", "Pote 200 ml", "pote", 1e3, 2),
			size("pote-530", "Pote 530 ml", "pote", 2e3, 4),
			size("copo-400", "Copo 400 ml", "copo", 1700, 3),
			size("copo-500", "Copo 500 ml", "copo", 2e3, 3),
			size("isopor-p", "Isopor P", "isopor", 1600, 4),
			size("isopor-m", "Isopor M", "isopor", 2200, 5),
			size("isopor-g", "Isopor G", "isopor", 3e3, 6),
			size("isopor-gg", "Isopor GG", "isopor", 3800, 7)
		]
	},
	"acai-tradicional": {
		slug: "acai-tradicional",
		completo: true,
		name: "Açaí Tradicional",
		groups: ACAI_GROUPS,
		flavors: [],
		sizes: [
			size("pote-150", "Pote 150 ml", "pote", 600, 2),
			size("pote-200", "Pote 200 ml", "pote", 700, 2),
			size("pote-250", "Pote 250 ml", "pote", 800, 2),
			size("pote-530", "Pote 530 ml", "pote", 1300, 4),
			size("copo-400", "Copo 400 ml", "copo", 1e3, 3),
			size("copo-500", "Copo 500 ml", "copo", 1200, 3),
			size("isopor-p", "Isopor P", "isopor", 1100, 4),
			size("isopor-m", "Isopor M", "isopor", 1500, 5),
			size("isopor-g", "Isopor G", "isopor", 1800, 6),
			size("isopor-gg", "Isopor GG", "isopor", 2200, 7)
		]
	},
	"acai-batido": {
		slug: "acai-batido",
		name: "Açaí Batido",
		groups: ["batido"],
		sizes: [size("300-ml", "300 ml", "copo", 1e3, 0), size("500-ml", "500 ml", "copo", 1200, 0)],
		flavors: [
			{
				id: "leite-condensado",
				name: "Açaí Batido com Leite Condensado"
			},
			{
				id: "leite-condensado-amendoim",
				name: "Açaí com Leite Condensado e Amendoim"
			},
			{
				id: "leite-condensado-pacoca",
				name: "Açaí com Leite Condensado e Paçoca"
			}
		]
	},
	"milk-shake": {
		slug: "milk-shake",
		name: "Milk-shake",
		flavorNotice: FLAVOR_AVAILABILITY_NOTICE,
		groups: ["syrup", "paid"],
		sizes: [size("400-ml", "400 ml", "copo", 1e3, 0), size("500-ml", "500 ml", "copo", 1200, 0)],
		flavors: [
			{
				id: "acai",
				name: "Açaí"
			},
			{
				id: "toffe",
				name: "Toffe"
			},
			{
				id: "ninho",
				name: "Ninho"
			},
			{
				id: "pitaya",
				name: "Pitaya"
			},
			{
				id: "maracuja",
				name: "Maracujá"
			},
			{
				id: "morango",
				name: "Morango"
			},
			{
				id: "prestigio",
				name: "Prestígio"
			},
			{
				id: "chocolate",
				name: "Chocolate"
			},
			{
				id: "choconute",
				name: "Choconute"
			},
			{
				id: "laka-bis",
				name: "Laka Bis"
			},
			{
				id: "iogurte-grego",
				name: "Iogurte Grego"
			},
			{
				id: "ninho-trufado",
				name: "Ninho Trufado"
			},
			{
				id: "chocolate-branco",
				name: "Chocolate Branco"
			}
		]
	},
	"pote-de-acai-1-litro": {
		slug: "pote-de-acai-1-litro",
		completo: true,
		name: "Pote de Açaí 1 Litro Montado",
		groups: ACAI_GROUPS,
		flavors: [],
		sizes: [size("pote-1-litro", "Pote 1 litro", "pote", 3e3, 7)]
	},
	"barca-de-acai": {
		slug: "barca-de-acai",
		completo: true,
		name: "Barca de Açaí",
		groups: [
			"dry",
			"fruit",
			"paid"
		],
		groupLimits: { fruit: 2 },
		flavorTerm: {
			label: "Cobertura",
			missing: "a cobertura"
		},
		flavorHint: "1 inclusa no preço",
		flavorsFrom: "syrup",
		flavors: flavorsFromToppings(TOPPINGS, "syrup"),
		sizes: [size("barca", "Barca", "barca", 3e3, 7)]
	}
};
/** Os produtos como aparecem agora (base com as mudanças do vendedor). Ligação viva. */
var PRODUCTS = BASE_PRODUCTS;
var toppingsById = new Map(TOPPINGS.map((topping) => [topping.id, topping]));
/** Troca os ingredientes (só `catalogStore.ts` chama). */
function setToppings(toppings) {
	TOPPINGS = toppings;
	toppingsById = new Map(toppings.map((topping) => [topping.id, topping]));
}
/** Troca os produtos (só `catalogStore.ts` chama). */
function setProducts(products) {
	PRODUCTS = products;
}
function getTopping(id) {
	return toppingsById.get(id);
}
/** O produto oferece este ingrediente? Aceita o grupo dele e não está fora da lista do item. */
function offers(product, topping) {
	return product.groups.includes(topping.group) && (!topping.onlyIn || topping.onlyIn.includes(product.slug));
}
/** Ingredientes de um grupo que o produto aceita, na ordem do cardápio. */
function toppingsOf(product, group) {
	if (!product.groups.includes(group)) return [];
	return TOPPINGS.filter((topping) => topping.group === group && offers(product, topping));
}
/** Nome da escolha obrigatória do produto: "Sabor", ou "Cobertura" na barca. */
function flavorTermOf(product) {
	return product.flavorTerm ?? DEFAULT_FLAVOR_TERM;
}
function isProductSlug(slug) {
	return Object.hasOwn(PRODUCTS, slug);
}
// src/features/catalog/availability.ts
/**
* Disponibilidade dos produtos do personalizador (esgotado em 1 toque, pedido de 2026-11-17).
* Os 4 produtos principais têm o próprio "disponível/esgotado"; o Pote 1 L Montado e a Barca
* seguem o item da seção que abre o personalizador deles.
*/
function isProductAvailable(slug) {
	if (PRODUCTS[slug]?.available === false) return false;
	return !EXTRA_ITEMS.some((item) => item.action.type === "customizer" && item.action.product === slug && item.available === false);
}
// src/features/catalog/selection.ts
/**
* Regras de montagem e de preço de um produto.
*
* Funções puras: recebem o produto e a seleção atual e devolvem uma seleção nova,
* sem alterar a que receberam. A interface só mostra o que estas funções decidem.
* Na Fase 6 as mesmas regras são repetidas no servidor, que é quem vale.
*/
var EMPTY_SELECTION = Object.freeze({
	sizeId: null,
	flavorId: null,
	toppings: Object.freeze({})
});
var ruleOf = (topping) => TOPPING_GROUPS[topping.group].rule;
function selectedSize(product, selection) {
	return product.sizes.find((size) => size.id === selection.sizeId);
}
function quantityOf(selection, toppingId) {
	return selection.toppings[toppingId] ?? 0;
}
/** Menor e maior limite gratuito entre os tamanhos do produto. */
function freeLimitRange(product) {
	const limits = product.sizes.map((size) => size.freeToppings);
	return {
		min: Math.min(...limits),
		max: Math.max(...limits)
	};
}
/**
* Até onde os adicionais gratuitos podem ir agora. Com o tamanho escolhido, é o limite dele.
* Sem tamanho, o cliente pode montar livremente até o maior limite do produto; ao escolher o
* tamanho, o que passar do limite dele sai, com aviso (`chooseSize`).
*/
function freeCap(product, selection) {
	return selectedSize(product, selection)?.freeToppings ?? freeLimitRange(product).max;
}
/** Quantas unidades de adicionais gratuitos já foram escolhidas. */
function freeUsed(selection) {
	let used = 0;
	for (const [id, quantity] of Object.entries(selection.toppings)) {
		const topping = getTopping(id);
		if (topping && ruleOf(topping) === "limited") used += quantity;
	}
	return used;
}
function addBlocker(product, selection, toppingId, options = {}) {
	const topping = getTopping(toppingId);
	if (!topping || !offers(product, topping)) return "not-in-product";
	if (topping.available === false && !options.ignoreStock) return "unavailable";
	const quantity = quantityOf(selection, toppingId);
	if (selection.complete && inComplete(product, topping)) return quantity >= 1 ? "item-max" : null;
	switch (ruleOf(topping)) {
		case "limited":
			if (quantity >= 10) return "item-max";
			return freeUsed(selection) >= freeCap(product, selection) ? "free-limit" : null;
		case "included": {
			if (quantity >= 1) return "item-max";
			const limit = product.groupLimits?.[topping.group];
			return limit !== void 0 && selectedByGroup(product, selection, topping.group).length >= limit ? "group-limit" : null;
		}
		case "paid": return quantity >= 10 ? "item-max" : null;
	}
}
/** Soma uma unidade do ingrediente. Devolve a mesma seleção quando não pode. */
function addTopping(product, selection, toppingId, options = {}) {
	if (addBlocker(product, selection, toppingId, options)) return selection;
	return {
		...selection,
		toppings: {
			...selection.toppings,
			[toppingId]: quantityOf(selection, toppingId) + 1
		}
	};
}
/**
* Escolhe o tamanho. Se o novo tamanho inclui menos adicionais gratuitos do que
* os já escolhidos, tira os que passam do limite, começando pelos últimos
* escolhidos, e informa quais saíram.
*/
function chooseSize(product, selection, sizeId) {
	const size = product.sizes.find((candidate) => candidate.id === sizeId);
	if (!size) return {
		selection,
		removed: []
	};
	if (selection.complete) return {
		selection: {
			...selection,
			sizeId
		},
		removed: []
	};
	const toppings = { ...selection.toppings };
	const removed = [];
	let excess = freeUsed(selection) - size.freeToppings;
	for (const id of Object.keys(toppings).reverse()) {
		if (excess <= 0) break;
		const topping = getTopping(id);
		if (!topping || ruleOf(topping) !== "limited") continue;
		const quantity = Math.min(toppings[id], excess);
		excess -= quantity;
		removed.push({
			toppingId: id,
			quantity
		});
		if (toppings[id] === quantity) delete toppings[id];
		else toppings[id] -= quantity;
	}
	return {
		selection: {
			...selection,
			sizeId,
			toppings
		},
		removed
	};
}
/** Escolhe o sabor. Devolve a mesma seleção quando o produto não tem esse sabor. */
function chooseFlavor(product, selection, flavorId, options = {}) {
	const flavor = product.flavors.find((candidate) => candidate.id === flavorId);
	if (!flavor || flavor.available === false && !options.ignoreStock) return selection;
	return {
		...selection,
		flavorId
	};
}
/** Ingredientes escolhidos de um grupo que têm preço. */
function pricedByGroup(product, selection, group) {
	return selectedByGroup(product, selection, group).filter(({ topping }) => topping.priceCents > 0);
}
/** Ingredientes escolhidos de um grupo, na ordem do cardápio. */
function selectedByGroup(product, selection, group) {
	return toppingsOf(product, group).map((topping) => ({
		topping,
		quantity: quantityOf(selection, topping.id)
	})).filter(({ quantity }) => quantity > 0);
}
/** Preço do produto montado. Não existe antes de o tamanho ser escolhido. */
function priceOf(product, selection) {
	const size = selectedSize(product, selection);
	if (!size) return null;
	const paidLines = product.groups.flatMap((group) => pricedByGroup(product, selection, group).map(({ topping, quantity }) => ({
		toppingId: topping.id,
		name: topping.name,
		quantity,
		unitCents: topping.priceCents,
		totalCents: topping.priceCents * quantity
	})));
	const paidCents = paidLines.reduce((sum, line) => sum + line.totalCents, 0);
	return {
		sizeCents: size.priceCents,
		paidLines,
		paidCents,
		totalCents: size.priceCents + paidCents
	};
}
/** Escolhas obrigatórias que ainda faltam para o produto ficar completo. */
function missingChoices(product, selection, options = {}) {
	const missing = [];
	if (!selectedSize(product, selection)) missing.push("size");
	const flavor = product.flavors.find((candidate) => candidate.id === selection.flavorId);
	if (product.flavors.length > 0 && (!flavor || flavor.available === false && !options.ignoreStock)) missing.push("flavor");
	return missing;
}
/** Grupos do Completo: adicionais e frutas. Caldas, cremes e itens pagos ficam de fora. */
var COMPLETE_GROUPS = ["dry", "fruit"];
/** O ajuste de 2026-11-16 cita o leite condensado entre as caldas: o Completo não o marca. */
var OUTSIDE_COMPLETE = /* @__PURE__ */ new Set(["leite-condensado"]);
/** No Completo, os itens destes grupos vão 1 de cada e sem cota (marcados por ele ou à parte). */
var inComplete = (product, topping) => Boolean(product.completo) && COMPLETE_GROUPS.includes(topping.group);
/**
* O que o Completo marca no produto, na ordem do cardápio: os adicionais e as frutas sem custo,
* menos os esgotados e o leite condensado.
*/
function completeToppings(product) {
	if (!product.completo) return [];
	return COMPLETE_GROUPS.flatMap((group) => toppingsOf(product, group)).filter((topping) => topping.available !== false && topping.priceCents === 0 && !OUTSIDE_COMPLETE.has(topping.id));
}
/** Desliga o modo Completo quando o cliente tirou tudo o que ele marcou. */
function settleComplete(product, selection) {
	if (!selection.complete) return selection;
	return completeToppings(product).some((topping) => quantityOf(selection, topping.id) > 0) ? selection : {
		...selection,
		complete: false
	};
}
/** O que o cliente tirou do Completo ("COMPLETO (SEM: Farinha láctea)"), na ordem do cardápio. */
function completeOmitted(product, selection) {
	if (!selection.complete) return [];
	return completeToppings(product).filter((topping) => quantityOf(selection, topping.id) === 0);
}
/**
* Linha da montagem no resumo, na confirmação, no carrinho e no WhatsApp: "COMPLETO" ou
* "COMPLETO (SEM: Farinha láctea, Granola)". Fora do Completo, `null`.
*/
function completeLabel(product, selection) {
	if (!selection.complete) return null;
	const omitted = completeOmitted(product, selection).map((topping) => topping.name);
	return omitted.length === 0 ? "COMPLETO" : `COMPLETO (SEM: ${omitted.join(", ")})`;
}
// src/utils/money.ts
var brlFormatter = new Intl.NumberFormat("pt-BR", {
	style: "currency",
	currency: "BRL"
});
/** Espaço não separável (código 160), que o Intl põe entre "R$" e o valor. */
var NON_BREAKING_SPACE = String.fromCharCode(160);
/**
* Formata um valor em centavos como reais. Ex.: 600 -> "R$ 6,00".
*
* Os preços circulam pelo sistema em centavos inteiros, para que as somas
* não sofram erros de arredondamento.
*/
function formatBRL(cents) {
	if (!Number.isInteger(cents)) throw new RangeError(`Valor em centavos inválido: ${cents}`);
	return brlFormatter.format(cents / 100).replaceAll(NON_BREAKING_SPACE, " ");
}
/** Observação sem espaços sobrando, com até 140 caracteres; `undefined` quando fica vazia. */
function cleanNote(text) {
	if (typeof text !== "string") return void 0;
	return text.replace(/\s+/g, " ").trim().slice(0, 140).trim() || void 0;
}
var EMPTY_CART = Object.freeze({ items: Object.freeze([]) });
function freezeSelection(selection) {
	return Object.freeze({
		sizeId: selection.sizeId,
		flavorId: selection.flavorId,
		toppings: Object.freeze({ ...selection.toppings }),
		...selection.complete ? { complete: true } : {}
	});
}
/**
* Refaz a montagem passo a passo pelas regras do cardápio: tamanho, sabor e cada unidade de
* ingrediente, na ordem em que foram escolhidos. O que as regras recusam fica de fora.
* Devolve `null` se o produto não existe ou se falta tamanho ou sabor.
*/
function normalizeSelection(slug, selection) {
	if (!isProductSlug(slug)) return null;
	const product = PRODUCTS[slug];
	const start = selection.complete === true && product.completo ? {
		...EMPTY_SELECTION,
		complete: true
	} : EMPTY_SELECTION;
	let rebuilt = selection.sizeId ? chooseSize(product, start, selection.sizeId).selection : start;
	if (selection.flavorId) rebuilt = chooseFlavor(product, rebuilt, selection.flavorId, { ignoreStock: true });
	for (const [toppingId, quantity] of Object.entries(selection.toppings)) {
		const units = Number.isInteger(quantity) ? Math.min(quantity, 100) : 0;
		for (let unit = 0; unit < units; unit++) rebuilt = addTopping(product, rebuilt, toppingId, { ignoreStock: true });
	}
	rebuilt = settleComplete(product, rebuilt);
	if (missingChoices(product, rebuilt, { ignoreStock: true }).length > 0) return null;
	return freezeSelection(rebuilt);
}
var clampQuantity = (quantity) => Number.isInteger(quantity) ? Math.min(20, Math.max(1, quantity)) : 1;
/**
* O que impede o envio de um item que já está no carrinho (pedido de 2026-11-17): o item ou o
* produto esgotou (ou saiu do cardápio), ou algum complemento escolhido esgotou.
*/
function cartItemProblem(item) {
	if (item.kind === "extra") {
		const extra = getExtraItem(item.itemId);
		if (!extra || extra.available === false) return { kind: "item" };
		const names = [];
		for (const group of choiceGroupsOf(extra)) {
			const value = item.choices[group.id];
			if (value === void 0 || !group.options.includes(value) && !group.allowOther) return { kind: "item" };
			if (group.unavailable?.includes(value)) names.push(value);
		}
		return names.length > 0 ? {
			kind: "toppings",
			names
		} : null;
	}
	if (!isProductAvailable(item.slug)) return { kind: "item" };
	const product = PRODUCTS[item.slug];
	const names = [];
	if (product.flavors.length > 0) {
		const flavor = product.flavors.find((candidate) => candidate.id === item.selection.flavorId);
		if (!flavor) return { kind: "item" };
		if (flavor.available === false) names.push(flavor.name);
	}
	for (const id of Object.keys(item.selection.toppings)) {
		const topping = getTopping(id);
		if (topping?.available === false) names.push(topping.name);
	}
	return names.length > 0 ? {
		kind: "toppings",
		names
	} : null;
}
var productOf = (item) => PRODUCTS[item.slug];
/** Preço de uma unidade do item: pelas regras do personalizador ou pela tabela das gavetas. */
function unitPriceCents(item) {
	if (item.kind === "extra") {
		const extra = getExtraItem(item.itemId);
		return extra ? extraPriceCents(extra, item.choices) : 0;
	}
	return priceOf(productOf(item), item.selection)?.totalCents ?? 0;
}
function lineTotalCents(item) {
	return unitPriceCents(item) * item.quantity;
}
function cartTotalCents(cart) {
	return cart.items.reduce((sum, item) => sum + lineTotalCents(item), 0);
}
var CONTAINER_NAMES = {
	pote: "Pote",
	copo: "Copo",
	isopor: "Isopor",
	barca: "Barca"
};
/** Nome e escolhas ("Sabor: Nutella") de um item das gavetas, para o carrinho e a mensagem. */
function describeExtra(item) {
	const extra = getExtraItem(item.itemId);
	if (!extra) return {
		name: item.itemId,
		rows: []
	};
	return {
		name: extra.name,
		rows: choiceRows(extra, item.choices)
	};
}
/**
* Tudo o que foi escolhido para um produto, grupo a grupo, para a janela de confirmação e a
* mensagem do pedido. Diferente de `describeItem`, cada grupo traz juntos os itens que custam e
* os que não custam: os cremes de ninho e avelã aparecem em "Caldas e cremes", com o preço.
*/
function summarizeSelection(slug, selection) {
	const product = PRODUCTS[slug];
	const size = selectedSize(product, selection);
	const container = size ? CONTAINER_NAMES[size.container] : "";
	const sizeName = product.sizes.length === 1 ? "" : size?.name ?? "";
	return {
		productName: product.name,
		sizeLabel: !sizeName || sizeName.startsWith(container) ? sizeName : `${container} ${sizeName}`,
		flavorLabel: flavorTermOf(product).label,
		flavorName: product.flavors.find((candidate) => candidate.id === selection.flavorId)?.name ?? null,
		sections: product.groups.map((group) => ({
			group,
			label: TOPPING_GROUPS[group].name,
			items: selectedByGroup(product, selection, group).map(({ topping, quantity }) => ({
				name: topping.name,
				quantity,
				totalCents: topping.priceCents * quantity
			}))
		})).filter((section) => section.items.length > 0),
		unitCents: priceOf(product, selection)?.totalCents ?? 0,
		montagem: completeLabel(product, selection)
	};
}
var STORAGE_VERSION = 2;
function serializeCart(cart) {
	const items = cart.items.map((item) => item.kind === "extra" ? {
		kind: "extra",
		id: item.id,
		itemId: item.itemId,
		choices: Object.entries(item.choices),
		quantity: item.quantity,
		...item.note ? { note: item.note } : {}
	} : {
		kind: "product",
		id: item.id,
		slug: item.slug,
		sizeId: item.selection.sizeId,
		flavorId: item.selection.flavorId,
		toppings: Object.entries(item.selection.toppings),
		...item.selection.complete ? { complete: true } : {},
		quantity: item.quantity,
		...item.note ? { note: item.note } : {}
	});
	return JSON.stringify({
		v: STORAGE_VERSION,
		items
	});
}
var isString = (value) => typeof value === "string";
function restoreProduct(entry) {
	if (!isString(entry.id) || !isString(entry.slug) || !isProductSlug(entry.slug)) return null;
	const toppings = {};
	for (const pair of Array.isArray(entry.toppings) ? entry.toppings : []) if (Array.isArray(pair) && isString(pair[0]) && typeof pair[1] === "number") toppings[pair[0]] = pair[1];
	const selection = normalizeSelection(entry.slug, {
		sizeId: isString(entry.sizeId) ? entry.sizeId : null,
		flavorId: isString(entry.flavorId) ? entry.flavorId : null,
		toppings,
		...entry.complete === true ? { complete: true } : {}
	});
	if (!selection) return null;
	const note = cleanNote(entry.note);
	return Object.freeze({
		id: entry.id,
		kind: "product",
		slug: entry.slug,
		selection,
		quantity: clampQuantity(Number(entry.quantity)),
		...note ? { note } : {}
	});
}
function restoreExtra(entry) {
	if (!isString(entry.id) || !isString(entry.itemId)) return null;
	const extra = getExtraItem(entry.itemId);
	if (!extra || extra.action.type === "customizer") return null;
	const raw = {};
	for (const pair of Array.isArray(entry.choices) ? entry.choices : []) if (Array.isArray(pair) && isString(pair[0]) && isString(pair[1])) raw[pair[0]] = pair[1];
	const choices = normalizeChoices(extra, raw, { ignoreStock: true });
	if (!choices) return null;
	const note = cleanNote(entry.note);
	return Object.freeze({
		id: entry.id,
		kind: "extra",
		itemId: entry.itemId,
		choices,
		quantity: clampQuantity(Number(entry.quantity)),
		...note ? { note } : {}
	});
}
/**
* Lê o carrinho guardado. Tudo é conferido de novo pelas regras do cardápio: item de produto
* que não existe mais, tamanho retirado, sabor que saiu ou dado corrompido simplesmente não volta.
*/
function parseCart(raw) {
	if (!raw) return EMPTY_CART;
	let data;
	try {
		data = JSON.parse(raw);
	} catch {
		return EMPTY_CART;
	}
	if (typeof data !== "object" || data === null) return EMPTY_CART;
	const { v, items } = data;
	if (v !== 1 && v !== STORAGE_VERSION || !Array.isArray(items)) return EMPTY_CART;
	const seen = /* @__PURE__ */ new Set();
	const restored = [];
	for (const entry of items) {
		if (!entry || typeof entry !== "object" || !isString(entry.id) || seen.has(entry.id)) continue;
		const item = entry.kind === "extra" ? restoreExtra(entry) : restoreProduct(entry);
		if (!item) continue;
		seen.add(item.id);
		restored.push(item);
	}
	return { items: restored };
}
/** As categorias como estão no código (a base das mudanças do vendedor). */
var BASE_CATEGORIES = [
	{
		slug: "acai-oca",
		name: "Açaí Oca",
		summary: "Em pote, copo ou isopor, a partir de 200 ml.",
		tagline: "A especialidade da casa, montada com os adicionais, as frutas e as coberturas que você quiser.",
		actionLabel: "Montar açaí Oca",
		badges: ["Especialidade da casa", "O mais pedido"],
		keywords: ["oca", "especialidade"]
	},
	{
		slug: "acai-tradicional",
		name: "Açaí Tradicional",
		summary: "Em pote, copo ou isopor, a partir de 150 ml.",
		tagline: "Do seu jeito: adicionais grátis conforme o tamanho, mais frutas e coberturas à vontade.",
		actionLabel: "Montar açaí Tradicional",
		badges: [],
		keywords: ["tradicional"]
	},
	{
		slug: "acai-batido",
		name: "Açaí Batido",
		summary: "De 300 ml ou 500 ml, em 3 sabores.",
		tagline: "Açaí batido com leite condensado, puro, com amendoim ou com paçoca.",
		actionLabel: "Montar açaí Batido",
		badges: [],
		keywords: ["batida", "batido"]
	},
	{
		slug: "milk-shake",
		name: "Milk-shake",
		summary: "De 400 ml ou 500 ml, em 13 sabores.",
		tagline: "Cremoso e gelado, em 13 sabores, com coberturas se quiser.",
		actionLabel: "Montar milk-shake",
		badges: [],
		keywords: [
			"milkshake",
			"milk shake",
			"shake"
		]
	}
];
/** As categorias como aparecem agora (base com as mudanças do vendedor). Ligação viva. */
var CATEGORIES = BASE_CATEGORIES;
/** Troca as categorias (só `catalogStore.ts` chama). */
function setCategories(categories) {
	CATEGORIES = categories;
}
// src/services/storeInfo.ts
/**
* Dados públicos da loja, informados pelo proprietário.
* Instagram corrigido para @acaiidocesabor (com dois "i") no briefing de 2026-11-12.
*
* Por enquanto ficam fixos aqui. Quando o banco de dados entrar (Fase 6),
* passam a ser lidos das tabelas `stores` e `store_settings`.
*/
var storeInfo = {
	name: "Açaí Doce Sabor",
	whatsapp: "(83) 99699-9980",
	instagramHandle: "acaiidocesabor",
	instagramUrl: "https://www.instagram.com/acaiidocesabor/",
	address: {
		street: "Rua Francisco Tota, 12",
		city: "Teixeira",
		state: "Paraíba"
	},
	/**
	* Chave Pix mostrada no carrinho. Para trocar, edite só aqui.
	* Dados do pedido de 2026-11-14 (vieram como exemplo): o proprietário precisa confirmar a
	* chave e o nome do titular que o banco mostra ao cliente.
	*/
	pix: {
		key: "83996999980",
		type: "Celular",
		holder: "Açaí Doce Sabor"
	}
};
// src/utils/whatsapp.ts
var BRAZIL_COUNTRY_CODE = "55";
/**
* Converte um telefone brasileiro para o formato dos links do WhatsApp:
* só dígitos, com o código do país. Ex.: "(83) 99699-9980" -> "5583996999980".
*/
function toWhatsAppNumber(phone) {
	const digits = phone.replace(/\D/g, "");
	const national = digits.startsWith(BRAZIL_COUNTRY_CODE) && digits.length > 11 ? digits.slice(2) : digits;
	if (national.length !== 10 && national.length !== 11) throw new RangeError(`Telefone inválido, esperado DDD + número: "${phone}"`);
	return BRAZIL_COUNTRY_CODE + national;
}
/**
* Telefone brasileiro escrito como as pessoas leem: "(83) 99699-9980" (celular) ou
* "(83) 3333-1234" (fixo). Aceita com ou sem o código do país. `null` se não for um telefone.
*/
function formatBrazilPhone(phone) {
	const digits = phone.replace(/\D/g, "");
	const national = digits.startsWith(BRAZIL_COUNTRY_CODE) && digits.length > 11 ? digits.slice(2) : digits;
	if (national.length === 11) return `(${national.slice(0, 2)}) ${national.slice(2, 7)}-${national.slice(7)}`;
	if (national.length === 10) return `(${national.slice(0, 2)}) ${national.slice(2, 6)}-${national.slice(6)}`;
	return null;
}
var MINUTES_PER_DAY = 1440;
/** Frete máximo aceito por bairro (R$ 1.000,00): só barra valor digitado errado. */
var MAX_FEE_CENTS = 1e5;
var DEFAULT_STORE_SETTINGS = {
	hours: {
		opensAt: 780,
		closesAt: 1260
	},
	override: null,
	deliveryTime: "30–45 min",
	closedOrders: "antecipado",
	delivery: {
		mode: "combinar",
		zones: []
	},
	contact: {
		whatsapp: storeInfo.whatsapp,
		street: storeInfo.address.street,
		city: storeInfo.address.city,
		uf: "PB"
	}
};
var isRecord$2 = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
/** Texto sem espaços sobrando, com até `max` caracteres; vazio ou longo demais não vale. */
function cleanText(value, max) {
	if (typeof value !== "string") return void 0;
	const text = value.trim().replace(/\s+/g, " ");
	return text && text.length <= max ? text : void 0;
}
function parseHours(raw) {
	if (!isRecord$2(raw)) return void 0;
	const { opensAt, closesAt } = raw;
	if (!Number.isInteger(opensAt) || !Number.isInteger(closesAt)) return void 0;
	const open = opensAt;
	const close = closesAt;
	return open >= 300 && open < close && close <= 1440 ? {
		opensAt: open,
		closesAt: close
	} : void 0;
}
function parseOverride(raw) {
	if (raw === null) return null;
	if (!isRecord$2(raw) || raw.state !== "open" && raw.state !== "closed") return void 0;
	const until = raw.until;
	return typeof until === "number" && Number.isFinite(until) && until > 0 ? {
		state: raw.state,
		until
	} : void 0;
}
function parseZones(raw) {
	if (!Array.isArray(raw)) return [];
	const seen = /* @__PURE__ */ new Set();
	const zones = [];
	for (const entry of raw) {
		if (!isRecord$2(entry)) continue;
		const id = cleanText(entry.id, 40);
		const name = cleanText(entry.name, 40);
		const fee = entry.feeCents;
		if (!id || !name || seen.has(id) || !Number.isInteger(fee) || fee < 0 || fee > MAX_FEE_CENTS) continue;
		seen.add(id);
		zones.push({
			id,
			name,
			feeCents: fee
		});
		if (zones.length === 30) break;
	}
	return zones;
}
function parseDelivery(raw) {
	if (!isRecord$2(raw) || raw.mode !== "gratis" && raw.mode !== "taxas" && raw.mode !== "combinar") return void 0;
	return {
		mode: raw.mode,
		zones: parseZones(raw.zones)
	};
}
function parseContact(raw) {
	if (!isRecord$2(raw)) return void 0;
	const contact = {};
	const whatsapp = typeof raw.whatsapp === "string" ? formatBrazilPhone(raw.whatsapp) : null;
	if (whatsapp) contact.whatsapp = whatsapp;
	const street = cleanText(raw.street, 80);
	if (street) contact.street = street;
	const city = cleanText(raw.city, 60);
	if (city) contact.city = city;
	if (typeof raw.uf === "string" && /^[A-Za-z]{2}$/.test(raw.uf.trim())) contact.uf = raw.uf.trim().toUpperCase();
	return Object.keys(contact).length > 0 ? contact : void 0;
}
/** A mudança guardada (aparelho ou Supabase), só com os campos válidos. */
function parseStoreSettingsChange(raw) {
	if (!isRecord$2(raw)) return {};
	const change = {};
	const hours = parseHours(raw.hours);
	if (hours) change.hours = hours;
	const override = parseOverride(raw.override);
	if (override !== void 0) change.override = override;
	const deliveryTime = cleanText(raw.deliveryTime, 30);
	if (deliveryTime) change.deliveryTime = deliveryTime;
	if (raw.closedOrders === "antecipado" || raw.closedOrders === "bloquear") change.closedOrders = raw.closedOrders;
	const delivery = parseDelivery(raw.delivery);
	if (delivery) change.delivery = delivery;
	const contact = parseContact(raw.contact);
	if (contact) change.contact = contact;
	return change;
}
/** As configurações em uso: o que o vendedor mudou por cima do padrão. */
function resolveStoreSettings(change) {
	if (!change) return DEFAULT_STORE_SETTINGS;
	return {
		...DEFAULT_STORE_SETTINGS,
		...change,
		override: change.override ?? null,
		contact: {
			...DEFAULT_STORE_SETTINGS.contact,
			...change.contact
		}
	};
}
/** "Rua Francisco Tota, 12 — Teixeira, PB": o local na retirada e no consumo no local (2026-11-20). */
function storePlaceText(contact) {
	return `${contact.street} — ${contact.city}, ${contact.uf}`;
}
// src/features/catalog/catalogChanges.ts
/**
* Mudanças do vendedor sobre o cardápio (modo vendedor, pedido de 2026-11-16).
*
* O cardápio do código é a base. As mudanças são uma camada por cima, uma por id: item das
* seções, produto principal (com os preços dos tamanhos) e complemento. Item novo tem um id
* gerado e `created`; "Excluir" é `deleted`; "Restaurar original" apaga a mudança. Funções puras:
* recebem a base e as mudanças e devolvem o cardápio novo, sem alterar a base.
*/
var NO_CHANGES = Object.freeze({
	items: {},
	products: {},
	toppings: {},
	sections: {},
	settings: {}
});
var isEmpty = (changes) => Object.keys(changes.items).length + Object.keys(changes.products).length + Object.keys(changes.toppings).length + Object.keys(changes.sections ?? {}).length === 0;
/** Tamanhos do item: a escolha "Tamanho" com o preço de cada um vem primeiro; sem tamanhos, sai. */
function withSizes(item, sizes) {
	if (item.action.type === "customizer") return {
		action: item.action,
		priceCents: item.priceCents
	};
	const others = (item.action.type === "flavor_modal" ? item.action.choices : []).filter((group) => !group.prices);
	if (sizes.length === 0) return {
		action: others.length > 0 ? {
			type: "flavor_modal",
			choices: others
		} : { type: "direct_confirm" },
		priceCents: item.priceCents
	};
	return {
		action: {
			type: "flavor_modal",
			choices: [{
				id: "tamanho",
				label: "Tamanho",
				options: sizes.map((size) => size.name),
				prices: Object.fromEntries(sizes.map((size) => [size.name, size.priceCents]))
			}, ...others]
		},
		priceCents: Math.min(...sizes.map((size) => size.priceCents))
	};
}
var slugOf = (text) => foldText(text).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
/** Recipiente de um tamanho novo: pelo nome ("Copo 700 ml") ou o dos tamanhos que já existem. */
function containerFor(name, existing) {
	const text = foldText(name).toLowerCase();
	for (const kind of [
		"copo",
		"isopor",
		"barca",
		"pote"
	]) if (text.includes(kind)) return kind;
	return existing[0]?.container ?? "pote";
}
/** A lista de tamanhos de um dos 4 produtos: os que existiam mantêm o id e o recipiente. */
function productSizes(product, entries) {
	const used = /* @__PURE__ */ new Set();
	return entries.map((entry) => {
		const known = entry.id ? product.sizes.find((size) => size.id === entry.id) : void 0;
		let id = known?.id ?? `novo-${slugOf(entry.name) || "tamanho"}`;
		for (let suffix = 2; used.has(id); suffix++) id = `${id.replace(/-\d+$/, "")}-${suffix}`;
		used.add(id);
		return {
			id,
			name: entry.name,
			container: known?.container ?? containerFor(entry.name, product.sizes),
			priceCents: entry.priceCents,
			freeToppings: entry.freeToppings
		};
	});
}
/** Os sabores trocam o primeiro grupo de escolha sem preço; sem grupo, o item passa a pedir o sabor. */
function withFlavors(item, flavors) {
	if (item.action.type === "customizer") return item.action;
	const groups = item.action.type === "flavor_modal" ? item.action.choices : [];
	const index = groups.findIndex((group) => !group.prices);
	let next;
	if (flavors.length === 0) next = groups.filter((_, position) => position !== index);
	else if (index === -1) next = [{
		id: "sabor",
		label: "Sabor",
		options: flavors
	}, ...groups];
	else next = groups.map((group, position) => position === index ? {
		...group,
		options: flavors
	} : group);
	return next.length === 0 ? { type: "direct_confirm" } : {
		type: "flavor_modal",
		choices: next
	};
}
/**
* As escolhas sem preço de um item, pelo gerenciador de sabores (2026-11-17). A escolha de tamanho
* continua primeiro; as que já existiam mantêm o id, o "Outro sabor" e as fotos das opções.
*/
function withGroups(item, entries) {
	if (item.action.type === "customizer") return item.action;
	const current = item.action.type === "flavor_modal" ? item.action.choices : [];
	const priced = current.filter((group) => group.prices);
	const used = new Set(priced.map((group) => group.id));
	let counter = 0;
	const groups = entries.map((entry) => {
		const known = entry.id ? current.find((group) => group.id === entry.id && !group.prices) : void 0;
		let id = entry.id && !used.has(entry.id) ? entry.id : "";
		while (!id || used.has(id)) id = `escolha-${++counter}`;
		used.add(id);
		const unavailable = entry.options.filter((option) => option.available === false).map((option) => option.name);
		return {
			id,
			label: entry.label,
			options: entry.options.map((option) => option.name),
			...unavailable.length > 0 ? { unavailable } : {},
			...known?.allowOther ? { allowOther: true } : {},
			...known?.photos ? { photos: known.photos } : {},
			...known?.photoAlt ? { photoAlt: known.photoAlt } : {}
		};
	});
	const next = [...priced, ...groups];
	return next.length === 0 ? { type: "direct_confirm" } : {
		type: "flavor_modal",
		choices: next
	};
}
/** Os sabores de um produto pelo gerenciador: id guardado continua; sabor novo ganha `novo-<nome>`. */
function productFlavors(entries) {
	const used = new Set(entries.flatMap((entry) => entry.id ? [entry.id] : []));
	return entries.map((entry) => {
		let id = entry.id;
		if (!id) {
			const base = `novo-${slugOf(entry.name) || "sabor"}`;
			id = base;
			for (let suffix = 2; used.has(id); suffix++) id = `${base}-${suffix}`;
			used.add(id);
		}
		return {
			id,
			name: entry.name,
			...entry.available === false ? { available: false } : {}
		};
	});
}
function changeItem(item, change) {
	const next = { ...item };
	if (change.name !== void 0) next.name = change.name;
	if (change.description !== void 0) next.description = change.description;
	if (change.priceCents !== void 0) next.priceCents = change.priceCents;
	if (change.originalPriceCents === null) delete next.originalPriceCents;
	else if (change.originalPriceCents !== void 0) next.originalPriceCents = change.originalPriceCents;
	if (change.image !== void 0) next.image = change.image;
	if (!next.image.startsWith("images/")) next.imageAlt = next.name;
	if (change.available !== void 0) next.available = change.available;
	if (change.drawer !== void 0) next.drawer = change.drawer;
	if (change.groups !== void 0) next.action = withGroups(next, change.groups);
	else if (change.flavors !== void 0) next.action = withFlavors(next, change.flavors);
	if (change.sizes !== void 0) Object.assign(next, withSizes(next, change.sizes));
	return next;
}
function newItem(id, change) {
	const name = change.name?.trim();
	if (!name || change.priceCents === void 0 && !change.sizes?.length || !change.drawer) return null;
	return changeItem({
		id,
		drawer: change.drawer,
		name,
		description: change.description ?? "",
		priceCents: change.priceCents ?? 0,
		keywords: [],
		image: change.image ?? "",
		imageAlt: name,
		action: { type: "direct_confirm" }
	}, {
		...change,
		name,
		created: void 0,
		drawer: void 0
	});
}
function changeTopping(topping, change) {
	const next = { ...topping };
	if (change.name !== void 0) next.name = change.name;
	if (change.priceCents !== void 0) next.priceCents = change.priceCents;
	if (change.image !== void 0) next.image = change.image;
	if (change.available !== void 0) next.available = change.available;
	return next;
}
/** O cardápio com as mudanças do vendedor. Sem mudanças, devolve a própria base. */
function applyChanges(base, changes) {
	if (isEmpty(changes)) return base;
	const items = [];
	for (const item of base.items) {
		const change = changes.items[item.id];
		if (!change) items.push(item);
		else if (!change.deleted || item.action.type === "customizer") items.push(changeItem(item, change));
	}
	const known = new Set(base.items.map((item) => item.id));
	for (const [id, change] of Object.entries(changes.items)) {
		if (known.has(id) || !change.created || change.deleted) continue;
		const created = newItem(id, change);
		if (created) items.push(created);
	}
	const drawerOrder = new Map(BASE_DRAWERS.map((drawer, index) => [drawer.id, index]));
	items.sort((a, b) => (drawerOrder.get(a.drawer) ?? 0) - (drawerOrder.get(b.drawer) ?? 0));
	const products = { ...base.products };
	for (const [slug, change] of Object.entries(changes.products)) {
		const product = products[slug];
		if (!product) continue;
		products[slug] = {
			...product,
			name: change.name ?? product.name,
			...change.available !== void 0 ? { available: change.available } : {},
			...change.flavors !== void 0 && !product.flavorsFrom ? { flavors: productFlavors(change.flavors) } : {},
			sizes: change.sizes && change.sizes.length > 0 ? productSizes(product, change.sizes) : product.sizes.map((size) => {
				const price = change.sizePrices?.[size.id];
				return price === void 0 ? size : {
					...size,
					priceCents: price
				};
			})
		};
	}
	for (const item of items) {
		if (item.action.type !== "customizer" || !changes.items[item.id]) continue;
		const product = products[item.action.product];
		products[item.action.product] = {
			...product,
			name: item.name,
			sizes: product.sizes.map((size) => ({
				...size,
				priceCents: item.priceCents
			}))
		};
	}
	const categories = base.categories.map((category) => {
		const change = changes.products[category.slug];
		if (!change) return category;
		return {
			...category,
			name: change.name ?? category.name,
			tagline: change.description ?? category.tagline,
			...change.image !== void 0 ? { photo: change.image } : {}
		};
	});
	const toppings = [];
	for (const topping of base.toppings) {
		const change = changes.toppings[topping.id];
		if (!change) toppings.push(topping);
		else if (!change.deleted) toppings.push(changeTopping(topping, change));
	}
	const knownToppings = new Set(base.toppings.map((topping) => topping.id));
	for (const [id, change] of Object.entries(changes.toppings)) {
		const name = change.name?.trim();
		if (knownToppings.has(id) || !change.created || change.deleted || !name || !change.group) continue;
		toppings.push(changeTopping({
			id,
			group: change.group,
			name,
			priceCents: change.priceCents ?? 0
		}, {
			...change,
			name
		}));
	}
	const sections = changes.sections ?? {};
	const drawers = base.drawers.map((drawer) => {
		const change = sections[drawer.id];
		if (!change) return drawer;
		const name = change.name?.trim();
		return {
			...drawer,
			...name ? {
				title: name,
				navLabel: name,
				pillLabel: name
			} : {},
			...change.subtitle !== void 0 ? { subtitle: change.subtitle } : {}
		};
	});
	const monte = sections.monte?.name?.trim();
	const groupTitles = monte ? {
		...base.groupTitles,
		monte
	} : base.groupTitles;
	for (const [slug, product] of Object.entries(products)) if (product.flavorsFrom) products[slug] = {
		...product,
		flavors: flavorsFromToppings(toppings, product.flavorsFrom)
	};
	return {
		items,
		toppings,
		products,
		categories,
		drawers,
		groupTitles
	};
}
var GROUP_IDS = [
	"dry",
	"fruit",
	"syrup",
	"paid",
	"batido"
];
var DRAWER_IDS = new Set(BASE_DRAWERS.map((drawer) => drawer.id));
var SECTION_IDS = /* @__PURE__ */ new Set([...DRAWER_IDS, "monte"]);
var CATEGORY_SLUGS = /* @__PURE__ */ new Set([
	"acai-oca",
	"acai-tradicional",
	"acai-batido",
	"milk-shake"
]);
var isRecord$1 = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
var isCents = (value) => Number.isInteger(value) && value >= 0 && value <= 1e7;
var text = (value, max) => typeof value === "string" ? value.trim().slice(0, max) : void 0;
function parseItem(raw) {
	const change = {};
	const name = text(raw.name, 80);
	if (name) change.name = name;
	const description = text(raw.description, 300);
	if (description !== void 0) change.description = description;
	if (isCents(raw.priceCents)) change.priceCents = raw.priceCents;
	if (raw.originalPriceCents === null || isCents(raw.originalPriceCents)) change.originalPriceCents = raw.originalPriceCents;
	const image = text(raw.image, 2e3);
	if (image) change.image = image;
	if (Array.isArray(raw.flavors)) change.flavors = raw.flavors.flatMap((flavor) => {
		const value = text(flavor, 60);
		return value ? [value] : [];
	});
	if (Array.isArray(raw.sizes)) change.sizes = raw.sizes.flatMap((entry) => {
		if (!isRecord$1(entry)) return [];
		const sizeName = text(entry.name, 40);
		return sizeName && isCents(entry.priceCents) ? [{
			name: sizeName,
			priceCents: entry.priceCents
		}] : [];
	}).slice(0, 12);
	if (Array.isArray(raw.groups)) change.groups = parseGroups(raw.groups);
	if (typeof raw.available === "boolean") change.available = raw.available;
	if (typeof raw.drawer === "string" && DRAWER_IDS.has(raw.drawer)) change.drawer = raw.drawer;
	if (raw.deleted === true) change.deleted = true;
	if (raw.created === true) change.created = true;
	return change;
}
function parseProduct(raw) {
	const change = {};
	const name = text(raw.name, 80);
	if (name) change.name = name;
	const description = text(raw.description, 300);
	if (description !== void 0) change.description = description;
	const image = text(raw.image, 2e3);
	if (image) change.image = image;
	if (isRecord$1(raw.sizePrices)) {
		const prices = Object.fromEntries(Object.entries(raw.sizePrices).filter(([, price]) => isCents(price)));
		if (Object.keys(prices).length > 0) change.sizePrices = prices;
	}
	if (Array.isArray(raw.sizes)) {
		const sizes = raw.sizes.flatMap((entry) => {
			if (!isRecord$1(entry)) return [];
			const sizeName = text(entry.name, 40);
			if (!sizeName || !isCents(entry.priceCents)) return [];
			const free = Number.isInteger(entry.freeToppings) ? Math.min(20, Math.max(0, entry.freeToppings)) : 0;
			const id = text(entry.id, 40);
			return [{
				...id ? { id } : {},
				name: sizeName,
				priceCents: entry.priceCents,
				freeToppings: free
			}];
		}).slice(0, 16);
		if (sizes.length > 0) change.sizes = sizes;
	}
	if (typeof raw.available === "boolean") change.available = raw.available;
	if (Array.isArray(raw.flavors)) change.flavors = parseOptions(raw.flavors, true);
	return change;
}
var MAX_OPTIONS = 40;
var MAX_GROUPS = 3;
var optionId = (value) => {
	const id = text(value, 40);
	return id && /^[a-z0-9-]+$/.test(id) ? id : void 0;
};
/** Opções (ou sabores) com nome, sem repetir o nome, até 40; o esgotado só quando `false`. */
function parseOptions(raw, withId) {
	const seen = /* @__PURE__ */ new Set();
	const options = [];
	for (const entry of raw) {
		if (!isRecord$1(entry)) continue;
		const name = text(entry.name, 60);
		const key = name ? foldText(name).toLowerCase() : "";
		if (!name || seen.has(key)) continue;
		seen.add(key);
		const id = withId ? optionId(entry.id) : void 0;
		options.push({
			...id ? { id } : {},
			name,
			...entry.available === false ? { available: false } : {}
		});
		if (options.length === MAX_OPTIONS) break;
	}
	return options;
}
/** Escolhas de um item: até 3, cada uma com nome e pelo menos uma opção. */
function parseGroups(raw) {
	const groups = [];
	for (const entry of raw) {
		if (!isRecord$1(entry) || !Array.isArray(entry.options)) continue;
		const label = text(entry.label, 40);
		const options = parseOptions(entry.options, false);
		if (!label || options.length === 0) continue;
		const id = optionId(entry.id);
		groups.push({
			...id ? { id } : {},
			label,
			options
		});
		if (groups.length === MAX_GROUPS) break;
	}
	return groups;
}
function parseSectionChange(raw) {
	const change = {};
	const name = text(raw.name, 60);
	if (name) change.name = name;
	const subtitle = text(raw.subtitle, 160);
	if (subtitle !== void 0) change.subtitle = subtitle;
	return change;
}
function parseTopping(raw) {
	const change = {};
	const name = text(raw.name, 60);
	if (name) change.name = name;
	if (isCents(raw.priceCents)) change.priceCents = raw.priceCents;
	const image = text(raw.image, 2e3);
	if (image) change.image = image;
	if (typeof raw.available === "boolean") change.available = raw.available;
	if (raw.deleted === true) change.deleted = true;
	if (typeof raw.group === "string" && GROUP_IDS.includes(raw.group)) change.group = raw.group;
	if (raw.created === true) change.created = true;
	return change;
}
function parseSection(raw, parse, accept = () => true) {
	if (!isRecord$1(raw)) return {};
	const result = {};
	for (const [id, entry] of Object.entries(raw)) {
		if (!id || id.length > 80 || !accept(id) || !isRecord$1(entry)) continue;
		const change = parse(entry);
		if (Object.keys(change).length > 0) result[id] = change;
	}
	return result;
}
/** Id da única mudança do tipo `settings`: as configurações da loja. */
var STORE_SETTINGS_ID = "loja";
/** As mudanças guardadas no aparelho ou lidas do Supabase, só com campos válidos. */
function parseChanges(raw) {
	if (!isRecord$1(raw)) return NO_CHANGES;
	return {
		items: parseSection(raw.items, parseItem),
		products: parseSection(raw.products, parseProduct, (slug) => CATEGORY_SLUGS.has(slug)),
		toppings: parseSection(raw.toppings, parseTopping),
		sections: parseSection(raw.sections, parseSectionChange, (id) => SECTION_IDS.has(id)),
		settings: parseSection(raw.settings, parseStoreSettingsChange, (id) => id === STORE_SETTINGS_ID)
	};
}
// src/features/catalog/catalogNav.ts
/** Título do grupo dos 4 produtos (o vendedor pode renomear). Ligação viva. */
var MONTE_TITLE = "Monte do seu jeito";
var BASE_MONTE_TITLE = MONTE_TITLE;
/** Troca o título do grupo (só `catalogStore.ts` chama). */
function setMonteTitle(title) {
	MONTE_TITLE = title;
}
var MAIN_ANCHORS = {
	"acai-oca": "secao-acai-oca",
	"acai-tradicional": "secao-acai-tradicional",
	"acai-batido": "secao-acai-batido",
	"milk-shake": "secao-milkshake"
};
drawerById("combos-e-ofertas").anchor;
[...CATEGORIES.map((category) => MAIN_ANCHORS[category.slug]), ...DRAWERS.map((drawer) => drawer.anchor)];
Object.fromEntries([...CATEGORIES.map((category) => [category.slug, MAIN_ANCHORS[category.slug]]), ...DRAWERS.map((drawer) => [drawer.id, drawer.anchor])]);
// src/features/catalog/catalogState.ts
/**
* O cardápio em uso, sem React (pedido de 2026-11-17): o do código com as mudanças do vendedor por
* cima. O site usa por `catalogStore.ts` (que junta os ganchos do React); a função do pedido no
* servidor usa direto, para conferir os preços com as mesmas regras.
*
* Ao trocar as mudanças, os dados que todo o código importa (`EXTRA_ITEMS`, `TOPPINGS`, `PRODUCTS`,
* `CATEGORIES`) são substituídos (ligações vivas de ES modules) e quem ouve é avisado.
*/
var BASE = {
	items: BASE_EXTRA_ITEMS,
	toppings: BASE_TOPPINGS,
	products: BASE_PRODUCTS,
	categories: BASE_CATEGORIES,
	drawers: BASE_DRAWERS,
	groupTitles: {}
};
var changes = NO_CHANGES;
/** Fotos guardadas no aparelho (`idb:<id>`) e o endereço temporário (`blob:`) de cada uma. */
var photoUrls = {};
var version = 0;
var listeners = /* @__PURE__ */ new Set();
/**
* Troca `idb:<id>` pelo endereço da foto já carregada. Enquanto ela não carrega, a mudança fica
* sem a foto (aparece a do código, ou nenhuma no item novo).
*/
function withPhotos(source) {
	const resolve = (entries) => Object.fromEntries(Object.entries(entries).map(([id, change]) => {
		if (!change.image?.startsWith("idb:")) return [id, change];
		const url = photoUrls[change.image];
		const next = { ...change };
		if (url) next.image = url;
		else delete next.image;
		return [id, next];
	}));
	return {
		items: resolve(source.items),
		products: resolve(source.products),
		toppings: resolve(source.toppings),
		sections: source.sections,
		settings: source.settings
	};
}
function publish() {
	const data = applyChanges(BASE, withPhotos(changes));
	setExtraItems(data.items);
	setToppings(data.toppings);
	setProducts(data.products);
	setCategories(data.categories);
	setDrawers(data.drawers);
	setMonteTitle(data.groupTitles.monte ?? BASE_MONTE_TITLE);
	version += 1;
	for (const listener of listeners) listener();
}
/** Aplica as mudanças em todo o site e avisa a tela. */
function setCatalogChanges(next) {
	changes = next;
	publish();
}
var settingsCache = null;
/**
* Configurações da loja em uso (pedido de 2026-11-17): o padrão com o que o vendedor mudou por
* cima. A mesma referência enquanto a mudança guardada não muda (para `useSyncExternalStore`).
*/
function getStoreSettings() {
	const source = changes.settings[STORE_SETTINGS_ID];
	if (!settingsCache || settingsCache.source !== source) settingsCache = {
		source,
		value: resolveStoreSettings(source)
	};
	return settingsCache.value;
}
// src/features/checkout/gps.ts
var round6 = (value) => Math.round(value * 1e6) / 1e6;
/**
* Confere o ponto vindo do aparelho ou do pedido: números finitos, dentro do mapa, e não o
* (0, 0) que alguns aparelhos devolvem quando falham. Fora disso, `null`.
*/
function parseGpsPoint(raw) {
	if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
	const { lat, lng } = raw;
	if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
	if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
	const point = {
		lat: round6(lat),
		lng: round6(lng)
	};
	if (point.lat === 0 && point.lng === 0) return null;
	return {
		lat: point.lat + 0,
		lng: point.lng + 0
	};
}
/** O ponto no Google Maps: `https://www.google.com/maps?q=LAT,LNG`. */
function gpsMapsUrl({ lat, lng }) {
	return `https://www.google.com/maps?q=${lat},${lng}`;
}
// src/features/checkout/delivery.ts
/**
* Dados do cliente e frete no carrinho (pedido de 2026-11-17): nome, telefone (opcional),
* a modalidade e o endereço. O frete segue o que o vendedor configurou em "Entrega / Frete":
* grátis, por bairro (lista com o valor de cada um) ou a combinar no WhatsApp.
*
* Três modalidades (pedido de 2026-11-20): entrega (com GPS opcional), retirar na loja para levar
* e comer no local. Retirar e comer no local são sempre grátis e não pedem endereço.
* Regras puras, usadas pelo carrinho e pela função `pedido` do servidor, testadas sem tela.
*/
var DELIVERY_TYPES = [
	"entrega",
	"retirada",
	"local"
];
var isDeliveryType = (value) => DELIVERY_TYPES.includes(value);
var EMPTY_CUSTOMER = {
	name: "",
	phone: "",
	kind: null,
	street: "",
	number: "",
	district: "",
	zoneId: null,
	reference: "",
	gps: null
};
/**
* Dados guardados na aba (`sessionStorage`), conferidos: quem volta ao cardápio para pegar mais
* um item não perde o que já escreveu. Campo de tipo errado vira vazio.
*/
function parseCustomerDraft(raw) {
	if (typeof raw !== "object" || raw === null) return EMPTY_CUSTOMER;
	const data = raw;
	const text = (key) => typeof data[key] === "string" ? data[key].slice(0, 120) : "";
	return {
		name: text("name"),
		phone: text("phone"),
		kind: isDeliveryType(data.kind) ? data.kind : null,
		street: text("street"),
		number: text("number"),
		district: text("district"),
		zoneId: typeof data.zoneId === "string" ? data.zoneId.slice(0, 40) : null,
		reference: text("reference"),
		gps: parseGpsPoint(data.gps)
	};
}
/** O carrinho mostra a lista de bairros (com o valor de cada um) só no modo de taxas com bairros. */
function zoneList(delivery) {
	return delivery.mode === "taxas" ? delivery.zones : [];
}
/**
* Frete do pedido. `null` enquanto não dá para saber: falta escolher a modalidade ou o bairro.
* Retirar e comer no local nunca têm frete, seja qual for o bairro guardado da entrega.
*/
function feeFor(draft, delivery) {
	if (draft.kind === "retirada") return { kind: "retirada" };
	if (draft.kind === "local") return { kind: "local" };
	if (draft.kind !== "entrega") return null;
	if (delivery.mode === "gratis") return { kind: "gratis" };
	const zones = zoneList(delivery);
	if (zones.length === 0 || draft.zoneId === "outro") return { kind: "combinar" };
	const zone = zones.find((candidate) => candidate.id === draft.zoneId);
	return zone ? {
		kind: "taxa",
		cents: zone.feeCents,
		zoneName: zone.name
	} : null;
}
/** Quanto o frete soma no total (a combinar soma 0 e o total avisa). */
function feeCents(fee) {
	return fee.kind === "taxa" ? fee.cents : 0;
}
var clean = (text) => text.replace(/\s+/g, " ").trim();
/** Confere os dados antes do envio. Os problemas vêm por campo, com o texto que aparece nele. */
function checkCustomer(draft, delivery) {
	const problems = {};
	const name = clean(draft.name);
	if (!name) problems.name = "Escreva seu nome.";
	const phone = clean(draft.phone) ? formatBrazilPhone(draft.phone) : null;
	if (clean(draft.phone) && !phone) problems.phone = "Telefone com DDD, por exemplo (83) 99999-0000.";
	if (!draft.kind) problems.kind = "Escolha entrega, retirada ou comer no local.";
	let fulfillment = draft.kind === "local" ? { kind: "local" } : { kind: "retirada" };
	if (draft.kind === "entrega") {
		const street = clean(draft.street);
		const number = clean(draft.number);
		if (!street) problems.street = "Escreva a rua.";
		if (!number) problems.number = "Escreva o número (ou s/n).";
		const zones = zoneList(delivery);
		const zone = zones.find((candidate) => candidate.id === draft.zoneId);
		const typed = zones.length === 0 || draft.zoneId === "outro";
		let district = "";
		if (typed) {
			district = clean(draft.district);
			if (!district) problems.district = "Escreva o bairro.";
		} else if (zone) district = zone.name;
		else problems.zone = "Escolha o bairro.";
		fulfillment = {
			kind: "entrega",
			street,
			number,
			district,
			reference: clean(draft.reference) || null,
			gps: parseGpsPoint(draft.gps)
		};
	}
	const fee = feeFor(draft, delivery);
	if (Object.keys(problems).length > 0 || !fee) return {
		ok: false,
		problems
	};
	return {
		ok: true,
		customer: {
			name,
			phone,
			fulfillment,
			fee
		}
	};
}
// src/features/checkout/payment.ts
/**
* Forma de pagamento e troco: regras puras, testadas sem tela.
* Pedido de 2026-11-14: Pix, cartão de crédito, cartão de débito ou dinheiro (com troco).
*/
var PAYMENT_METHODS = [
	{
		id: "pix",
		label: "Pix"
	},
	{
		id: "credito",
		label: "Cartão de crédito"
	},
	{
		id: "debito",
		label: "Cartão de débito"
	},
	{
		id: "dinheiro",
		label: "Dinheiro"
	}
];
var EMPTY_PAYMENT = {
	method: null,
	changeFor: "",
	exact: false
};
/**
* Lê um valor em reais digitado pelo cliente e devolve centavos, ou `null` se não der para ler.
* Aceita "50", "50,00", "50,5", "50.00", "1.000", "1.000,00" e "R$ 50,00".
*/
function parseReais(text) {
	const clean = text.replace(/R\$/gi, "").replace(/\s/g, "");
	let normalized;
	if (/^\d{1,3}(\.\d{3})*,\d{0,2}$|^\d+,\d{0,2}$/.test(clean)) normalized = clean.replaceAll(".", "").replace(",", ".");
	else if (/^\d+\.\d{1,2}$/.test(clean)) normalized = clean;
	else if (/^\d{1,3}(\.\d{3})+$/.test(clean)) normalized = clean.replaceAll(".", "");
	else if (/^\d+$/.test(clean)) normalized = clean;
	else return null;
	const cents = Math.round(Number(normalized) * 100);
	return Number.isSafeInteger(cents) ? cents : null;
}
/** Confere o pagamento antes do envio: forma escolhida e, no dinheiro, o troco. */
function checkPayment(draft, totalCents) {
	if (!draft.method) return {
		ok: false,
		problem: "no-method"
	};
	if (draft.method !== "dinheiro") return {
		ok: true,
		payment: { method: draft.method }
	};
	if (draft.exact) return {
		ok: true,
		payment: {
			method: "dinheiro",
			changeForCents: null
		}
	};
	if (!draft.changeFor.trim()) return {
		ok: false,
		problem: "change-missing"
	};
	const changeFor = parseReais(draft.changeFor);
	if (changeFor === null) return {
		ok: false,
		problem: "change-invalid"
	};
	if (changeFor < totalCents) return {
		ok: false,
		problem: "change-too-low"
	};
	return {
		ok: true,
		payment: {
			method: "dinheiro",
			changeForCents: changeFor
		}
	};
}
function paymentProblemText(problem, totalCents) {
	switch (problem) {
		case "no-method": return "Selecione uma forma de pagamento para continuar";
		case "change-missing": return "Informe para quanto precisa de troco ou marque \"Não preciso de troco\".";
		case "change-invalid": return "Digite o valor em reais, por exemplo 50,00.";
		case "change-too-low": return `O valor informado é menor que o total do pedido (${formatBRL(totalCents)})`;
	}
}
// src/features/orders/orderMessage.ts
/**
* Comanda do pedido que vai para o WhatsApp da loja, no modelo aprovado em 2026-11-17: dividida em
* blocos, com emojis para cada informação, fácil de ler na hora do pico.
* - cliente: nome, telefone (se escrito), a modalidade (pedido de 2026-11-20: entrega, retirar ou
*   comer no local), o endereço e o link do GPS (só na entrega) ou o local da loja;
* - itens numerados (1️⃣, 2️⃣...), com a montagem do Completo, o que o cliente tirou, os pagos com
*   o valor, os acompanhamentos por grupo e a observação do item;
* - resumo com subtotal, frete e total; forma de pagamento com troco.
* Usa o negrito (`*texto*`) e o itálico (`_texto_`) do WhatsApp.
*/
var LINE = "━".repeat(20);
var ITEM_INDENT = "   ";
var GROUP_INDENT = "      ";
var dateParts = new Intl.DateTimeFormat("pt-BR", {
	timeZone: "America/Sao_Paulo",
	day: "2-digit",
	month: "2-digit",
	year: "numeric",
	hour: "2-digit",
	minute: "2-digit",
	hourCycle: "h23"
});
/** "17/11/2026 às 15:42", no horário de Brasília. */
function dateTimeText(ms) {
	const part = Object.fromEntries(dateParts.formatToParts(ms).map(({ type, value }) => [type, value]));
	return `${part.day}/${part.month}/${part.year} às ${part.hour}:${part.minute}`;
}
/** Número do item com emoji: 1️⃣ a 9️⃣, 🔟; do 11 em diante, os dígitos em sequência (1️⃣1️⃣). */
function keycap(n) {
	if (n === 10) return "🔟";
	return [...String(n)].map((digit) => `${digit}️⃣`).join("");
}
/** "Creme de ninho (+R$ 3,00)", "2x Kit Kat (+R$ 8,00)", "2x Granola". */
var choiceText = (name, quantity, totalCents = 0) => {
	const base = quantity > 1 ? `${quantity}x ${name}` : name;
	return totalCents > 0 ? `${base} (+${formatBRL(totalCents)})` : base;
};
function productLines(item, number) {
	const summary = summarizeSelection(item.slug, item.selection);
	const details = [summary.sizeLabel, summary.flavorName ? `${summary.flavorLabel}: ${summary.flavorName}` : ""].filter(Boolean).join(" · ");
	const lines = [`${keycap(number)} *${item.quantity}x ${summary.productName}*${details ? ` (${details})` : ""} — *${formatBRL(lineTotalCents(item))}*`];
	if (summary.montagem) {
		const omitted = completeOmitted(PRODUCTS[item.slug], item.selection).map((topping) => topping.name);
		lines.push(`${ITEM_INDENT}✨ *Montagem:* ${omitted.length === 0 ? "COMPLETO (todos os acompanhamentos)" : "COMPLETO"}`);
		if (omitted.length > 0) lines.push(`${ITEM_INDENT}🚫 *RETIRAR (SEM):* ${omitted.join(", ")}`);
	}
	const paid = summary.sections.flatMap((section) => section.items.filter((choice) => choice.totalCents > 0).map((choice) => choiceText(choice.name, choice.quantity, choice.totalCents)));
	if (paid.length > 0) lines.push(`${ITEM_INDENT}➕ *Cremes / Extras Pagos:* ${paid.join(", ")}`);
	const included = summary.sections.map((section) => ({
		label: section.label,
		names: section.items.filter((choice) => choice.totalCents === 0).map((choice) => choiceText(choice.name, choice.quantity))
	})).filter((group) => group.names.length > 0);
	if (included.length > 0) {
		lines.push(`${ITEM_INDENT}🥄 *Acompanhamentos:*`);
		for (const group of included) lines.push(`${GROUP_INDENT}• ${group.label}: ${group.names.join(", ")}`);
	}
	return lines;
}
function extraLines(item, number) {
	const { name, rows } = describeExtra(item);
	const details = rows.length === 1 ? ` (${rows[0].label}: ${rows[0].value})` : "";
	const lines = [`${keycap(number)} *${item.quantity}x ${name}*${details} — *${formatBRL(lineTotalCents(item))}*`];
	if (rows.length > 1) for (const row of rows) lines.push(`${ITEM_INDENT}• *${row.label}:* ${row.value}`);
	return lines;
}
function itemLines(item, number) {
	const lines = item.kind === "extra" ? extraLines(item, number) : productLines(item, number);
	if (item.note) lines.push(`${ITEM_INDENT}📝 *Observação:* ${item.note}`);
	return lines;
}
/** A modalidade como a loja lê na comanda (textos do pedido de 2026-11-20). */
var MODALITY = {
	entrega: "🛵 Entrega em Domicílio",
	retirada: "🛍️ Retirar no Local (Levar para casa)",
	local: "🍨 COMER NO LOCAL (Deixar pronto para chegada)"
};
/**
* Modalidade e onde: na entrega, o endereço e o GPS (só quando anexado); em retirar e comer no
* local, o endereço da loja de "Horários e Contato", nunca o endereço ou o GPS do cliente.
*/
function fulfillmentLines(fulfillment) {
	const lines = [`• *Modalidade:* ${MODALITY[fulfillment.kind]}`];
	if (fulfillment.kind === "entrega") {
		const reference = fulfillment.reference ? ` — Ref.: ${fulfillment.reference}` : "";
		lines.push(`• *Endereço:* ${fulfillment.street}, ${fulfillment.number}, ${fulfillment.district}${reference}`);
		if (fulfillment.gps) lines.push(`• *Localização GPS:* ${gpsMapsUrl(fulfillment.gps)}`);
		return lines;
	}
	const place = storePlaceText(getStoreSettings().contact);
	lines.push(fulfillment.kind === "retirada" ? `• *Local de retirada:* ${place}` : `• *Local:* ${place}`);
	return lines;
}
function feeLine(fee) {
	switch (fee.kind) {
		case "retirada": return "🛍️ *Retirada na loja:* Grátis (R$ 0,00)";
		case "local": return "🍨 *Consumo no local:* Grátis (R$ 0,00)";
		case "gratis": return "🛵 *Frete / Entrega:* Grátis (R$ 0,00)";
		case "combinar": return "🛵 *Frete / Entrega:* A combinar";
		case "taxa": return `🛵 *Frete / Entrega (${fee.zoneName}):* ${fee.cents > 0 ? formatBRL(fee.cents) : "Grátis (R$ 0,00)"}`;
	}
}
function paymentLines(payment, amount, totalCents, feeKnown, delivery) {
	const chosen = "• *Método escolhido:*";
	switch (payment.method) {
		case "pix": return [`${chosen} 💠 *Pix* — ${amount}`, "  📎 _Envio o comprovante do Pix nesta conversa._"];
		case "credito":
		case "debito": return [`${chosen} 💳 *${payment.method === "credito" ? "Cartão de crédito" : "Cartão de débito"}* — ${amount}${delivery ? " 📟 _(Levar maquininha)_" : ""}`];
		case "dinheiro": {
			const lines = [`${chosen} 💵 *Dinheiro* — ${amount}`];
			if (payment.changeForCents === null) lines.push("  ✅ *Troco:* Não precisa (valor exato)");
			else if (feeKnown) lines.push(`  🪙 *Troco para:* ${formatBRL(payment.changeForCents)} *(Levar ${formatBRL(payment.changeForCents - totalCents)} de troco)*`);
			else lines.push(`  🪙 *Troco para:* ${formatBRL(payment.changeForCents)}`);
			return lines;
		}
	}
}
function buildOrderMessage({ cart, customer, payment, sentAt, antecipado, code, naoRegistrado }) {
	const subtotalCents = cartTotalCents(cart);
	const totalCents = subtotalCents + feeCents(customer.fee);
	const feeKnown = customer.fee.kind !== "combinar";
	const amount = `*${formatBRL(totalCents)}*${feeKnown ? "" : " + frete a combinar"}`;
	const { fulfillment } = customer;
	const delivery = fulfillment.kind === "entrega";
	const lines = [`🍧 *NOVO PEDIDO — ${storeInfo.name.toLocaleUpperCase("pt-BR")}* 🍧`];
	if (code) lines.push(`🔖 *Pedido:* ${code}`);
	lines.push(`📅 *Data/Hora:* ${dateTimeText(sentAt)}`);
	if (antecipado) lines.push("⏰ *Pedido antecipado:* enviado com a loja fechada");
	if (naoRegistrado) lines.push("⚠️ *Pedido não registrado no sistema*");
	lines.push("", "👤 *DADOS DO CLIENTE*", `• *Nome:* ${customer.name}`);
	if (customer.phone) lines.push(`• *Telefone:* ${customer.phone}`);
	lines.push(...fulfillmentLines(fulfillment));
	lines.push("", LINE, "🍨 *ITENS DO PEDIDO*", "");
	cart.items.forEach((item, index) => lines.push(...itemLines(item, index + 1), ""));
	lines.push(LINE, "🧾 *RESUMO FINANCEIRO*", `🛍️ *Subtotal dos itens:* ${formatBRL(subtotalCents)}`, feeLine(customer.fee), `💰 *TOTAL A PAGAR:* ${amount}`, "", LINE, "💳 *FORMA DE PAGAMENTO*", ...paymentLines(payment, amount, totalCents, feeKnown, delivery), "", `💜 _Obrigado pela preferência! ${storeInfo.name}_`);
	return lines.join("\n");
}
// src/features/orders/orderRow.ts
/**
* A linha de um pedido na tabela `orders`, montada de um pedido já conferido. A mesma montagem
* vale para a função `pedido` do servidor (Supabase) e para o modo de demonstração local
* (painel ao vivo, 2026-11-20): os dois guardam a mesma estrutura.
*/
/** "Açaí Tradicional (Isopor M)", "Picolé Gourmet". */
function itemName(item) {
	if (item.kind === "extra") return describeExtra(item).name;
	const summary = summarizeSelection(item.slug, item.selection);
	return summary.sizeLabel ? `${summary.productName} (${summary.sizeLabel})` : summary.productName;
}
function snapshot(cart) {
	return cart.items.map((item) => ({
		name: itemName(item),
		quantity: item.quantity,
		unit_cents: unitPriceCents(item),
		total_cents: lineTotalCents(item),
		...item.note ? { note: item.note } : {}
	}));
}
/** Os campos da linha que vêm do pedido (sem a chave de repetição, o número e o código). */
function orderRowFields({ cart, customer, payment, antecipado, message, whatsapp }) {
	const subtotalCents = cartTotalCents(cart);
	const { fulfillment, fee } = customer;
	const gps = fulfillment.kind === "entrega" ? fulfillment.gps : null;
	return {
		message,
		whatsapp,
		customer_name: customer.name,
		customer_phone: customer.phone,
		fulfillment: fulfillment.kind,
		address: fulfillment.kind === "entrega" ? {
			street: fulfillment.street,
			number: fulfillment.number,
			district: fulfillment.district,
			reference: fulfillment.reference
		} : null,
		delivery_fee: fee.kind,
		delivery_fee_cents: feeCents(fee),
		delivery_zone: fee.kind === "taxa" ? fee.zoneName : null,
		customer_lat: gps ? gps.lat : null,
		customer_lng: gps ? gps.lng : null,
		maps_url: gps ? gpsMapsUrl(gps) : null,
		payment_method: payment.method,
		change_for_cents: payment.method === "dinheiro" ? payment.changeForCents : null,
		subtotal_cents: subtotalCents,
		total_cents: subtotalCents + feeCents(fee),
		antecipado,
		items: snapshot(cart),
		cart: JSON.parse(serializeCart(cart))
	};
}
// src/features/store-hours/hours.ts
/**
* Horário de funcionamento do Açaí Doce Sabor. Padrão do briefing de 2026-11-12: todos os dias,
* das 13:00 às 21:00, no horário de Brasília. Desde 2026-11-17 o vendedor muda o horário
* ("Horários e Contato") e abre ou fecha a loja fora dele pelo interruptor (opção 1A):
* - "Fechar" vale até a abertura do dia seguinte (o dia da loja vira às 5h);
* - "Abrir" antes da abertura vale até o fechamento; depois do fechamento, até as 5h;
* - passado o prazo do interruptor, volta a valer o horário.
*
* Funções puras: recebem o instante (milissegundos desde 1970, UTC) e devolvem o estado.
* O fuso vem do nome oficial (`America/Sao_Paulo`), então o resultado não depende do fuso
* configurado no aparelho. A hora certa vem de `serverClock.ts`.
*/
var STORE_HOURS = {
	timeZone: "America/Sao_Paulo",
	/** 13:00, em minutos desde a meia-noite. */
	opensAt: DEFAULT_STORE_SETTINGS.hours.opensAt,
	/** 21:00. Às 21:00 em ponto a loja já está fechada. */
	closesAt: DEFAULT_STORE_SETTINGS.hours.closesAt
};
var MS_PER_MINUTE = 6e4;
var MS_PER_DAY = MINUTES_PER_DAY * MS_PER_MINUTE;
var clock = new Intl.DateTimeFormat("en-US", {
	timeZone: STORE_HOURS.timeZone,
	hour: "numeric",
	minute: "numeric",
	second: "numeric",
	hourCycle: "h23"
});
/** Hora local de Brasília no instante dado: minutos desde a meia-noite e segundos. */
function brasiliaTime(ms) {
	const parts = Object.fromEntries(clock.formatToParts(ms).map((part) => [part.type, part.value]));
	return {
		minutes: Number(parts.hour) * 60 + Number(parts.minute),
		seconds: Number(parts.second)
	};
}
/** Meia-noite de Brasília do dia do instante (o Brasil não tem horário de verão desde 2019). */
function localMidnight(ms) {
	const { minutes, seconds } = brasiliaTime(ms);
	return ms - ms % 1e3 - seconds * 1e3 - minutes * MS_PER_MINUTE;
}
var OPEN_DETAIL = "Entrega rápida em Teixeira";
/** "13h", "13h30"; a meia-noite do fim do dia (1440) vira "0h". */
var hourLabel = (minutes) => {
	const hour = Math.floor(minutes / 60) % 24;
	const minute = minutes % 60;
	return minute ? `${hour}h${String(minute).padStart(2, "0")}` : `${hour}h`;
};
/** Estado da loja pelo horário, no instante dado. */
function storeStatusAt(ms, hours = STORE_HOURS) {
	const { minutes, seconds } = brasiliaTime(ms);
	const { opensAt, closesAt } = hours;
	const startOfMinute = ms - seconds * 1e3 - ms % 1e3;
	const inMinutes = (target) => startOfMinute + target * MS_PER_MINUTE;
	if (minutes >= opensAt && minutes < closesAt) return {
		open: true,
		title: "ABERTO AGORA",
		detail: OPEN_DETAIL,
		changesAt: inMinutes(closesAt - minutes)
	};
	if (minutes < opensAt) return {
		open: false,
		title: "FECHADO AGORA",
		detail: `Abrimos hoje às ${hourLabel(opensAt)}`,
		changesAt: inMinutes(opensAt - minutes)
	};
	return {
		open: false,
		title: "FECHADO AGORA",
		detail: `Abrimos amanhã às ${hourLabel(opensAt)}`,
		changesAt: inMinutes(MINUTES_PER_DAY - minutes + opensAt)
	};
}
/** "hoje", "amanhã" ou "no dia 19/11": o dia de `at` visto do instante `now`. */
function dayWord(now, at) {
	const days = Math.round((localMidnight(at) - localMidnight(now)) / MS_PER_DAY);
	if (days === 0) return "hoje";
	if (days === 1) return "amanhã";
	return `no dia ${new Intl.DateTimeFormat("pt-BR", {
		timeZone: STORE_HOURS.timeZone,
		day: "2-digit",
		month: "2-digit"
	}).format(at)}`;
}
function closedStatus(now, reopensAt, changesAt, manual) {
	const time = hourLabel(brasiliaTime(reopensAt).minutes);
	const day = dayWord(now, reopensAt);
	return {
		open: false,
		title: "FECHADO AGORA",
		detail: `Abrimos ${day} às ${time}`,
		changesAt,
		manual,
		reopensAt,
		reopenText: `${day} a partir das ${time}`
	};
}
/** Estado que o cliente vê: o interruptor do vendedor enquanto vale; depois, o horário. */
function effectiveStatus(ms, settings) {
	const { override, hours, deliveryTime } = settings;
	const openDetail = `Entrega: ${deliveryTime}`;
	if (override && ms < override.until) {
		if (override.state === "open") return {
			open: true,
			title: "ABERTO AGORA",
			detail: openDetail,
			changesAt: override.until,
			manual: true,
			reopensAt: null,
			reopenText: null
		};
		const after = storeStatusAt(override.until, hours);
		return closedStatus(ms, after.open ? override.until : after.changesAt, override.until, true);
	}
	const byHours = storeStatusAt(ms, hours);
	if (byHours.open) return {
		...byHours,
		detail: openDetail,
		manual: false,
		reopensAt: null,
		reopenText: null
	};
	return closedStatus(ms, byHours.changesAt, byHours.changesAt, false);
}
/** "Todos os dias, das 13h às 21h" (ou "das 14h à meia-noite"): para rodapé e informações da loja. */
function hoursText({ opensAt, closesAt }) {
	const end = closesAt === 1440 ? "à meia-noite" : `às ${hourLabel(closesAt)}`;
	return `Todos os dias, das ${hourLabel(opensAt)} ${end}`;
}
hoursText(STORE_HOURS);
// src/services/supabaseBackend.ts
/**
* Gravação do modo vendedor no Supabase (opção B, pedido de 2026-11-16): as mudanças valem para
* todos os clientes. A última leitura fica guardada no aparelho e é aplicada na hora na próxima
* visita (`loadSync`), antes de a rede responder.
*/
var KINDS = [
	"items",
	"products",
	"toppings",
	"sections",
	"settings"
];
/** Linhas da tabela `catalog_changes` → mudanças (só campos válidos). */
function changesFromRows(rows) {
	const raw = {
		items: {},
		products: {},
		toppings: {},
		sections: {},
		settings: {}
	};
	for (const row of rows) if (KINDS.includes(row.kind) && typeof row.id === "string") raw[row.kind][row.id] = row.data;
	return parseChanges(raw);
}
/** Marca do código na comanda, trocada pelo código de verdade depois de sair o número. */
var CODE_MARK = "{{CODIGO_DO_PEDIDO}}";
var reject = (reason, detail) => detail ? {
	ok: false,
	reason,
	detail
} : {
	ok: false,
	reason
};
/** "ADS-0001": o número do pedido com pelo menos 4 dígitos. */
function orderCode(number) {
	return `ADS-${String(number).padStart(4, "0")}`;
}
var isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
function parsePayment(raw) {
	if (!isRecord(raw)) return EMPTY_PAYMENT;
	return {
		method: PAYMENT_METHODS.find((candidate) => candidate.id === raw.method)?.id ?? null,
		changeFor: typeof raw.changeFor === "string" ? raw.changeFor.slice(0, 20) : "",
		exact: raw.exact === true
	};
}
function parseInput(raw) {
	if (!isRecord(raw)) return null;
	const { cart, expectedTotalCents } = raw;
	if (typeof cart !== "string" || cart.length > 2e5) return null;
	if (typeof expectedTotalCents !== "number" || !Number.isSafeInteger(expectedTotalCents) || expectedTotalCents < 0) return null;
	return {
		cart,
		customer: parseCustomerDraft(raw.customer),
		payment: parsePayment(raw.payment),
		expectedTotalCents
	};
}
/** Quantas linhas o carrinho recebido diz ter (para saber se alguma ficou de fora na leitura). */
function declaredLines(cart) {
	try {
		const data = JSON.parse(cart);
		return isRecord(data) && Array.isArray(data.items) ? data.items.length : 0;
	} catch {
		return 0;
	}
}
/**
* Confere o pedido com o cardápio em uso e monta a linha e a comanda (com a marca do código).
* Tudo síncrono: o cardápio é um estado do módulo, e outra chamada não pode trocá-lo no meio.
*/
function prepare(input, now) {
	const lines = declaredLines(input.cart);
	if (lines > 60) return reject("pedido-invalido");
	const cart = parseCart(input.cart);
	if (cart.items.length === 0) return reject(lines === 0 ? "carrinho-vazio" : "item-indisponivel");
	if (cart.items.length !== lines) return reject("item-indisponivel");
	const soldOut = cart.items.flatMap((item) => {
		const problem = cartItemProblem(item);
		if (!problem) return [];
		return problem.kind === "item" ? [itemName(item)] : problem.names;
	});
	if (soldOut.length > 0) return reject("esgotado", soldOut.join(", "));
	const settings = getStoreSettings();
	const status = effectiveStatus(now, settings);
	if (!status.open && settings.closedOrders === "bloquear") return reject("loja-fechada", status.reopenText ?? void 0);
	const customerCheck = checkCustomer(input.customer, settings.delivery);
	if (!customerCheck.ok) return reject("dados-invalidos", Object.values(customerCheck.problems)[0]);
	const { customer } = customerCheck;
	const totalCents = cartTotalCents(cart) + feeCents(customer.fee);
	const paymentCheck = checkPayment(input.payment, totalCents);
	if (!paymentCheck.ok) return reject("pagamento-invalido", paymentProblemText(paymentCheck.problem, totalCents));
	if (totalCents !== input.expectedTotalCents) return {
		ok: false,
		reason: "total-mudou",
		totalCents
	};
	const { payment } = paymentCheck;
	const antecipado = !status.open;
	return {
		ok: true,
		row: orderRowFields({
			cart,
			customer,
			payment,
			antecipado,
			message: buildOrderMessage({
				cart,
				customer,
				payment,
				sentAt: now,
				antecipado,
				code: CODE_MARK
			}),
			whatsapp: toWhatsAppNumber(settings.contact.whatsapp)
		})
	};
}
var accepted = (order, repeated) => ({
	ok: true,
	code: order.code,
	message: order.message,
	totalCents: order.total_cents,
	whatsapp: order.whatsapp,
	repeated
});
/** Confere e grava o pedido. Erro do banco (rede, chave) sobe: a função responde 500. */
async function handleOrder(raw, deps) {
	const input = parseInput(raw);
	if (!input) return reject("pedido-invalido");
	const attemptKey = await deps.sha256(JSON.stringify([
		input.cart,
		input.customer,
		input.payment
	]));
	const existing = await deps.findOrder(attemptKey);
	if (existing) return accepted(existing, true);
	setCatalogChanges(changesFromRows(await deps.readChanges()));
	const prepared = prepare(input, deps.now());
	if (!prepared.ok) return prepared;
	const number = await deps.nextNumber();
	const code = orderCode(number);
	const row = {
		...prepared.row,
		attempt_key: attemptKey,
		number,
		code,
		message: prepared.row.message.replace(CODE_MARK, code)
	};
	const stored = await deps.insertOrder(row) ?? await deps.findOrder(attemptKey);
	if (!stored) throw new Error("O pedido não foi gravado.");
	return accepted(stored, stored.code !== code);
}
var CORS_HEADERS = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
	"Access-Control-Allow-Methods": "POST, OPTIONS",
	"Access-Control-Max-Age": "86400"
};
var json = (status, body) => new Response(JSON.stringify(body), {
	status,
	headers: {
		...CORS_HEADERS,
		"Content-Type": "application/json; charset=utf-8"
	}
});
/** SHA-256 em hexadecimal (Web Crypto: Deno, Node e navegador em HTTPS). */
async function sha256Hex(text) {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
/** O banco montado só no primeiro uso: entrada recusada pelas regras nem chega a ele. */
function lazyDeps(getDeps) {
	let deps = null;
	const get = () => deps ??= getDeps();
	return {
		readChanges: () => get().readChanges(),
		findOrder: (attemptKey) => get().findOrder(attemptKey),
		nextNumber: () => get().nextNumber(),
		insertOrder: (row) => get().insertOrder(row),
		now: () => get().now(),
		sha256: (text) => get().sha256(text)
	};
}
/**
* `getDeps` monta o banco na hora do pedido (a falta de configuração vira 500 com o motivo no log,
* e não uma função que nem sobe).
*/
function createOrderHandler(getDeps, log = () => {}) {
	return async (request) => {
		if (request.method === "OPTIONS") return new Response(null, {
			status: 204,
			headers: CORS_HEADERS
		});
		if (request.method !== "POST") return json(405, {
			ok: false,
			reason: "pedido-invalido"
		});
		if (Number(request.headers.get("content-length") ?? "0") > 25e4) return json(413, {
			ok: false,
			reason: "pedido-invalido"
		});
		const text = await request.text();
		if (text.length > 25e4) return json(413, {
			ok: false,
			reason: "pedido-invalido"
		});
		let raw;
		try {
			raw = JSON.parse(text);
		} catch {
			return json(400, {
				ok: false,
				reason: "pedido-invalido"
			});
		}
		try {
			return json(200, await handleOrder(raw, lazyDeps(getDeps)));
		} catch (error) {
			log(`Falha ao registrar o pedido: ${error instanceof Error ? error.message : String(error)}`);
			return json(500, {
				ok: false,
				reason: "erro-servidor"
			});
		}
	};
}
// src/server/orderStore.ts
var STORED_COLUMNS = "code,message,total_cents,whatsapp";
function createOrderStore({ url, key }, fetchImpl) {
	const base = url.replace(/\/+$/, "");
	const headers = (extra = {}) => ({
		apikey: key,
		...key.startsWith("eyJ") ? { Authorization: `Bearer ${key}` } : {},
		Accept: "application/json",
		"Content-Type": "application/json",
		...extra
	});
	const request = async (path, init = {}) => {
		const response = await fetchImpl(`${base}${path}`, init);
		if (!response.ok) throw new Error(`Supabase respondeu ${response.status} em ${path.split("?")[0]}`);
		const text = await response.text();
		return text ? JSON.parse(text) : null;
	};
	const firstStored = (value) => Array.isArray(value) && value.length > 0 ? value[0] : null;
	return {
		async readChanges() {
			const rows = await request("/rest/v1/catalog_changes?select=kind,id,data", { headers: headers() });
			return Array.isArray(rows) ? rows : [];
		},
		async findOrder(attemptKey) {
			const rows = await request(`/rest/v1/orders?select=${STORED_COLUMNS}&attempt_key=eq.${encodeURIComponent(attemptKey)}&limit=1`, { headers: headers() });
			return firstStored(rows);
		},
		async nextNumber() {
			const value = await request("/rest/v1/rpc/proximo_numero_pedido", {
				method: "POST",
				headers: headers(),
				body: "{}"
			});
			const number = typeof value === "string" ? Number(value) : value;
			if (typeof number !== "number" || !Number.isSafeInteger(number) || number < 1) throw new Error("Número de pedido inválido vindo do banco.");
			return number;
		},
		async insertOrder(row) {
			const rows = await request(`/rest/v1/orders?on_conflict=attempt_key&select=${STORED_COLUMNS}`, {
				method: "POST",
				headers: headers({ Prefer: "return=representation,resolution=ignore-duplicates" }),
				body: JSON.stringify(row)
			});
			return firstStored(rows);
		}
	};
}
// src/server/pedidoFunction.ts
/**
* Função `pedido` do Supabase (Edge Function, Deno), pedido de 2026-11-17, opção A.
*
* Este arquivo vira `supabase/functions/pedido/index.ts` por `npm run build:pedido` (um arquivo só,
* com o cardápio e as regras do site dentro). É esse arquivo que se cola no editor de funções do
* painel do Supabase. A chave de servidor vem do ambiente da função, que o Supabase preenche
* sozinho; ela nunca vai para o site.
*/
/** A chave de servidor: a nova (SUPABASE_SECRET_KEYS) ou a antiga (service_role). */
function serverKey() {
	try {
		const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
		if (typeof keys.default === "string" && keys.default) return keys.default;
	} catch {}
	return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || void 0;
}
Deno.serve(createOrderHandler(() => {
	const url = Deno.env.get("SUPABASE_URL");
	const key = serverKey();
	if (!url || !key) throw new Error("SUPABASE_URL ou a chave de servidor não estão no ambiente da função.");
	return {
		...createOrderStore({
			url,
			key
		}, fetch),
		now: () => Date.now(),
		sha256: sha256Hex
	};
}, (message) => console.error(message)));
