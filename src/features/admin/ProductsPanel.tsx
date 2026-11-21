import { useState } from 'react'
import { formatBRL } from '../../utils/money.ts'
import { foldText } from '../../utils/text.ts'
import { type ProductDraft, draftOf, duplicateDraft, newDraft } from '../catalog/productDraft.ts'
import { type CatalogRecords, type ProductRecord, byPosition } from '../catalog/records.ts'
import { useWrite } from './adminData.ts'
import { inputClass, KIND_LABELS, moved, primaryButton, quietButton, thumbOf } from './adminKit.ts'
import { Chip, MoveButtons } from './adminUi.tsx'
import { ProductEditor } from './ProductEditor.tsx'

type Filter = 'todos' | 'ocultos' | 'esgotados'

/** Produtos: busca, filtro, ordem por categoria, editar, duplicar, esgotar e ocultar. */
export function ProductsPanel({ records }: { records: CatalogRecords }) {
  const [query, setQuery] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [filter, setFilter] = useState<Filter>('todos')
  const [editing, setEditing] = useState<{ draft: ProductDraft; isNew: boolean } | null>(null)
  const [save, run] = useWrite()
  const categories = byPosition(records.categories.filter((category) => category.archivedAt === null))
  const search = foldText(query.trim())
  const filtering = search !== '' || filter !== 'todos'

  const productsOf = (id: string) => byPosition(records.products.filter((product) => product.categoryId === id && product.archivedAt === null))
  const visible = (product: ProductRecord) =>
    (search === '' || foldText(product.name).includes(search)) &&
    (filter === 'todos' || (filter === 'ocultos' ? !product.visible : !product.available))
  const priceText = (product: ProductRecord) => {
    const sizes = records.variants.filter((variant) => variant.productId === product.id)
    return sizes.length > 0 ? `a partir de ${formatBRL(Math.min(...sizes.map((size) => size.priceCents)))}` : formatBRL(product.priceCents)
  }
  const firstGrade = categories.find((category) => category.layout === 'grade')?.id ?? categories[0]?.id ?? ''

  return (
    <section aria-labelledby="titulo-produtos" data-admin-products>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="titulo-produtos" className="font-display text-2xl font-black text-acai-800">
          Produtos
        </h2>
        <button type="button" data-new-product onClick={() => setEditing({ draft: newDraft(records, 'direto', categoryId || firstGrade), isNew: true })} className={primaryButton}>
          + Novo produto
        </button>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="produtos-busca" className="sr-only">
            Buscar produto
          </label>
          <input id="produtos-busca" data-products-search type="search" value={query} placeholder="Buscar produto pelo nome" onChange={(event) => setQuery(event.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="produtos-categoria" className="sr-only">
            Categoria
          </label>
          <select id="produtos-categoria" value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className={inputClass}>
            <option value="">Todas as categorias</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="produtos-filtro" className="sr-only">
            Situação
          </label>
          <select id="produtos-filtro" value={filter} onChange={(event) => setFilter(event.target.value as Filter)} className={inputClass}>
            <option value="todos">Todos</option>
            <option value="ocultos">Só os ocultos</option>
            <option value="esgotados">Só os esgotados</option>
          </select>
        </div>
      </div>
      {save.state === 'error' && (
        <p role="alert" className="mt-3 rounded-xl bg-red-50 px-4 py-2 text-sm font-semibold text-red-800">
          {save.message}
        </p>
      )}
      {categories
        .filter((category) => categoryId === '' || category.id === categoryId)
        .map((category) => {
          const all = productsOf(category.id)
          const shown = all.filter(visible)
          if (filtering && shown.length === 0) return null
          return (
            <section key={category.id} aria-labelledby={`produtos-${category.id}`} className="mt-6" data-products-of={category.id}>
              <h3 id={`produtos-${category.id}`} className="font-display text-lg font-extrabold text-acai-800">
                {category.name} <span className="text-sm font-semibold text-ink-soft">({all.length})</span>
              </h3>
              {shown.length === 0 && <p className="mt-2 text-sm text-ink-soft">Nenhum produto nesta categoria.</p>}
              <ol className="mt-2 flex flex-col gap-2">
                {shown.map((product) => {
                  const index = all.indexOf(product)
                  const thumb = thumbOf(product.image)
                  return (
                    <li key={product.id} data-product={product.id} className="flex flex-col gap-3 rounded-2xl bg-white p-3 ring-1 ring-line lg:flex-row lg:items-center">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-acai-50 ring-1 ring-line">
                          {thumb ? <img src={thumb} alt="" className="size-full object-cover" loading="lazy" /> : <span className="text-xs font-bold text-ink-soft">sem foto</span>}
                        </span>
                        <div className="min-w-0">
                          <p className="font-bold break-words text-acai-900">{product.name}</p>
                          <p className="text-sm text-ink-soft">
                            {KIND_LABELS[product.kind].title} · {priceText(product)}
                          </p>
                          <p className="mt-1 flex flex-wrap gap-1">
                            {!product.visible && <Chip tone="warn">Oculto</Chip>}
                            {!product.available && <Chip tone="off">Esgotado</Chip>}
                            {product.completo && <Chip tone="info">Completo</Chip>}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {!filtering && (
                          <MoveButtons
                            label={product.name}
                            first={index === 0}
                            last={index === all.length - 1}
                            busy={save.state === 'saving'}
                            onMove={(step) => void run((writer) => writer.reorder('produtos', moved(all, index, step).map((entry) => entry.id)))}
                          />
                        )}
                        <button
                          type="button"
                          data-toggle-available
                          disabled={save.state === 'saving'}
                          onClick={() => void run((writer) => writer.patch('catalog_products', { id: product.id }, { available: !product.available }))}
                          className={quietButton}
                        >
                          {product.available ? 'Marcar esgotado' : 'Marcar disponível'}
                          <span className="sr-only">: {product.name}</span>
                        </button>
                        <button
                          type="button"
                          data-toggle-visible
                          disabled={save.state === 'saving'}
                          onClick={() => void run((writer) => writer.patch('catalog_products', { id: product.id }, { visible: !product.visible }))}
                          className={quietButton}
                        >
                          {product.visible ? 'Ocultar' : 'Mostrar'}
                          <span className="sr-only">: {product.name}</span>
                        </button>
                        <button type="button" data-duplicate-product onClick={() => setEditing({ draft: duplicateDraft(records, product.id)!, isNew: true })} className={quietButton}>
                          Duplicar produto<span className="sr-only">: {product.name}</span>
                        </button>
                        <button type="button" data-edit-product onClick={() => setEditing({ draft: draftOf(records, product.id)!, isNew: false })} className={quietButton}>
                          Editar<span className="sr-only">: {product.name}</span>
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ol>
            </section>
          )
        })}
      {editing && <ProductEditor key={editing.draft.product.id || 'novo'} draft={editing.draft} records={records} isNew={editing.isNew} onClose={() => setEditing(null)} />}
    </section>
  )
}
