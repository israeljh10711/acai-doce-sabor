/**
 * Um produto inteiro para editar (cardápio dinâmico, 2026-11-21): o produto, os tamanhos, as
 * escolhas com as opções e os grupos de complementos. O editor do vendedor trabalha nele; salvar
 * manda tudo de uma vez (no Supabase, `catalogo_salvar_produto()`, numa transação).
 */
import { slugOf, uniqueIds } from './baseRecords.ts'
import {
  type CatalogRecords,
  type ChoiceOptionRecord,
  type ChoiceRecord,
  type ProductGroupRecord,
  type ProductKind,
  type ProductRecord,
  type VariantRecord,
  byPosition,
  toRow,
} from './records.ts'

export type ChoiceDraft = ChoiceRecord & { options: ChoiceOptionRecord[] }

export type ProductDraft = {
  product: ProductRecord
  variants: VariantRecord[]
  choices: ChoiceDraft[]
  groups: ProductGroupRecord[]
}

/** O produto do banco como rascunho, com os filhos em ordem. */
export function draftOf(records: CatalogRecords, productId: string): ProductDraft | null {
  const product = records.products.find((candidate) => candidate.id === productId)
  if (!product) return null
  return {
    product,
    variants: byPosition(records.variants.filter((variant) => variant.productId === productId)),
    choices: byPosition(records.choices.filter((choice) => choice.productId === productId)).map((choice) => ({
      ...choice,
      options: byPosition(records.choiceOptions.filter((option) => option.productId === productId && option.choiceId === choice.id)),
    })),
    groups: [...records.productGroups.filter((link) => link.productId === productId)].sort((a, b) => a.position - b.position),
  }
}

/** Um id livre a partir do nome ("Açaí Zero" → "acai-zero", ou "acai-zero-2" se já existe). */
export function freeId(name: string, taken: ReadonlySet<string>): string {
  const base = (slugOf(name) || 'produto').slice(0, 70).replace(/-$/, '')
  let id = base
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`
  return id
}

/** Rascunho de um produto novo, do tipo escolhido, no fim da categoria. */
export function newDraft(records: CatalogRecords, kind: ProductKind, categoryId: string): ProductDraft {
  const position = records.products.filter((product) => product.categoryId === categoryId).reduce((max, product) => Math.max(max, product.position + 1), 0)
  return {
    product: {
      id: '',
      categoryId,
      kind,
      name: '',
      description: '',
      image: '',
      imageAlt: '',
      priceCents: 0,
      compareAtCents: null,
      badge: null,
      keywords: [],
      completo: false,
      flavorsFrom: null,
      details: {},
      position,
      visible: true,
      available: true,
      archivedAt: null,
    },
    variants: [],
    choices: [],
    groups: [],
  }
}

/** Cópia de um produto com id novo ("Duplicar produto"): nome com "(cópia)", fica oculta até revisar. */
export function duplicateDraft(records: CatalogRecords, productId: string): ProductDraft | null {
  const source = draftOf(records, productId)
  if (!source) return null
  const name = `${source.product.name} (cópia)`.slice(0, 120)
  const id = freeId(name, new Set(records.products.map((product) => product.id)))
  const siblings = records.products.filter((product) => product.categoryId === source.product.categoryId)
  return {
    product: { ...source.product, id, name, position: siblings.reduce((max, product) => Math.max(max, product.position + 1), 0), visible: false, archivedAt: null },
    variants: source.variants.map((variant) => ({ ...variant, productId: id })),
    choices: source.choices.map((choice) => ({ ...choice, productId: id, options: choice.options.map((option) => ({ ...option, productId: id })) })),
    groups: source.groups.map((link) => ({ ...link, productId: id })),
  }
}

/**
 * Dá ids e posições aos filhos (tamanhos e opções novos ganham id pelo nome) e liga tudo ao id
 * do produto. Chamado antes de validar e salvar.
 */
export function settleDraft(draft: ProductDraft, taken: ReadonlySet<string>): ProductDraft {
  const id = draft.product.id || freeId(draft.product.name, taken)
  const keep = (list: { id: string; name: string }[]) => {
    const fresh = uniqueIds(list.map((entry) => entry.name))
    const used = new Set(list.map((entry) => entry.id).filter(Boolean))
    return list.map((entry, index) => {
      if (entry.id) return entry.id
      let candidate = fresh[index] || 'item'
      for (let n = 2; used.has(candidate); n++) candidate = `${fresh[index] || 'item'}-${n}`
      used.add(candidate)
      return candidate
    })
  }
  const variantIds = keep(draft.variants)
  const choiceIds = keep(draft.choices.map((choice) => ({ id: choice.id, name: choice.label }))).map((choiceId) => (choiceId === 'tamanho' ? 'tamanho-2' : choiceId))
  return {
    product: { ...draft.product, id, name: draft.product.name.trim() },
    variants: draft.variants.map((variant, position) => ({ ...variant, productId: id, id: variantIds[position], name: variant.name.trim(), position })),
    choices: draft.choices.map((choice, position) => {
      const optionIds = keep(choice.options)
      return {
        ...choice,
        productId: id,
        id: choiceIds[position],
        label: choice.label.trim(),
        position,
        options: choice.options.map((option, index) => ({ ...option, productId: id, choiceId: choiceIds[position], id: optionIds[index], name: option.name.trim(), position: index })),
      }
    }),
    groups: draft.groups.map((link, position) => ({ ...link, productId: id, position })),
  }
}

/** O rascunho no formato de `catalogo_salvar_produto(produto jsonb)`. */
export function productPayload(draft: ProductDraft): Record<string, unknown> {
  const { archivedAt: _archived, ...product } = draft.product
  void _archived
  return {
    ...toRow(product),
    variants: draft.variants.map(({ productId: _p, position: _n, ...variant }) => (void _p, void _n, toRow(variant))),
    choices: draft.choices.map(({ productId: _p, position: _n, options, ...choice }) => {
      void _p
      void _n
      return { ...toRow(choice), options: options.map(({ productId: _a, choiceId: _b, position: _c, ...option }) => (void _a, void _b, void _c, toRow(option))) }
    }),
    groups: draft.groups.map((link) => ({ group_id: link.groupId, max_select: link.maxSelect })),
  }
}

/** Os registros com o produto do rascunho no lugar (o que o banco faz ao salvar). */
export function applyDraft(records: CatalogRecords, draft: ProductDraft): CatalogRecords {
  const id = draft.product.id
  const others = <T extends { productId: string }>(list: readonly T[]) => list.filter((entry) => entry.productId !== id)
  const existing = records.products.find((product) => product.id === id)
  return {
    ...records,
    revision: records.revision + 1,
    products: existing
      ? records.products.map((product) => (product.id === id ? { ...draft.product, archivedAt: product.archivedAt } : product))
      : [...records.products, draft.product],
    variants: [...others(records.variants), ...draft.variants],
    choices: [...others(records.choices), ...draft.choices.map(({ options: _options, ...choice }) => (void _options, choice))],
    choiceOptions: [...others(records.choiceOptions), ...draft.choices.flatMap((choice) => choice.options)],
    productGroups: [...others(records.productGroups), ...draft.groups],
  }
}
