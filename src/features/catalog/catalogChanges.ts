/**
 * Mudanças do vendedor sobre o cardápio (modo vendedor, pedido de 2026-11-16).
 *
 * O cardápio do código é a base. As mudanças são uma camada por cima, uma por id: item das
 * seções, produto principal (com os preços dos tamanhos) e complemento. Item novo tem um id
 * gerado e `created`; "Excluir" é `deleted`; "Restaurar original" apaga a mudança. Funções puras:
 * recebem a base e as mudanças e devolvem o cardápio novo, sem alterar a base.
 */
import { foldText } from '../../utils/text.ts'
import type { Category, CategorySlug } from './categories.ts'
import { BASE_DRAWERS, type ChoiceGroup, type Drawer, type DrawerId, type ExtraItem } from './extras.ts'
import type { ContainerKind, Product, ProductSize, ProductSlug, Topping, ToppingGroupId } from './menu.ts'

/** Um tamanho de item das seções: vira uma opção da escolha "Tamanho", com o preço dela. */
export type SizeEntry = { name: string; priceCents: number }

/** Um tamanho de um dos 4 produtos (personalizador): sem `id`, é novo. */
export type ProductSizeEntry = { id?: string; name: string; priceCents: number; freeToppings: number }

export type ItemChange = {
  name?: string
  description?: string
  priceCents?: number
  /** Preço antigo riscado; `null` tira o riscado. */
  originalPriceCents?: number | null
  /** Endereço da foto enviada pelo vendedor. */
  image?: string
  /** Sabores: trocam o primeiro grupo de escolha do item (lista vazia: sem escolha). */
  flavors?: string[]
  /** Tamanhos e preços (ajuste de 2026-11-16): lista vazia volta ao preço único. */
  sizes?: SizeEntry[]
  available?: boolean
  drawer?: DrawerId
  deleted?: boolean
  /** Item novo, que não existe no código. */
  created?: boolean
}

export type ProductChange = {
  name?: string
  description?: string
  image?: string
  /** Preço de cada tamanho, pelo id do tamanho. */
  sizePrices?: Record<string, number>
  /** A lista inteira de tamanhos (ajuste de 2026-11-16); quando existe, vale no lugar de `sizePrices`. */
  sizes?: ProductSizeEntry[]
}

/** Nome e subtítulo de uma seção, ou o título do grupo "Monte do seu jeito" (`monte`). */
export type SectionChange = { name?: string; subtitle?: string }

export type ToppingChange = {
  name?: string
  priceCents?: number
  image?: string
  available?: boolean
  deleted?: boolean
  /** Grupo do complemento novo. */
  group?: ToppingGroupId
  created?: boolean
}

export type CatalogChanges = {
  items: Readonly<Record<string, ItemChange>>
  products: Readonly<Record<string, ProductChange>>
  toppings: Readonly<Record<string, ToppingChange>>
  sections: Readonly<Record<string, SectionChange>>
}

export const NO_CHANGES: CatalogChanges = Object.freeze({ items: {}, products: {}, toppings: {}, sections: {} })

export type CatalogData = {
  items: readonly ExtraItem[]
  toppings: readonly Topping[]
  products: Readonly<Record<ProductSlug, Product>>
  categories: readonly Category[]
  drawers: readonly Drawer[]
  /** Títulos de grupo renomeados (`monte`: "Monte do seu jeito"). */
  groupTitles: Readonly<Partial<Record<'monte', string>>>
}

const isEmpty = (changes: CatalogChanges) =>
  Object.keys(changes.items).length +
    Object.keys(changes.products).length +
    Object.keys(changes.toppings).length +
    Object.keys(changes.sections ?? {}).length ===
  0

/** Tamanhos do item: a escolha "Tamanho" com o preço de cada um vem primeiro; sem tamanhos, sai. */
function withSizes(item: ExtraItem, sizes: readonly SizeEntry[]): Pick<ExtraItem, 'action' | 'priceCents'> {
  if (item.action.type === 'customizer') return { action: item.action, priceCents: item.priceCents }
  const others = (item.action.type === 'flavor_modal' ? item.action.choices : []).filter((group) => !group.prices)
  if (sizes.length === 0) {
    return { action: others.length > 0 ? { type: 'flavor_modal', choices: others } : { type: 'direct_confirm' }, priceCents: item.priceCents }
  }
  const group: ChoiceGroup = {
    id: 'tamanho',
    label: 'Tamanho',
    options: sizes.map((size) => size.name),
    prices: Object.fromEntries(sizes.map((size) => [size.name, size.priceCents])),
  }
  return { action: { type: 'flavor_modal', choices: [group, ...others] }, priceCents: Math.min(...sizes.map((size) => size.priceCents)) }
}

const slugOf = (text: string) =>
  foldText(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

/** Recipiente de um tamanho novo: pelo nome ("Copo 700 ml") ou o dos tamanhos que já existem. */
function containerFor(name: string, existing: readonly ProductSize[]): ContainerKind {
  const text = foldText(name).toLowerCase()
  for (const kind of ['copo', 'isopor', 'barca', 'pote'] as const) if (text.includes(kind)) return kind
  return existing[0]?.container ?? 'pote'
}

/** A lista de tamanhos de um dos 4 produtos: os que existiam mantêm o id e o recipiente. */
function productSizes(product: Product, entries: readonly ProductSizeEntry[]): ProductSize[] {
  const used = new Set<string>()
  return entries.map((entry) => {
    const known = entry.id ? product.sizes.find((size) => size.id === entry.id) : undefined
    let id = known?.id ?? `novo-${slugOf(entry.name) || 'tamanho'}`
    for (let suffix = 2; used.has(id); suffix++) id = `${id.replace(/-\d+$/, '')}-${suffix}`
    used.add(id)
    return {
      id,
      name: entry.name,
      container: known?.container ?? containerFor(entry.name, product.sizes),
      priceCents: entry.priceCents,
      freeToppings: entry.freeToppings,
    }
  })
}

/** Os sabores trocam o primeiro grupo de escolha sem preço; sem grupo, o item passa a pedir o sabor. */
function withFlavors(item: ExtraItem, flavors: readonly string[]): ExtraItem['action'] {
  if (item.action.type === 'customizer') return item.action
  const groups: readonly ChoiceGroup[] = item.action.type === 'flavor_modal' ? item.action.choices : []
  const index = groups.findIndex((group) => !group.prices)
  let next: ChoiceGroup[]
  if (flavors.length === 0) next = groups.filter((_, position) => position !== index)
  else if (index === -1) next = [{ id: 'sabor', label: 'Sabor', options: flavors }, ...groups]
  else next = groups.map((group, position) => (position === index ? { ...group, options: flavors } : group))
  return next.length === 0 ? { type: 'direct_confirm' } : { type: 'flavor_modal', choices: next }
}

function changeItem(item: ExtraItem, change: ItemChange): ExtraItem {
  const next: ExtraItem = { ...item }
  if (change.name !== undefined) next.name = change.name
  if (change.description !== undefined) next.description = change.description
  if (change.priceCents !== undefined) next.priceCents = change.priceCents
  if (change.originalPriceCents === null) delete next.originalPriceCents
  else if (change.originalPriceCents !== undefined) next.originalPriceCents = change.originalPriceCents
  if (change.image !== undefined) next.image = change.image
  // Foto enviada pelo vendedor (um endereço): a descrição é o nome do item. As da loja mantêm a delas.
  if (!next.image.startsWith('images/')) next.imageAlt = next.name
  if (change.available !== undefined) next.available = change.available
  if (change.drawer !== undefined) next.drawer = change.drawer
  if (change.flavors !== undefined) next.action = withFlavors(next, change.flavors)
  if (change.sizes !== undefined) Object.assign(next, withSizes(next, change.sizes))
  return next
}

function newItem(id: string, change: ItemChange): ExtraItem | null {
  const name = change.name?.trim()
  if (!name || (change.priceCents === undefined && !change.sizes?.length) || !change.drawer) return null
  const base: ExtraItem = {
    id,
    drawer: change.drawer,
    name,
    description: change.description ?? '',
    priceCents: change.priceCents ?? 0,
    keywords: [],
    image: change.image ?? '',
    imageAlt: name,
    action: { type: 'direct_confirm' },
  }
  return changeItem(base, { ...change, name, created: undefined, drawer: undefined })
}

function changeTopping(topping: Topping, change: ToppingChange): Topping {
  const next: Topping = { ...topping }
  if (change.name !== undefined) next.name = change.name
  if (change.priceCents !== undefined) next.priceCents = change.priceCents
  if (change.image !== undefined) next.image = change.image
  if (change.available !== undefined) next.available = change.available
  return next
}

/** O cardápio com as mudanças do vendedor. Sem mudanças, devolve a própria base. */
export function applyChanges(base: CatalogData, changes: CatalogChanges): CatalogData {
  if (isEmpty(changes)) return base

  /* Itens das seções. O Pote 1 L e a Barca abrem o personalizador: não podem ser excluídos. */
  const items: ExtraItem[] = []
  for (const item of base.items) {
    const change = changes.items[item.id]
    if (!change) items.push(item)
    else if (!change.deleted || item.action.type === 'customizer') items.push(changeItem(item, change))
  }
  const known = new Set(base.items.map((item) => item.id))
  for (const [id, change] of Object.entries(changes.items)) {
    if (known.has(id) || !change.created || change.deleted) continue
    const created = newItem(id, change)
    if (created) items.push(created)
  }
  // Cada seção na ordem: os do código primeiro, os novos no fim (a lista segue a ordem das seções).
  const drawerOrder = new Map(BASE_DRAWERS.map((drawer, index) => [drawer.id, index]))
  items.sort((a, b) => (drawerOrder.get(a.drawer) ?? 0) - (drawerOrder.get(b.drawer) ?? 0))

  /* Produtos: os 4 principais e os tamanhos; o Pote 1 L e a Barca seguem o item da seção. */
  const products: Record<string, Product> = { ...base.products }
  for (const [slug, change] of Object.entries(changes.products)) {
    const product = products[slug]
    if (!product) continue
    products[slug] = {
      ...product,
      name: change.name ?? product.name,
      sizes:
        change.sizes && change.sizes.length > 0
          ? productSizes(product, change.sizes)
          : product.sizes.map((size) => {
              const price = change.sizePrices?.[size.id]
              return price === undefined ? size : { ...size, priceCents: price }
            }),
    }
  }
  for (const item of items) {
    if (item.action.type !== 'customizer' || !changes.items[item.id]) continue
    const product = products[item.action.product]
    products[item.action.product] = {
      ...product,
      name: item.name,
      sizes: product.sizes.map((size) => ({ ...size, priceCents: item.priceCents })),
    }
  }

  const categories = base.categories.map((category): Category => {
    const change = changes.products[category.slug]
    if (!change) return category
    return {
      ...category,
      name: change.name ?? category.name,
      tagline: change.description ?? category.tagline,
      ...(change.image !== undefined ? { photo: change.image } : {}),
    }
  })

  /* Complementos */
  const toppings: Topping[] = []
  for (const topping of base.toppings) {
    const change = changes.toppings[topping.id]
    if (!change) toppings.push(topping)
    else if (!change.deleted) toppings.push(changeTopping(topping, change))
  }
  const knownToppings = new Set(base.toppings.map((topping) => topping.id))
  for (const [id, change] of Object.entries(changes.toppings)) {
    const name = change.name?.trim()
    if (knownToppings.has(id) || !change.created || change.deleted || !name || !change.group) continue
    toppings.push(changeTopping({ id, group: change.group, name, priceCents: change.priceCents ?? 0 }, { ...change, name }))
  }

  /* Seções renomeadas e o título do grupo "Monte do seu jeito" */
  const sections = changes.sections ?? {}
  const drawers = base.drawers.map((drawer): Drawer => {
    const change = sections[drawer.id]
    if (!change) return drawer
    const name = change.name?.trim()
    return {
      ...drawer,
      ...(name ? { title: name, navLabel: name, pillLabel: name } : {}),
      ...(change.subtitle !== undefined ? { subtitle: change.subtitle } : {}),
    }
  })
  const monte = sections.monte?.name?.trim()
  const groupTitles = monte ? { ...base.groupTitles, monte } : base.groupTitles

  return { items, toppings, products: products as Record<ProductSlug, Product>, categories, drawers, groupTitles }
}

/* Leitura do que veio guardado ou da rede: só campos válidos. */

const GROUP_IDS: readonly ToppingGroupId[] = ['dry', 'fruit', 'syrup', 'paid', 'batido']
const DRAWER_IDS = new Set<string>(BASE_DRAWERS.map((drawer) => drawer.id))
const SECTION_IDS = new Set<string>([...DRAWER_IDS, 'monte'])
const CATEGORY_SLUGS = new Set<string>(['acai-oca', 'acai-tradicional', 'acai-batido', 'milk-shake'] satisfies CategorySlug[])

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const isCents = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 10_000_000
const text = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : undefined)

function parseItem(raw: Record<string, unknown>): ItemChange {
  const change: ItemChange = {}
  const name = text(raw.name, 80)
  if (name) change.name = name
  const description = text(raw.description, 300)
  if (description !== undefined) change.description = description
  if (isCents(raw.priceCents)) change.priceCents = raw.priceCents
  if (raw.originalPriceCents === null || isCents(raw.originalPriceCents)) change.originalPriceCents = raw.originalPriceCents as number | null
  const image = text(raw.image, 2000)
  if (image) change.image = image
  if (Array.isArray(raw.flavors)) {
    change.flavors = raw.flavors.flatMap((flavor) => {
      const value = text(flavor, 60)
      return value ? [value] : []
    })
  }
  if (Array.isArray(raw.sizes)) {
    change.sizes = raw.sizes
      .flatMap((entry) => {
        if (!isRecord(entry)) return []
        const sizeName = text(entry.name, 40)
        return sizeName && isCents(entry.priceCents) ? [{ name: sizeName, priceCents: entry.priceCents }] : []
      })
      .slice(0, 12)
  }
  if (typeof raw.available === 'boolean') change.available = raw.available
  if (typeof raw.drawer === 'string' && DRAWER_IDS.has(raw.drawer)) change.drawer = raw.drawer as DrawerId
  if (raw.deleted === true) change.deleted = true
  if (raw.created === true) change.created = true
  return change
}

function parseProduct(raw: Record<string, unknown>): ProductChange {
  const change: ProductChange = {}
  const name = text(raw.name, 80)
  if (name) change.name = name
  const description = text(raw.description, 300)
  if (description !== undefined) change.description = description
  const image = text(raw.image, 2000)
  if (image) change.image = image
  if (isRecord(raw.sizePrices)) {
    const prices = Object.fromEntries(Object.entries(raw.sizePrices).filter(([, price]) => isCents(price)))
    if (Object.keys(prices).length > 0) change.sizePrices = prices as Record<string, number>
  }
  if (Array.isArray(raw.sizes)) {
    const sizes = raw.sizes
      .flatMap((entry): ProductSizeEntry[] => {
        if (!isRecord(entry)) return []
        const sizeName = text(entry.name, 40)
        if (!sizeName || !isCents(entry.priceCents)) return []
        const free = Number.isInteger(entry.freeToppings) ? Math.min(20, Math.max(0, entry.freeToppings as number)) : 0
        const id = text(entry.id, 40)
        return [{ ...(id ? { id } : {}), name: sizeName, priceCents: entry.priceCents, freeToppings: free }]
      })
      .slice(0, 16)
    if (sizes.length > 0) change.sizes = sizes
  }
  return change
}

function parseSectionChange(raw: Record<string, unknown>): SectionChange {
  const change: SectionChange = {}
  const name = text(raw.name, 60)
  if (name) change.name = name
  const subtitle = text(raw.subtitle, 160)
  if (subtitle !== undefined) change.subtitle = subtitle
  return change
}

function parseTopping(raw: Record<string, unknown>): ToppingChange {
  const change: ToppingChange = {}
  const name = text(raw.name, 60)
  if (name) change.name = name
  if (isCents(raw.priceCents)) change.priceCents = raw.priceCents
  const image = text(raw.image, 2000)
  if (image) change.image = image
  if (typeof raw.available === 'boolean') change.available = raw.available
  if (raw.deleted === true) change.deleted = true
  if (typeof raw.group === 'string' && GROUP_IDS.includes(raw.group as ToppingGroupId)) change.group = raw.group as ToppingGroupId
  if (raw.created === true) change.created = true
  return change
}

function parseSection<T extends object>(
  raw: unknown,
  parse: (entry: Record<string, unknown>) => T,
  accept: (id: string) => boolean = () => true,
): Record<string, T> {
  if (!isRecord(raw)) return {}
  const result: Record<string, T> = {}
  for (const [id, entry] of Object.entries(raw)) {
    if (!id || id.length > 80 || !accept(id) || !isRecord(entry)) continue
    const change = parse(entry)
    if (Object.keys(change).length > 0) result[id] = change
  }
  return result
}

/** As mudanças guardadas no aparelho ou lidas do Supabase, só com campos válidos. */
export function parseChanges(raw: unknown): CatalogChanges {
  if (!isRecord(raw)) return NO_CHANGES
  return {
    items: parseSection(raw.items, parseItem),
    products: parseSection(raw.products, parseProduct, (slug) => CATEGORY_SLUGS.has(slug)),
    toppings: parseSection(raw.toppings, parseTopping),
    sections: parseSection(raw.sections, parseSectionChange, (id) => SECTION_IDS.has(id)),
  }
}
