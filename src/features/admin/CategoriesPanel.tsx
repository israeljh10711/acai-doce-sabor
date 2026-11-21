import { useState } from 'react'
import type { EmblemIcon } from '../catalog/extras.ts'
import { SectionIcon } from '../catalog/SectionIcon.tsx'
import { freeId } from '../catalog/productDraft.ts'
import { type Problem, validateCategory } from '../catalog/catalogValidation.ts'
import { type CatalogRecords, type CategoryRecord, byPosition } from '../catalog/records.ts'
import { SellerDialog } from '../seller/SellerDialog.tsx'
import { nowIso } from '../../services/catalogWriter.ts'
import { useWrite } from './adminData.ts'
import { ICONS, dangerButton, describe, inputClass, moved, parseWords, primaryButton, quietButton } from './adminKit.ts'
import { Chip, Field, MoveButtons, SaveBar, Switch } from './adminUi.tsx'

/** Categorias: nome, subtítulo, ícone, visível, ordem e arquivar (só sem produtos). */
export function CategoriesPanel({ records }: { records: CatalogRecords }) {
  const categories = byPosition(records.categories.filter((category) => category.archivedAt === null))
  const [editing, setEditing] = useState<CategoryRecord | null>(null)
  const [save, run] = useWrite()
  const count = (id: string) => records.products.filter((product) => product.categoryId === id && product.archivedAt === null).length

  const move = (index: number, step: -1 | 1) => void run((writer) => writer.reorder('categorias', moved(categories, index, step).map((category) => category.id)))

  return (
    <section aria-labelledby="titulo-categorias" data-admin-categories>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="titulo-categorias" className="font-display text-2xl font-black text-acai-800">
          Categorias
        </h2>
        <button
          type="button"
          data-new-category
          onClick={() =>
            setEditing({
              id: '',
              name: '',
              subtitle: '',
              icon: 'gift',
              layout: 'grade',
              navLabel: '',
              pillLabel: '',
              anchor: '',
              keywords: [],
              position: categories.length,
              visible: true,
              archivedAt: null,
            })
          }
          className={primaryButton}
        >
          + Nova categoria
        </button>
      </div>
      <p className="mt-1 text-sm text-ink-soft">A ordem aqui é a ordem do cardápio. "Monte do seu jeito" é a vitrine dos produtos montáveis.</p>
      {save.state === 'error' && (
        <p role="alert" className="mt-3 rounded-xl bg-red-50 px-4 py-2 text-sm font-semibold text-red-800">
          {save.message}
        </p>
      )}
      <ol className="mt-4 flex flex-col gap-2">
        {categories.map((category, index) => (
          <li key={category.id} data-category={category.id} className="flex flex-col gap-3 rounded-2xl bg-white p-4 ring-1 ring-line sm:flex-row sm:items-center">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-acai-50 text-acai-800">
              <SectionIcon icon={category.icon as EmblemIcon} className="size-6" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-acai-900">
                {category.name} {category.layout === 'vitrine' && <Chip tone="info">Vitrine</Chip>} {!category.visible && <Chip tone="warn">Oculta</Chip>}
              </p>
              <p className="truncate text-sm text-ink-soft">
                {count(category.id)} produtos{category.subtitle ? ` · ${category.subtitle}` : ''}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <MoveButtons label={category.name} first={index === 0} last={index === categories.length - 1} busy={save.state === 'saving'} onMove={(step) => move(index, step)} />
              <button type="button" data-edit-category onClick={() => setEditing(category)} className={quietButton}>
                Editar<span className="sr-only">: {category.name}</span>
              </button>
            </div>
          </li>
        ))}
      </ol>
      {editing && <CategoryEditor key={editing.id || 'nova'} category={editing} records={records} productCount={editing.id ? count(editing.id) : 0} onClose={() => setEditing(null)} />}
    </section>
  )
}

/** A janela de uma categoria (nova ou existente). */
export function CategoryEditor({ category, records, productCount, onClose }: { category: CategoryRecord; records: CatalogRecords; productCount: number; onClose: () => void }) {
  const [draft, setDraft] = useState(category)
  const [base, setBase] = useState(category)
  const [problems, setProblems] = useState<Problem[]>([])
  const [save, run, setSave] = useWrite()
  const isNew = category.id === ''
  const dirty = JSON.stringify(draft) !== JSON.stringify(base)
  const error = (field: string) => problems.find((problem) => problem.field === field)?.message ?? null
  const set = (patch: Partial<CategoryRecord>) => {
    setDraft((current) => ({ ...current, ...patch }))
    if (save.state === 'saved') setSave({ state: 'idle' })
  }

  const submit = async () => {
    const record = { ...draft, id: draft.id || freeId(draft.name, new Set(records.categories.map((entry) => entry.id))), name: draft.name.trim() }
    const found = validateCategory(record, records)
    setProblems(found)
    if (found.length > 0) {
      setSave({ state: 'error', message: found[0].message })
      return
    }
    if (await run((writer) => writer.saveCategory(record))) {
      setDraft(record)
      setBase(record)
      if (isNew) onClose()
    }
  }

  const archive = async () => {
    if (await run((writer) => writer.patch('catalog_categories', { id: category.id }, { archivedAt: nowIso() }))) onClose()
  }

  return (
    <SellerDialog title={isNew ? 'Nova categoria' : `Editar: ${category.name}`} titleId="titulo-editar-categoria" onClose={onClose} wide>
      <div className="flex flex-col gap-4" data-category-editor>
        <Field id="categoria-nome" label="Nome" error={error('name')}>
          <input id="categoria-nome" value={draft.name} maxLength={120} onChange={(event) => set({ name: event.target.value })} className={inputClass} {...describe('categoria-nome', undefined, error('name'))} />
        </Field>
        <Field id="categoria-subtitulo" label="Subtítulo" hint="A frase abaixo do título da seção." error={error('subtitle')}>
          <input id="categoria-subtitulo" value={draft.subtitle} maxLength={600} onChange={(event) => set({ subtitle: event.target.value })} className={inputClass} />
        </Field>
        {draft.layout === 'grade' && (
          <>
            <Field id="categoria-icone" label="Ícone">
              <select id="categoria-icone" value={draft.icon} onChange={(event) => set({ icon: event.target.value })} className={inputClass}>
                {ICONS.map((icon) => (
                  <option key={icon.id} value={icon.id}>
                    {icon.label}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="categoria-menu" label="Nome no menu" hint="Vazio: o nome.">
                <input id="categoria-menu" value={draft.navLabel} maxLength={120} onChange={(event) => set({ navLabel: event.target.value })} className={inputClass} />
              </Field>
              <Field id="categoria-curto" label="Nome curto" hint="Nos botões da barra do celular.">
                <input id="categoria-curto" value={draft.pillLabel} maxLength={120} onChange={(event) => set({ pillLabel: event.target.value })} className={inputClass} />
              </Field>
            </div>
            <Field id="categoria-busca" label="Palavras de busca" hint="Separadas por vírgula. Acham todos os itens da categoria.">
              <input id="categoria-busca" defaultValue={draft.keywords.join(', ')} onChange={(event) => set({ keywords: parseWords(event.target.value) })} className={inputClass} />
            </Field>
          </>
        )}
        <Switch checked={draft.visible} onChange={(visible) => set({ visible })} label="Visível na loja" description="Desligada, a categoria e os produtos dela saem da loja (nada é apagado)." />
        {!isNew && draft.layout === 'grade' && (
          <div className="rounded-2xl bg-acai-50 p-4 ring-1 ring-line">
            <p className="text-sm font-bold text-acai-900">Arquivar categoria</p>
            <p className="mt-1 text-sm text-ink-soft">
              {productCount > 0 ? `Tem ${productCount} produtos. Mova ou arquive os produtos antes de arquivar a categoria.` : 'Sai das listas e da loja. Pedidos antigos continuam com os nomes de antes.'}
            </p>
            <button type="button" data-archive-category disabled={productCount > 0 || save.state === 'saving'} onClick={() => void archive()} className={`${dangerButton} mt-3`}>
              Arquivar categoria
            </button>
          </div>
        )}
        <SaveBar dirty={dirty} save={save} onSave={() => void submit()} onCancel={onClose} />
      </div>
    </SellerDialog>
  )
}
