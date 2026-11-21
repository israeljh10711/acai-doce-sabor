/**
 * Os botões "Editar", "+ Adicionar" e "Duplicar" da loja no Modo Vendedor (cardápio dinâmico,
 * 2026-11-21): abrem os mesmos editores do painel, que gravam no banco. Carregado só quando o
 * vendedor abre um.
 */
import { getCatalogRecords, useCatalogVersion } from '../catalog/catalogStore.ts'
import { draftOf, duplicateDraft, newDraft } from '../catalog/productDraft.ts'
import type { EditTarget } from '../seller/sellerModeContext.ts'
import { CategoryEditor } from './CategoriesPanel.tsx'
import { blankOption } from './adminKit.ts'
import { OptionEditor } from './ComplementsPanel.tsx'
import { ProductEditor } from './ProductEditor.tsx'

export function StorefrontEditor({ target, onClose }: { target: EditTarget; onClose: () => void }) {
  useCatalogVersion()
  const records = getCatalogRecords()
  if (!records) return null

  if (target.kind === 'item' || target.kind === 'product') {
    const copyOf = target.kind === 'item' ? target.copyOf : undefined
    const draft = copyOf
      ? duplicateDraft(records, copyOf)
      : target.id
        ? draftOf(records, target.id)
        : newDraft(records, 'direto', (target.kind === 'item' && target.drawer) || records.categories.find((category) => category.layout === 'grade')?.id || '')
    if (!draft) return null
    return <ProductEditor key={draft.product.id || 'novo'} draft={draft} records={records} isNew={copyOf !== undefined || !target.id} onClose={onClose} />
  }
  if (target.kind === 'topping') {
    const option = target.id ? records.options.find((entry) => entry.id === target.id) : blankOption(records, target.group ?? records.groups[0]?.id ?? '')
    if (!option) return null
    return <OptionEditor key={option.id || 'novo'} option={option} records={records} onClose={onClose} />
  }
  // Seção: "monte" é o título da vitrine.
  const category = target.id === 'monte' ? records.categories.find((entry) => entry.layout === 'vitrine' && entry.archivedAt === null) : records.categories.find((entry) => entry.id === target.id)
  if (!category) return null
  const count = records.products.filter((product) => product.categoryId === category.id && product.archivedAt === null).length
  return <CategoryEditor key={category.id} category={category} records={records} productCount={count} onClose={onClose} />
}
