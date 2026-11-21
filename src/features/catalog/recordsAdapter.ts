/**
 * Registros do banco → o cardápio que a tela e o servidor usam (cardápio dinâmico, 2026-11-21).
 *
 * O resultado tem o mesmo formato do cardápio do código (`CatalogData`), mais os grupos de
 * complementos e as ofertas valendo agora. Como site e servidor passam pela mesma conversão, o
 * preço é calculado pelas mesmas regras nos dois lados.
 *
 * - Ficam de fora: arquivados, ocultos (a não ser com `includeHidden`, para o vendedor) e produtos
 *   de categoria oculta ou arquivada.
 * - A categoria em vitrine vira os cartões de "Monte do seu jeito" (só produtos montáveis); as em
 *   grade viram as seções do cardápio.
 * - A oferta ativa (dentro das datas, pela hora `now`) com preço promocional troca o preço; vale a
 *   de menor posição (no empate, o menor id). O preço anterior aparece riscado.
 */
import type { Category, CategorySlug } from './categories.ts'
import type { CatalogData } from './catalogChanges.ts'
import type { ChoiceGroup, Drawer, DrawerId, EmblemIcon, ExtraAction, ExtraItem } from './extras.ts'
import {
  type ContainerKind,
  type ExtraProductSlug,
  type Flavor,
  type Product,
  type ProductSize,
  type ProductSlug,
  type Topping,
  type ToppingGroup,
  type ToppingGroupId,
  flavorsFromToppings,
} from './menu.ts'
import {
  type CatalogRecords,
  type ChoiceRecord,
  type GroupRecord,
  type OfferRecord,
  type ProductRecord,
  type VariantRecord,
  byPosition,
} from './records.ts'

/** Uma oferta valendo agora, com o preço de antes e o de agora (para o aviso). */
export type LiveOffer = OfferRecord & {
  /** Preço do produto (ou do tamanho) sem a oferta: o menor, quando há tamanhos. */
  regularCents: number
  /** Preço com a oferta (igual ao de antes quando ela não muda o preço). */
  priceCents: number
}

export type DynamicCatalog = CatalogData & {
  revision: number
  groups: Readonly<Record<string, ToppingGroup>>
  /** Ofertas valendo agora, na ordem do vendedor. */
  offers: readonly LiveOffer[]
}

export type AdapterOptions = {
  /** Hora em milissegundos (datas das ofertas). Padrão: agora. */
  now?: number
  /** Mostra também os ocultos (o vendedor vê tudo o que não foi arquivado). */
  includeHidden?: boolean
}

export type OfferState = 'ativa' | 'pausada' | 'agendada' | 'encerrada' | 'arquivada'

/** Situação da oferta na hora `now`. */
export function offerState(offer: OfferRecord, now: number): OfferState {
  if (offer.status !== 'ativa') return offer.status
  if (offer.startsAt && Date.parse(offer.startsAt) > now) return 'agendada'
  if (offer.endsAt && Date.parse(offer.endsAt) <= now) return 'encerrada'
  return 'ativa'
}

const live = (record: { archivedAt: string | null }) => record.archivedAt === null

/** Preço promocional de cada produto (`id/`) e tamanho (`id/tamanho`): a oferta de menor posição. */
function promotions(offers: readonly OfferRecord[], now: number): Map<string, OfferRecord> {
  const chosen = new Map<string, OfferRecord>()
  for (const offer of byPosition(offers)) {
    if (offer.promoPriceCents === null || offerState(offer, now) !== 'ativa') continue
    const key = `${offer.productId}/${offer.variantId ?? ''}`
    if (!chosen.has(key)) chosen.set(key, offer)
  }
  return chosen
}

type Priced = { regular: number; price: number }

/** Preço de um tamanho com a oferta (a do tamanho; sem ela, a do produto todo). */
function variantPrice(promos: Map<string, OfferRecord>, variant: VariantRecord): Priced {
  const offer = promos.get(`${variant.productId}/${variant.id}`) ?? promos.get(`${variant.productId}/`)
  const promo = offer?.promoPriceCents ?? null
  return { regular: variant.priceCents, price: promo !== null && promo < variant.priceCents ? promo : variant.priceCents }
}

function productPrice(promos: Map<string, OfferRecord>, product: ProductRecord): Priced {
  const promo = promos.get(`${product.id}/`)?.promoPriceCents ?? null
  return { regular: product.priceCents, price: promo !== null && promo < product.priceCents ? promo : product.priceCents }
}

function groupOf(record: GroupRecord): ToppingGroup {
  return {
    id: record.id as ToppingGroupId,
    name: record.name,
    rule: record.rule,
    ...(record.minSelect > 0 ? { minSelect: record.minSelect } : {}),
    ...(record.maxSelect !== null ? { maxSelect: record.maxSelect } : {}),
    ...(record.freeCount !== null ? { freeCount: record.freeCount } : {}),
    ...(record.extraPriceCents > 0 ? { extraPriceCents: record.extraPriceCents } : {}),
    ...(record.inCompleto ? { inCompleto: true as const } : {}),
    ...(record.available ? {} : { available: false }),
  }
}

function choiceGroupOf(choice: ChoiceRecord, records: CatalogRecords): ChoiceGroup {
  const options = byPosition(records.choiceOptions.filter((option) => option.productId === choice.productId && option.choiceId === choice.id))
  const photos = Object.fromEntries(options.filter((option) => option.photo).map((option) => [option.name, option.photo as string]))
  const unavailable = options.filter((option) => !option.available).map((option) => option.name)
  return {
    id: choice.id,
    label: choice.label,
    options: options.map((option) => option.name),
    ...(choice.allowOther ? { allowOther: true } : {}),
    ...(Object.keys(photos).length > 0 ? { photos } : {}),
    ...(choice.photoAlt !== null ? { photoAlt: choice.photoAlt } : {}),
    ...(unavailable.length > 0 ? { unavailable } : {}),
  }
}

/** Converte os registros do banco no cardápio da tela. Não altera os registros. */
export function recordsToCatalog(records: CatalogRecords, options: AdapterOptions = {}): DynamicCatalog {
  const now = options.now ?? Date.now()
  const shown = (record: { visible: boolean }) => options.includeHidden === true || record.visible
  const promos = promotions(records.offers, now)

  const categories = byPosition(records.categories.filter((category) => live(category) && shown(category)))
  const categoryRank = new Map(categories.map((category, index) => [category.id, index]))
  const products = byPosition(
    records.products.filter((product) => live(product) && shown(product) && categoryRank.has(product.categoryId)),
  ).sort((a, b) => (categoryRank.get(a.categoryId) ?? 0) - (categoryRank.get(b.categoryId) ?? 0))

  const groupRecords = byPosition(records.groups)
  const groupRank = new Map(groupRecords.map((group, index) => [group.id, index]))
  const groups: Record<string, ToppingGroup> = Object.fromEntries(groupRecords.map((group) => [group.id, groupOf(group)]))

  const toppings: Topping[] = byPosition(records.options.filter((option) => live(option) && groupRank.has(option.groupId)))
    .sort((a, b) => (groupRank.get(a.groupId) ?? 0) - (groupRank.get(b.groupId) ?? 0))
    .map((option) => ({
      id: option.id,
      name: option.name,
      group: option.groupId as ToppingGroupId,
      priceCents: option.priceCents,
      ...(option.look !== null ? { look: option.look } : {}),
      ...(option.productId !== null ? { onlyIn: [option.productId as ProductSlug] } : {}),
      ...(option.available ? {} : { available: false }),
      ...(option.image !== null ? { image: option.image } : {}),
      ...(option.noCompleto ? { noCompleto: true as const } : {}),
    }))

  const variantsOf = (productId: string) => byPosition(records.variants.filter((variant) => variant.productId === productId))
  const choicesOf = (productId: string) => byPosition(records.choices.filter((choice) => choice.productId === productId))

  /** Menor preço (com e sem oferta) de um produto com tamanhos; sem tamanhos, o do produto. */
  const fromPrice = (product: ProductRecord): Priced => {
    const variants = variantsOf(product.id)
    if (variants.length === 0) return productPrice(promos, product)
    const priced = variants.map((variant) => variantPrice(promos, variant))
    return { regular: Math.min(...priced.map((entry) => entry.regular)), price: Math.min(...priced.map((entry) => entry.price)) }
  }

  const montavel = (product: ProductRecord): Product => {
    const sizes: ProductSize[] = variantsOf(product.id).map((variant) => ({
      id: variant.id,
      name: variant.name,
      container: (variant.container ?? 'copo') as ContainerKind,
      priceCents: variantPrice(promos, variant).price,
      freeToppings: variant.freeCount,
      ...(variant.available ? {} : { available: false }),
    }))
    const links = byPosition(
      records.productGroups
        .filter((link) => link.productId === product.id && groupRank.has(link.groupId))
        .map((link) => ({ ...link, id: link.groupId })),
    )
    const limits = Object.fromEntries(links.filter((link) => link.maxSelect !== null).map((link) => [link.groupId, link.maxSelect as number]))
    const [choice] = choicesOf(product.id)
    const flavors: Flavor[] = product.flavorsFrom
      ? flavorsFromToppings(toppings, product.flavorsFrom as ToppingGroupId)
      : choice
        ? byPosition(records.choiceOptions.filter((option) => option.productId === product.id && option.choiceId === choice.id)).map(
            (option) => ({ id: option.id, name: option.name, ...(option.available ? {} : { available: false }) }),
          )
        : []
    const { details } = product
    return {
      slug: product.id as ProductSlug,
      name: product.name,
      sizes,
      groups: links.map((link) => link.groupId as ToppingGroupId),
      flavors,
      ...(details.flavorNotice ? { flavorNotice: details.flavorNotice } : {}),
      ...(details.flavorTerm ? { flavorTerm: details.flavorTerm } : {}),
      ...(details.flavorHint ? { flavorHint: details.flavorHint } : {}),
      ...(Object.keys(limits).length > 0 ? { groupLimits: limits } : {}),
      ...(product.completo ? { completo: true as const } : {}),
      ...(product.available ? {} : { available: false }),
      ...(product.flavorsFrom ? { flavorsFrom: product.flavorsFrom as ToppingGroupId } : {}),
    }
  }

  const productMap: Record<string, Product> = {}
  const mainCategories: Category[] = []
  const drawers: Drawer[] = []
  const items: ExtraItem[] = []
  const vitrine = categories.find((category) => category.layout === 'vitrine')

  for (const category of categories) {
    if (category.layout === 'grade') {
      drawers.push({
        id: category.id as DrawerId,
        title: category.name,
        navLabel: category.navLabel || category.name,
        pillLabel: category.pillLabel || category.name,
        subtitle: category.subtitle,
        anchor: category.anchor || `secao-${category.id}`,
        icon: category.icon as EmblemIcon,
        keywords: category.keywords,
      })
    }
  }

  for (const product of products) {
    const category = categories[categoryRank.get(product.categoryId) ?? 0]
    if (category.layout === 'vitrine') {
      // Só a primeira vitrine e só produtos montáveis (o salvar do banco não deixa outro tipo).
      if (category !== vitrine || product.kind !== 'montavel') continue
      productMap[product.id] = montavel(product)
      mainCategories.push({
        slug: product.id as CategorySlug,
        name: product.name,
        summary: product.details.summary ?? '',
        tagline: product.details.tagline ?? '',
        actionLabel: product.details.actionLabel ?? `Montar ${product.name}`,
        badges: (product.details.badges ?? []) as Category['badges'],
        keywords: product.keywords,
        ...(product.image ? { photo: product.image } : {}),
      })
      continue
    }
    const priced = fromPrice(product)
    let action: ExtraAction
    if (product.kind === 'montavel') {
      productMap[product.id] = montavel(product)
      action = { type: 'customizer', product: product.id as ExtraProductSlug, label: product.details.actionLabel ?? 'Montar' }
    } else if (product.kind === 'variacoes') {
      const variants = variantsOf(product.id)
      const sizes: ChoiceGroup[] =
        variants.length === 0
          ? []
          : [
              {
                id: 'tamanho',
                label: 'Tamanho',
                options: variants.map((variant) => variant.name),
                prices: Object.fromEntries(variants.map((variant) => [variant.name, variantPrice(promos, variant).price])),
                ...(variants.some((variant) => !variant.available)
                  ? { unavailable: variants.filter((variant) => !variant.available).map((variant) => variant.name) }
                  : {}),
              },
            ]
      const choices = [...sizes, ...choicesOf(product.id).map((choice) => choiceGroupOf(choice, records))]
      action = choices.length > 0 ? { type: 'flavor_modal', choices } : { type: 'direct_confirm' }
    } else {
      action = { type: 'direct_confirm' }
    }
    // Riscado: o preço antigo do vendedor; com oferta e sem ele, o preço de antes da oferta.
    const original = product.compareAtCents ?? (priced.price < priced.regular ? priced.regular : null)
    items.push({
      id: product.id,
      drawer: product.categoryId as DrawerId,
      name: product.name,
      description: product.description,
      priceCents: priced.price,
      ...(original !== null && original > priced.price ? { originalPriceCents: original } : {}),
      ...(product.badge ? { badge: product.badge } : {}),
      keywords: product.keywords,
      image: product.image,
      imageAlt: product.imageAlt,
      action,
      ...(product.available ? {} : { available: false }),
    })
  }

  const shownProducts = new Map(products.map((product) => [product.id, product]))
  const offers: LiveOffer[] = byPosition(records.offers).flatMap((offer) => {
    const product = shownProducts.get(offer.productId)
    if (!product || offerState(offer, now) !== 'ativa') return []
    const variants = variantsOf(product.id)
    const variant = offer.variantId === null ? undefined : variants.find((candidate) => candidate.id === offer.variantId)
    if (offer.variantId !== null && !variant) return []
    const priced = variant ? variantPrice(promos, variant) : fromPrice(product)
    return [{ ...offer, regularCents: priced.regular, priceCents: priced.price }]
  })

  return {
    revision: records.revision,
    items,
    toppings,
    products: productMap as Record<ProductSlug, Product>,
    categories: mainCategories,
    drawers,
    groupTitles: vitrine ? { monte: vitrine.name } : {},
    groups,
    offers,
  }
}
