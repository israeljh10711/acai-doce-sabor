/**
 * O cardápio do código em registros do banco (cardápio dinâmico, 2026-11-21). É:
 * - a semente da migração (`scripts/catalogo/gerar-semente.ts` escreve o SQL a partir daqui);
 * - o cardápio do modo de demonstração, quando o aparelho ainda não tem um guardado.
 *
 * `recordsToCatalog(baseCatalogRecords())` devolve exatamente o cardápio do código (teste em
 * `records.test.ts`). Os ids continuam os mesmos: carrinhos e pedidos antigos seguem valendo.
 */
import { foldText } from '../../utils/text.ts'
import { BASE_OFFER_RECORDS } from '../offers/baseOffers.ts'
import { BASE_CATEGORIES } from './categories.ts'
import { BASE_DRAWERS, BASE_EXTRA_ITEMS, type ChoiceGroup, type ExtraItem } from './extras.ts'
import { BASE_PRODUCTS, BASE_TOPPING_GROUPS, BASE_TOPPINGS, type Product } from './menu.ts'
import type {
  CatalogRecords,
  CategoryRecord,
  ChoiceOptionRecord,
  ChoiceRecord,
  GroupRecord,
  OptionRecord,
  ProductDetails,
  ProductGroupRecord,
  ProductRecord,
  VariantRecord,
} from './records.ts'

/** A categoria em vitrine: os cartões de "Monte do seu jeito". */
export const VITRINE_ID = 'monte-do-seu-jeito'
export const VITRINE_TITLE = 'Monte do seu jeito'

/** Id a partir do nome: "1 Litro" → "1-litro". */
export function slugOf(text: string): string {
  return foldText(text)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/** Ids únicos para uma lista de nomes (o segundo "Morango" vira "morango-2"). */
export function uniqueIds(names: readonly string[]): string[] {
  const used = new Set<string>()
  return names.map((name) => {
    const base = slugOf(name) || 'opcao'
    let id = base
    for (let n = 2; used.has(id); n++) id = `${base}-${n}`
    used.add(id)
    return id
  })
}

const minPrice = (product: Product) => Math.min(...product.sizes.map((size) => size.priceCents))

function montavelDetails(product: Product): ProductDetails {
  return {
    ...(product.flavorTerm ? { flavorTerm: product.flavorTerm } : {}),
    ...(product.flavorHint ? { flavorHint: product.flavorHint } : {}),
    ...(product.flavorNotice ? { flavorNotice: product.flavorNotice } : {}),
  }
}

type Children = { variants: VariantRecord[]; choices: ChoiceRecord[]; choiceOptions: ChoiceOptionRecord[]; productGroups: ProductGroupRecord[] }

function montavelChildren(product: Product): Children {
  const productId = product.slug
  const variants = product.sizes.map((size, position) => ({
    productId,
    id: size.id,
    name: size.name,
    container: size.container,
    priceCents: size.priceCents,
    freeCount: size.freeToppings,
    available: size.available !== false,
    position,
  }))
  const hasChoice = !product.flavorsFrom && product.flavors.length > 0
  const choices: ChoiceRecord[] = hasChoice
    ? [{ productId, id: 'sabor', label: product.flavorTerm?.label ?? 'Sabor', allowOther: false, photoAlt: null, position: 0 }]
    : []
  const choiceOptions: ChoiceOptionRecord[] = hasChoice
    ? product.flavors.map((flavor, position) => ({
        productId,
        choiceId: 'sabor',
        id: flavor.id,
        name: flavor.name,
        photo: null,
        available: flavor.available !== false,
        position,
      }))
    : []
  const productGroups = product.groups.map((groupId, position) => ({
    productId,
    groupId,
    position,
    maxSelect: product.groupLimits?.[groupId] ?? null,
  }))
  return { variants, choices, choiceOptions, productGroups }
}

function choiceChildren(item: ExtraItem): Children {
  const productId = item.id
  const groups: readonly ChoiceGroup[] = item.action.type === 'flavor_modal' ? item.action.choices : []
  const variants: VariantRecord[] = []
  const choices: ChoiceRecord[] = []
  const choiceOptions: ChoiceOptionRecord[] = []
  for (const group of groups) {
    if (group.prices) {
      if (group.id !== 'tamanho') throw new Error(`Escolha com preço que não é o tamanho: ${item.id}/${group.id}`)
      const ids = uniqueIds(group.options)
      group.options.forEach((name, position) =>
        variants.push({
          productId,
          id: ids[position],
          name,
          container: null,
          priceCents: group.prices![name],
          freeCount: 0,
          available: !group.unavailable?.includes(name),
          position,
        }),
      )
      continue
    }
    choices.push({ productId, id: group.id, label: group.label, allowOther: group.allowOther === true, photoAlt: group.photoAlt ?? null, position: choices.length })
    const ids = uniqueIds(group.options)
    group.options.forEach((name, position) =>
      choiceOptions.push({
        productId,
        choiceId: group.id,
        id: ids[position],
        name,
        photo: group.photos?.[name] ?? null,
        available: !group.unavailable?.includes(name),
        position,
      }),
    )
  }
  return { variants, choices, choiceOptions, productGroups: [] }
}

const product = (fields: Omit<ProductRecord, 'visible' | 'archivedAt'>): ProductRecord => ({ ...fields, visible: true, archivedAt: null })

/** O cardápio do código (`menu.ts`, `extras.ts`, `categories.ts` e as ofertas) em registros. */
export function baseCatalogRecords(): CatalogRecords {
  const categories: CategoryRecord[] = [
    {
      id: VITRINE_ID,
      name: VITRINE_TITLE,
      subtitle: '',
      icon: 'crown',
      layout: 'vitrine',
      navLabel: VITRINE_TITLE,
      pillLabel: VITRINE_TITLE,
      anchor: '',
      keywords: [],
      position: 0,
      visible: true,
      archivedAt: null,
    },
    ...BASE_DRAWERS.map((drawer, index) => ({
      id: drawer.id,
      name: drawer.title,
      subtitle: drawer.subtitle,
      icon: drawer.icon,
      layout: 'grade' as const,
      navLabel: drawer.navLabel,
      pillLabel: drawer.pillLabel,
      anchor: drawer.anchor,
      keywords: [...drawer.keywords],
      position: index + 1,
      visible: true,
      archivedAt: null,
    })),
  ]

  const products: ProductRecord[] = []
  const children: Children[] = []

  BASE_CATEGORIES.forEach((category, position) => {
    const base = BASE_PRODUCTS[category.slug]
    if (base.name !== category.name) throw new Error(`Nome diferente na categoria e no produto: ${category.slug}`)
    products.push(
      product({
        id: category.slug,
        categoryId: VITRINE_ID,
        kind: 'montavel',
        name: category.name,
        description: '',
        image: category.photo ?? '',
        imageAlt: '',
        priceCents: minPrice(base),
        compareAtCents: null,
        badge: null,
        keywords: [...category.keywords],
        completo: base.completo === true,
        flavorsFrom: base.flavorsFrom ?? null,
        details: {
          summary: category.summary,
          tagline: category.tagline,
          actionLabel: category.actionLabel,
          badges: [...category.badges],
          ...montavelDetails(base),
        },
        position,
        available: base.available !== false,
      }),
    )
    children.push(montavelChildren(base))
  })

  const positions = new Map<string, number>()
  for (const item of BASE_EXTRA_ITEMS) {
    const position = positions.get(item.drawer) ?? 0
    positions.set(item.drawer, position + 1)
    const shared = {
      id: item.id,
      categoryId: item.drawer,
      name: item.name,
      description: item.description,
      image: item.image,
      imageAlt: item.imageAlt,
      priceCents: item.priceCents,
      compareAtCents: item.originalPriceCents ?? null,
      badge: item.badge ?? null,
      keywords: [...item.keywords],
      position,
      available: item.available !== false,
    }
    if (item.action.type === 'customizer') {
      const base = BASE_PRODUCTS[item.action.product]
      if (base.name !== item.name) throw new Error(`Nome diferente no item e no produto: ${item.id}`)
      if (item.action.product !== item.id) throw new Error(`Item do personalizador com id diferente do produto: ${item.id}`)
      products.push(
        product({
          ...shared,
          kind: 'montavel',
          completo: base.completo === true,
          flavorsFrom: base.flavorsFrom ?? null,
          details: { actionLabel: item.action.label, ...montavelDetails(base) },
        }),
      )
      children.push(montavelChildren(base))
      continue
    }
    products.push(
      product({
        ...shared,
        kind: item.action.type === 'flavor_modal' ? 'variacoes' : 'direto',
        completo: false,
        flavorsFrom: null,
        details: {},
      }),
    )
    children.push(choiceChildren(item))
  }

  const groups: GroupRecord[] = Object.values(BASE_TOPPING_GROUPS).map((group, position) => ({
    id: group.id,
    name: group.name,
    rule: group.rule,
    minSelect: group.minSelect ?? 0,
    maxSelect: group.maxSelect ?? null,
    freeCount: group.freeCount ?? null,
    extraPriceCents: group.extraPriceCents ?? 0,
    inCompleto: group.inCompleto === true,
    available: group.available !== false,
    position,
  }))

  const inGroup = new Map<string, number>()
  const options: OptionRecord[] = BASE_TOPPINGS.map((topping) => {
    const position = inGroup.get(topping.group) ?? 0
    inGroup.set(topping.group, position + 1)
    if ((topping.onlyIn?.length ?? 0) > 1) throw new Error(`Complemento de mais de um produto: ${topping.id}`)
    return {
      id: topping.id,
      groupId: topping.group,
      name: topping.name,
      priceCents: topping.priceCents,
      image: topping.image ?? null,
      look: topping.look ?? null,
      productId: topping.onlyIn?.[0] ?? null,
      noCompleto: topping.noCompleto === true,
      available: topping.available !== false,
      position,
      archivedAt: null,
    }
  })

  return {
    revision: 0,
    categories,
    products,
    variants: children.flatMap((entry) => entry.variants),
    choices: children.flatMap((entry) => entry.choices),
    choiceOptions: children.flatMap((entry) => entry.choiceOptions),
    groups,
    options,
    productGroups: children.flatMap((entry) => entry.productGroups),
    offers: [...BASE_OFFER_RECORDS],
  }
}
