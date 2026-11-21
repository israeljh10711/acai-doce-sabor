/**
 * Registros do cardápio no banco (cardápio dinâmico, 2026-11-21): uma linha por categoria,
 * produto, tamanho, escolha, opção de escolha, grupo de complementos, complemento, grupo de cada
 * produto e oferta. São a fonte do cardápio quando o Supabase está configurado; no modo de
 * demonstração, os mesmos registros ficam no aparelho.
 *
 * Este arquivo só tem os tipos, os limites e a leitura do que vem do banco (`catalogo_publico()`,
 * com nomes em snake_case). A conversão para o cardápio da tela está em `recordsAdapter.ts`; a
 * semente tirada do cardápio do código, em `baseRecords.ts`.
 */

export type CategoryLayout = 'vitrine' | 'grade'

/** Tipo do produto: montável (personalizador), com sabores ou variações, ou direto. */
export type ProductKind = 'montavel' | 'variacoes' | 'direto'

/**
 * Como os complementos de um grupo entram no pedido:
 * - `limited`: contam no limite grátis do tamanho (vários do mesmo, até 10);
 * - `included`: um de cada;
 * - `paid`: cobrados por unidade, até 10 de cada.
 */
export type GroupRule = 'limited' | 'included' | 'paid'

export type OfferStatus = 'ativa' | 'pausada' | 'arquivada'

export type CategoryRecord = {
  id: string
  name: string
  subtitle: string
  icon: string
  layout: CategoryLayout
  navLabel: string
  pillLabel: string
  anchor: string
  keywords: readonly string[]
  position: number
  visible: boolean
  archivedAt: string | null
}

/** Textos e ajustes do produto que não precisam de coluna própria. */
export type ProductDetails = {
  /** Vitrine: resumo, frase e selos do cartão. */
  summary?: string
  tagline?: string
  badges?: readonly string[]
  /** Texto do botão que abre o personalizador ("Montar açaí Oca", "Montar pote"). */
  actionLabel?: string
  /** Nome da escolha obrigatória quando não é "Sabor" (a barca: "Cobertura"). */
  flavorTerm?: { label: string; missing: string }
  flavorHint?: string
  flavorNotice?: string
}

export type ProductRecord = {
  id: string
  categoryId: string
  kind: ProductKind
  name: string
  description: string
  /** Foto: caminho em `public/` ou endereço do Storage. Vazio: a foto da loja pelo id, ou nenhuma. */
  image: string
  imageAlt: string
  /** Preço do produto sem tamanhos. Com tamanhos, vale o menor deles. */
  priceCents: number
  /** Preço anterior, mostrado riscado. */
  compareAtCents: number | null
  badge: string | null
  keywords: readonly string[]
  /** Botão "Completo" (só montável). */
  completo: boolean
  /** Os sabores são os complementos sem custo deste grupo (a barca: as caldas). */
  flavorsFrom: string | null
  details: ProductDetails
  position: number
  visible: boolean
  available: boolean
  archivedAt: string | null
}

export type VariantRecord = {
  productId: string
  id: string
  name: string
  /** Recipiente do tamanho do montável (pote, copo, isopor, barca); `null` nos outros. */
  container: string | null
  priceCents: number
  /** Adicionais grátis do tamanho (grupos `limited`). */
  freeCount: number
  available: boolean
  position: number
}

export type ChoiceRecord = {
  productId: string
  id: string
  label: string
  /** Aceita "Outro sabor", escrito pelo cliente. */
  allowOther: boolean
  /** Começo do texto alternativo das fotos das opções. */
  photoAlt: string | null
  position: number
}

export type ChoiceOptionRecord = {
  productId: string
  choiceId: string
  id: string
  name: string
  photo: string | null
  available: boolean
  position: number
}

export type GroupRecord = {
  id: string
  name: string
  rule: GroupRule
  /** Mínimo de unidades (obrigatório quando maior que zero). */
  minSelect: number
  /** Máximo de unidades no grupo; `null`: sem máximo (os `limited` seguem o limite do tamanho). */
  maxSelect: number | null
  /** Unidades grátis no grupo antes do preço extra; `null`: todas grátis. */
  freeCount: number | null
  /** Preço de cada unidade além das grátis. */
  extraPriceCents: number
  /** Entra no "Completo" (um de cada sem custo). */
  inCompleto: boolean
  available: boolean
  position: number
}

export type OptionRecord = {
  id: string
  groupId: string
  name: string
  priceCents: number
  image: string | null
  /** Foto de outro complemento, pelo id (os adicionais do batido usam as fotos de mesmo nome). */
  look: string | null
  /** Só este produto oferece o complemento. */
  productId: string | null
  /** Fica fora do "Completo" (o leite condensado). */
  noCompleto: boolean
  available: boolean
  position: number
  archivedAt: string | null
}

export type ProductGroupRecord = {
  productId: string
  groupId: string
  position: number
  /** Máximo do grupo só neste produto (a barca: 2 frutas). */
  maxSelect: number | null
}

export type OfferRecord = {
  id: string
  productId: string
  /** Tamanho em oferta; `null`: o produto todo. */
  variantId: string | null
  title: string
  /** Frase do aviso; `{preco}` e `{preco_antigo}` viram os preços. */
  subtitle: string
  badgeEmoji: string
  badgeText: string
  /** Preço promocional; `null`: só o aviso, sem mudar o preço. */
  promoPriceCents: number | null
  position: number
  status: OfferStatus
  startsAt: string | null
  endsAt: string | null
}

export type CatalogRecords = {
  revision: number
  categories: readonly CategoryRecord[]
  products: readonly ProductRecord[]
  variants: readonly VariantRecord[]
  choices: readonly ChoiceRecord[]
  choiceOptions: readonly ChoiceOptionRecord[]
  groups: readonly GroupRecord[]
  options: readonly OptionRecord[]
  productGroups: readonly ProductGroupRecord[]
  offers: readonly OfferRecord[]
}

/** Limites (os mesmos do banco). */
export const LIMITS = {
  idLength: 80,
  nameLength: 120,
  textLength: 600,
  maxPriceCents: 1_000_000,
  maxUnits: 50,
  keywords: 30,
} as const

export const ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/

export const PRODUCT_KINDS: readonly ProductKind[] = ['montavel', 'variacoes', 'direto']
export const GROUP_RULES: readonly GroupRule[] = ['limited', 'included', 'paid']
export const OFFER_STATUSES: readonly OfferStatus[] = ['ativa', 'pausada', 'arquivada']

/* ------------------------------------------------------------------------------------------ */
/* Leitura do banco                                                                            */
/* ------------------------------------------------------------------------------------------ */

export class CatalogRecordsError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CatalogRecordsError'
  }
}

type Row = Readonly<Record<string, unknown>>

const fail = (where: string, field: string): never => {
  throw new CatalogRecordsError(`Cardápio do banco com dado inválido: ${where}.${field}`)
}

const str = (row: Row, field: string, where: string): string => {
  const value = row[field]
  return typeof value === 'string' ? value : fail(where, field)
}
const optStr = (row: Row, field: string, where: string): string | null => {
  const value = row[field]
  if (value === null || value === undefined) return null
  return typeof value === 'string' ? value : fail(where, field)
}
const int = (row: Row, field: string, where: string): number => {
  const value = row[field]
  return Number.isSafeInteger(value) && (value as number) >= 0 ? (value as number) : fail(where, field)
}
const optInt = (row: Row, field: string, where: string): number | null => {
  const value = row[field]
  if (value === null || value === undefined) return null
  return Number.isSafeInteger(value) && (value as number) >= 0 ? (value as number) : fail(where, field)
}
const bool = (row: Row, field: string, where: string): boolean => {
  const value = row[field]
  return typeof value === 'boolean' ? value : fail(where, field)
}
const strings = (row: Row, field: string, where: string): string[] => {
  const value = row[field] ?? []
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string') ? [...value] : fail(where, field)
}
const oneOf = <T extends string>(row: Row, field: string, where: string, allowed: readonly T[]): T => {
  const value = row[field]
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fail(where, field)
}
const rows = (source: Row, field: string): Row[] => {
  const value = source[field] ?? []
  if (!Array.isArray(value) || !value.every((entry) => entry && typeof entry === 'object')) fail('catalogo', field)
  return value as Row[]
}

function details(row: Row, where: string): ProductDetails {
  const raw = row.details ?? {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fail(where, 'details')
  const source = raw as Row
  const out: { -readonly [K in keyof ProductDetails]: ProductDetails[K] } = {}
  for (const field of ['summary', 'tagline', 'actionLabel', 'flavorHint', 'flavorNotice'] as const) {
    const value = source[field]
    if (value === undefined || value === null) continue
    if (typeof value !== 'string') fail(where, `details.${field}`)
    out[field] = value as string
  }
  if (source.badges !== undefined && source.badges !== null) out.badges = strings(source, 'badges', `${where}.details`)
  const term = source.flavorTerm
  if (term !== undefined && term !== null) {
    if (typeof term !== 'object' || Array.isArray(term)) fail(where, 'details.flavorTerm')
    const entry = term as Row
    out.flavorTerm = { label: str(entry, 'label', `${where}.flavorTerm`), missing: str(entry, 'missing', `${where}.flavorTerm`) }
  }
  return out
}

/**
 * Lê o que `catalogo_publico()` devolve (nomes em snake_case) e confere cada campo. Dado fora do
 * formato lança `CatalogRecordsError`: o site mostra o erro em vez de um cardápio pela metade.
 */
export function parseCatalogRecords(raw: unknown): CatalogRecords {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new CatalogRecordsError('Cardápio do banco vazio ou fora do formato')
  const source = raw as Row
  const revision = source.revision ?? 0
  if (!Number.isSafeInteger(revision)) fail('catalogo', 'revision')
  return {
    revision: revision as number,
    categories: rows(source, 'categories').map((row) => ({
      id: str(row, 'id', 'categoria'),
      name: str(row, 'name', 'categoria'),
      subtitle: str(row, 'subtitle', 'categoria'),
      icon: str(row, 'icon', 'categoria'),
      layout: oneOf(row, 'layout', 'categoria', ['vitrine', 'grade'] as const),
      navLabel: str(row, 'nav_label', 'categoria'),
      pillLabel: str(row, 'pill_label', 'categoria'),
      anchor: str(row, 'anchor', 'categoria'),
      keywords: strings(row, 'keywords', 'categoria'),
      position: int(row, 'position', 'categoria'),
      visible: bool(row, 'visible', 'categoria'),
      archivedAt: optStr(row, 'archived_at', 'categoria'),
    })),
    products: rows(source, 'products').map((row) => ({
      id: str(row, 'id', 'produto'),
      categoryId: str(row, 'category_id', 'produto'),
      kind: oneOf(row, 'kind', 'produto', PRODUCT_KINDS),
      name: str(row, 'name', 'produto'),
      description: str(row, 'description', 'produto'),
      image: str(row, 'image', 'produto'),
      imageAlt: str(row, 'image_alt', 'produto'),
      priceCents: int(row, 'price_cents', 'produto'),
      compareAtCents: optInt(row, 'compare_at_cents', 'produto'),
      badge: optStr(row, 'badge', 'produto'),
      keywords: strings(row, 'keywords', 'produto'),
      completo: bool(row, 'completo', 'produto'),
      flavorsFrom: optStr(row, 'flavors_from', 'produto'),
      details: details(row, 'produto'),
      position: int(row, 'position', 'produto'),
      visible: bool(row, 'visible', 'produto'),
      available: bool(row, 'available', 'produto'),
      archivedAt: optStr(row, 'archived_at', 'produto'),
    })),
    variants: rows(source, 'variants').map((row) => ({
      productId: str(row, 'product_id', 'tamanho'),
      id: str(row, 'id', 'tamanho'),
      name: str(row, 'name', 'tamanho'),
      container: optStr(row, 'container', 'tamanho'),
      priceCents: int(row, 'price_cents', 'tamanho'),
      freeCount: int(row, 'free_count', 'tamanho'),
      available: bool(row, 'available', 'tamanho'),
      position: int(row, 'position', 'tamanho'),
    })),
    choices: rows(source, 'choices').map((row) => ({
      productId: str(row, 'product_id', 'escolha'),
      id: str(row, 'id', 'escolha'),
      label: str(row, 'label', 'escolha'),
      allowOther: bool(row, 'allow_other', 'escolha'),
      photoAlt: optStr(row, 'photo_alt', 'escolha'),
      position: int(row, 'position', 'escolha'),
    })),
    choiceOptions: rows(source, 'choice_options').map((row) => ({
      productId: str(row, 'product_id', 'opcao'),
      choiceId: str(row, 'choice_id', 'opcao'),
      id: str(row, 'id', 'opcao'),
      name: str(row, 'name', 'opcao'),
      photo: optStr(row, 'photo', 'opcao'),
      available: bool(row, 'available', 'opcao'),
      position: int(row, 'position', 'opcao'),
    })),
    groups: rows(source, 'groups').map((row) => ({
      id: str(row, 'id', 'grupo'),
      name: str(row, 'name', 'grupo'),
      rule: oneOf(row, 'rule', 'grupo', GROUP_RULES),
      minSelect: int(row, 'min_select', 'grupo'),
      maxSelect: optInt(row, 'max_select', 'grupo'),
      freeCount: optInt(row, 'free_count', 'grupo'),
      extraPriceCents: int(row, 'extra_price_cents', 'grupo'),
      inCompleto: bool(row, 'in_completo', 'grupo'),
      available: bool(row, 'available', 'grupo'),
      position: int(row, 'position', 'grupo'),
    })),
    options: rows(source, 'options').map((row) => ({
      id: str(row, 'id', 'complemento'),
      groupId: str(row, 'group_id', 'complemento'),
      name: str(row, 'name', 'complemento'),
      priceCents: int(row, 'price_cents', 'complemento'),
      image: optStr(row, 'image', 'complemento'),
      look: optStr(row, 'look', 'complemento'),
      productId: optStr(row, 'product_id', 'complemento'),
      noCompleto: bool(row, 'no_completo', 'complemento'),
      available: bool(row, 'available', 'complemento'),
      position: int(row, 'position', 'complemento'),
      archivedAt: optStr(row, 'archived_at', 'complemento'),
    })),
    productGroups: rows(source, 'product_groups').map((row) => ({
      productId: str(row, 'product_id', 'grupo_do_produto'),
      groupId: str(row, 'group_id', 'grupo_do_produto'),
      position: int(row, 'position', 'grupo_do_produto'),
      maxSelect: optInt(row, 'max_select', 'grupo_do_produto'),
    })),
    offers: rows(source, 'offers').map((row) => ({
      id: str(row, 'id', 'oferta'),
      productId: str(row, 'product_id', 'oferta'),
      variantId: optStr(row, 'variant_id', 'oferta'),
      title: str(row, 'title', 'oferta'),
      subtitle: str(row, 'subtitle', 'oferta'),
      badgeEmoji: str(row, 'badge_emoji', 'oferta'),
      badgeText: str(row, 'badge_text', 'oferta'),
      promoPriceCents: optInt(row, 'promo_price_cents', 'oferta'),
      position: int(row, 'position', 'oferta'),
      status: oneOf(row, 'status', 'oferta', OFFER_STATUSES),
      startsAt: optStr(row, 'starts_at', 'oferta'),
      endsAt: optStr(row, 'ends_at', 'oferta'),
    })),
  }
}

/* ------------------------------------------------------------------------------------------ */
/* Escrita: registros → linhas do banco (snake_case)                                           */
/* ------------------------------------------------------------------------------------------ */

const snake = (key: string) => key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)

/** Um registro com os nomes das colunas do banco. */
export function toRow(record: object): Record<string, unknown> {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [snake(key), value]))
}

/**
 * Tabela de cada lista dos registros e a chave primária, na ordem em que a semente insere (pais
 * antes dos filhos).
 */
export const RECORD_TABLES = [
  ['categories', 'catalog_categories', 'id'],
  ['groups', 'catalog_groups', 'id'],
  ['products', 'catalog_products', 'id'],
  ['variants', 'catalog_variants', 'product_id, id'],
  ['choices', 'catalog_choices', 'product_id, id'],
  ['choiceOptions', 'catalog_choice_options', 'product_id, choice_id, id'],
  ['options', 'catalog_options', 'id'],
  ['productGroups', 'catalog_product_groups', 'product_id, group_id'],
  ['offers', 'catalog_offers', 'id'],
] as const satisfies readonly (readonly [Exclude<keyof CatalogRecords, 'revision'>, string, string])[]

/** Em ordem: pela posição e, no empate, pelo id (a mesma ordem do banco). */
export function byPosition<T extends { position: number; id: string }>(list: readonly T[]): T[] {
  return [...list].sort((a, b) => a.position - b.position || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}
