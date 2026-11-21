/**
 * Gravação do cardápio pelo vendedor (cardápio dinâmico, 2026-11-21):
 * - **Supabase**: produto inteiro por `catalogo_salvar_produto()` (uma transação); categoria,
 *   grupo, complemento e oferta por linha (upsert pela chave); disponível, visível e arquivado por
 *   PATCH; ordem por `catalogo_ordenar()`. O RLS só deixa o vendedor; o banco confere tudo.
 * - **Local** (modo de demonstração): as mesmas operações nos registros do aparelho, com as mesmas
 *   regras (`catalogValidation.ts` e as guardas do banco).
 *
 * Nada aqui apaga produto, categoria ou complemento: "Excluir" é arquivar.
 */
import { type Problem, validateCategory, validateGroup, validateOffer, validateOption, validateProduct } from '../features/catalog/catalogValidation.ts'
import { type ProductDraft, applyDraft, productPayload } from '../features/catalog/productDraft.ts'
import { type CatalogRecords, type CategoryRecord, type GroupRecord, type OfferRecord, type OptionRecord, toRow } from '../features/catalog/records.ts'
import { CatalogWriteError } from './supabaseRest.ts'

export type PatchTable =
  | 'catalog_categories'
  | 'catalog_products'
  | 'catalog_variants'
  | 'catalog_choice_options'
  | 'catalog_groups'
  | 'catalog_options'
  | 'catalog_offers'

export type OrderList = 'categorias' | 'produtos' | 'grupos' | 'complementos' | 'ofertas'

export type CatalogWriter = {
  readonly kind: 'supabase' | 'local'
  saveProduct(draft: ProductDraft): Promise<void>
  saveCategory(record: CategoryRecord): Promise<void>
  saveGroup(record: GroupRecord): Promise<void>
  saveOption(record: OptionRecord): Promise<void>
  saveOffer(record: OfferRecord): Promise<void>
  /** Muda campos (nomes do código: `available`, `visible`, `archivedAt`...) de uma linha. */
  patch(table: PatchTable, key: Readonly<Record<string, string>>, fields: Readonly<Record<string, unknown>>): Promise<void>
  /** A ordem de uma lista: a posição de cada id é a ordem em que vem. */
  reorder(list: OrderList, ids: readonly string[]): Promise<void>
}

/** Erro do modo de demonstração, com os avisos das regras. */
export class LocalWriteError extends Error {
  readonly problems: readonly Problem[]
  constructor(problems: readonly Problem[]) {
    super(problems[0]?.message ?? 'Não foi possível salvar.')
    this.name = 'LocalWriteError'
    this.problems = problems
  }
}

/** O aviso para o vendedor, em português, a partir de qualquer erro de gravação. */
export function writeErrorText(error: unknown): string {
  if (error instanceof LocalWriteError) return error.message
  if (error instanceof CatalogWriteError) {
    if (error.code === 'P0001' && error.detail) return error.detail
    if (error.code === '42501' || error.status === 401 || error.status === 403) return 'Sua sessão de vendedor acabou. Entre de novo e tente outra vez.'
    if (error.code === '23505') return 'Já existe um item com esse nome. Use outro nome.'
    if (error.code === '23503') return 'Esse item está em uso por outro (produto, complemento ou oferta). Mude o outro antes.'
    if (error.code === '23514' || error.code === '22P02' || error.code === '22023') return 'Algum campo está fora do permitido. Confira os valores e tente de novo.'
    if (error.code === 'PGRST116') return error.detail
  }
  return 'Não foi possível salvar. Tente novamente.'
}

type Rest = {
  rpc(name: string, args: Record<string, unknown>): Promise<unknown>
  upsertRow(table: string, row: Record<string, unknown>, conflict: string): Promise<void>
  patchRow(table: string, key: Readonly<Record<string, string>>, fields: Record<string, unknown>): Promise<void>
}

const row = (record: object) => toRow(record)

export function createSupabaseWriter(rest: Rest): CatalogWriter {
  return {
    kind: 'supabase',
    async saveProduct(draft) {
      await rest.rpc('catalogo_salvar_produto', { produto: productPayload(draft) })
    },
    saveCategory: (record) => rest.upsertRow('catalog_categories', row(record), 'id'),
    saveGroup: (record) => rest.upsertRow('catalog_groups', row(record), 'id'),
    saveOption: (record) => rest.upsertRow('catalog_options', row(record), 'id'),
    saveOffer: (record) => rest.upsertRow('catalog_offers', row(record), 'id'),
    patch: (table, key, fields) => rest.patchRow(table, key, toRow(fields)),
    async reorder(list, ids) {
      await rest.rpc('catalogo_ordenar', { lista: list, ids: [...ids] })
    },
  }
}

export type LocalWriterDeps = {
  load(): CatalogRecords
  save(records: CatalogRecords): void
  now(): string
}

const LIST_FIELD = {
  catalog_categories: 'categories',
  catalog_products: 'products',
  catalog_variants: 'variants',
  catalog_choice_options: 'choiceOptions',
  catalog_groups: 'groups',
  catalog_options: 'options',
  catalog_offers: 'offers',
} as const satisfies Record<PatchTable, keyof CatalogRecords>

const ORDER_FIELD = {
  categorias: 'categories',
  produtos: 'products',
  grupos: 'groups',
  complementos: 'options',
  ofertas: 'offers',
} as const satisfies Record<OrderList, keyof CatalogRecords>

const camel = (key: string) => key.replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase())

export function createLocalWriter(deps: LocalWriterDeps): CatalogWriter {
  const commit = (records: CatalogRecords, problems: readonly Problem[]) => {
    if (problems.length > 0) throw new LocalWriteError(problems)
    deps.save(records)
  }
  const upsert = <K extends 'categories' | 'groups' | 'options' | 'offers'>(field: K, record: CatalogRecords[K][number], check: (records: CatalogRecords) => Problem[]) => {
    const records = deps.load()
    const list = records[field] as readonly { id: string }[]
    const exists = list.some((entry) => entry.id === record.id)
    const next = { ...records, revision: records.revision + 1, [field]: exists ? list.map((entry) => (entry.id === record.id ? record : entry)) : [...list, record] }
    commit(next, check(next))
  }
  return {
    kind: 'local',
    async saveProduct(draft) {
      const records = deps.load()
      commit(applyDraft(records, draft), validateProduct(draft, records))
    },
    async saveCategory(record) {
      upsert('categories', record, (next) => validateCategory(record, next))
    },
    async saveGroup(record) {
      upsert('groups', record, () => validateGroup(record))
    },
    async saveOption(record) {
      upsert('options', record, (next) => validateOption(record, next))
    },
    async saveOffer(record) {
      upsert('offers', record, (next) => validateOffer(record, next))
    },
    async patch(table, key, fields) {
      const records = deps.load()
      const field = LIST_FIELD[table]
      const matches = (entry: Record<string, unknown>) => Object.entries(key).every(([column, value]) => entry[camel(column)] === value)
      const list = records[field] as readonly Record<string, unknown>[]
      if (!list.some(matches)) throw new LocalWriteError([{ field: 'id', message: 'Nada mudou: o item não existe mais.' }])
      const changes = Object.fromEntries(Object.entries(fields).map(([column, value]) => [camel(column), value]))
      const next = { ...records, revision: records.revision + 1, [field]: list.map((entry) => (matches(entry) ? { ...entry, ...changes } : entry)) }
      const problems: Problem[] = []
      if (table === 'catalog_categories') {
        const category = (next.categories as CategoryRecord[]).find((entry) => entry.id === key.id)
        if (category) problems.push(...validateCategory(category, next as CatalogRecords))
      }
      commit(next as CatalogRecords, problems)
    },
    async reorder(list, ids) {
      const records = deps.load()
      const field = ORDER_FIELD[list]
      const rank = new Map(ids.map((id, index) => [id, index]))
      const next = {
        ...records,
        revision: records.revision + 1,
        [field]: (records[field] as readonly { id: string; position: number }[]).map((entry) => (rank.has(entry.id) ? { ...entry, position: rank.get(entry.id)! } : entry)),
      }
      commit(next as CatalogRecords, [])
    },
  }
}

export { CatalogWriteError }
export const nowIso = () => new Date().toISOString()
