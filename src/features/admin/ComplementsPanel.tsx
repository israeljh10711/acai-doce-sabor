import { useState } from 'react'
import { formatBRL } from '../../utils/money.ts'
import { nowIso } from '../../services/catalogWriter.ts'
import { type Problem, validateGroup, validateOption } from '../catalog/catalogValidation.ts'
import { freeId } from '../catalog/productDraft.ts'
import { type CatalogRecords, type GroupRecord, type GroupRule, type OptionRecord, byPosition } from '../catalog/records.ts'
import { SellerDialog } from '../seller/SellerDialog.tsx'
import { useWrite } from './adminData.ts'
import { blankOption, dangerButton, describe, groupRuleText, inputClass, labelClass, moved, primaryButton, quietButton, RULES, thumbOf } from './adminKit.ts'
import { Chip, CountInput, Field, MoneyInput, MoveButtons, PhotoPicker, SaveBar, Switch } from './adminUi.tsx'

/** Complementos e adicionais: os grupos (com as regras e onde são usados) e os complementos de cada um. */
export function ComplementsPanel({ records }: { records: CatalogRecords }) {
  const groups = byPosition(records.groups)
  const [editingGroup, setEditingGroup] = useState<GroupRecord | null>(null)
  const [editingOption, setEditingOption] = useState<OptionRecord | null>(null)
  const [save, run] = useWrite()
  const usage = (groupId: string) =>
    records.productGroups
      .filter((link) => link.groupId === groupId)
      .map((link) => records.products.find((product) => product.id === link.productId))
      .filter((product) => product && product.archivedAt === null)
      .map((product) => product!.name)
  const productName = (id: string | null) => (id ? (records.products.find((product) => product.id === id)?.name ?? id) : null)

  const newGroup = (): GroupRecord => ({ id: '', name: '', rule: 'included', minSelect: 0, maxSelect: null, freeCount: null, extraPriceCents: 0, inCompleto: false, available: true, position: groups.length })
  const newOption = (groupId: string): OptionRecord => blankOption(records, groupId)
  return (
    <section aria-labelledby="titulo-complementos" data-admin-complements>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="titulo-complementos" className="font-display text-2xl font-black text-acai-800">
          Complementos e adicionais
        </h2>
        <button type="button" data-new-group onClick={() => setEditingGroup(newGroup())} className={primaryButton}>
          + Novo grupo
        </button>
      </div>
      <p className="mt-1 text-sm text-ink-soft">
        Um complemento vale com o mesmo preço em todos os produtos que usam o grupo dele. Para um preço só de um produto, crie o complemento com "Só neste produto".
      </p>
      {save.state === 'error' && (
        <p role="alert" className="mt-3 rounded-xl bg-red-50 px-4 py-2 text-sm font-semibold text-red-800">
          {save.message}
        </p>
      )}
      <ol className="mt-4 flex flex-col gap-4">
        {groups.map((group, index) => {
          const options = byPosition(records.options.filter((option) => option.groupId === group.id && option.archivedAt === null))
          const used = usage(group.id)
          return (
            <li key={group.id} data-group={group.id} className="rounded-3xl bg-white p-4 ring-1 ring-line">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-lg font-extrabold text-acai-800">
                    {group.name} {group.inCompleto && <Chip tone="info">Completo</Chip>} {!group.available && <Chip tone="off">Esgotado</Chip>}
                  </h3>
                  <p className="text-sm text-ink-soft">{groupRuleText(group)}</p>
                  <p className="mt-1 text-sm text-acai-900">
                    <span className="font-bold">Usado em:</span> {used.length > 0 ? used.join(', ') : 'nenhum produto'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <MoveButtons label={group.name} first={index === 0} last={index === groups.length - 1} busy={save.state === 'saving'} onMove={(step) => void run((writer) => writer.reorder('grupos', moved(groups, index, step).map((entry) => entry.id)))} />
                  <button type="button" data-edit-group onClick={() => setEditingGroup(group)} className={quietButton}>
                    Editar grupo<span className="sr-only">: {group.name}</span>
                  </button>
                </div>
              </div>
              <ol className="mt-3 flex flex-col divide-y divide-line">
                {options.map((option, at) => (
                  <li key={option.id} data-option={option.id} className="flex flex-col gap-2 py-2 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-acai-50 ring-1 ring-line">
                        {thumbOf(option.image ?? '') ? <img src={thumbOf(option.image ?? '')!} alt="" className="size-full object-cover" loading="lazy" /> : null}
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold break-words text-acai-900">
                          {option.name} <span className="nums text-sm text-ink-soft">{option.priceCents > 0 ? `+ ${formatBRL(option.priceCents)}` : 'sem custo'}</span>
                        </p>
                        <p className="flex flex-wrap gap-1">
                          {!option.available && <Chip tone="off">Esgotado</Chip>}
                          {option.productId && <Chip tone="info">Só em {productName(option.productId)}</Chip>}
                          {option.noCompleto && <Chip tone="warn">Fora do Completo</Chip>}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <MoveButtons label={option.name} first={at === 0} last={at === options.length - 1} busy={save.state === 'saving'} onMove={(step) => void run((writer) => writer.reorder('complementos', moved(options, at, step).map((entry) => entry.id)))} />
                      <button type="button" data-toggle-option disabled={save.state === 'saving'} onClick={() => void run((writer) => writer.patch('catalog_options', { id: option.id }, { available: !option.available }))} className={quietButton}>
                        {option.available ? 'Marcar esgotado' : 'Marcar disponível'}
                        <span className="sr-only">: {option.name}</span>
                      </button>
                      <button type="button" data-edit-option onClick={() => setEditingOption(option)} className={quietButton}>
                        Editar<span className="sr-only">: {option.name}</span>
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
              <button type="button" data-new-option onClick={() => setEditingOption(newOption(group.id))} className={`${quietButton} mt-2`}>
                + Novo complemento em {group.name}
              </button>
            </li>
          )
        })}
      </ol>
      {editingGroup && <GroupEditor key={editingGroup.id || 'novo'} group={editingGroup} records={records} onClose={() => setEditingGroup(null)} />}
      {editingOption && <OptionEditor key={editingOption.id || 'novo'} option={editingOption} records={records} onClose={() => setEditingOption(null)} />}
    </section>
  )
}

function GroupEditor({ group, records, onClose }: { group: GroupRecord; records: CatalogRecords; onClose: () => void }) {
  const [draft, setDraft] = useState(group)
  const [base, setBase] = useState(group)
  const [problems, setProblems] = useState<Problem[]>([])
  const [save, run, setSave] = useWrite()
  const isNew = group.id === ''
  const error = (field: string) => problems.find((problem) => problem.field === field)?.message ?? null
  const set = (patch: Partial<GroupRecord>) => {
    setDraft((current) => ({ ...current, ...patch }))
    if (save.state !== 'saving') setSave({ state: 'idle' })
  }
  const charges = draft.freeCount !== null

  const submit = async () => {
    const record = { ...draft, id: draft.id || freeId(draft.name, new Set(records.groups.map((entry) => entry.id))), name: draft.name.trim(), extraPriceCents: charges ? draft.extraPriceCents : 0 }
    const found = validateGroup(record)
    setProblems(found)
    if (found.length > 0) return setSave({ state: 'error', message: found[0].message })
    if (await run((writer) => writer.saveGroup(record))) {
      setDraft(record)
      setBase(record)
      if (isNew) onClose()
    }
  }

  return (
    <SellerDialog title={isNew ? 'Novo grupo de complementos' : `Editar grupo: ${group.name}`} titleId="titulo-editar-grupo" onClose={onClose} wide>
      <div className="flex flex-col gap-4" data-group-editor>
        <Field id="grupo-nome" label="Nome" error={error('name')}>
          <input id="grupo-nome" value={draft.name} maxLength={120} onChange={(event) => set({ name: event.target.value })} className={inputClass} {...describe('grupo-nome', undefined, error('name'))} />
        </Field>
        <fieldset className="flex flex-col gap-2">
          <legend className={labelClass}>Como entra no pedido</legend>
          {(Object.keys(RULES) as GroupRule[]).map((rule) => (
            <label key={rule} className={`flex cursor-pointer gap-3 rounded-2xl p-3 ring-1 ${draft.rule === rule ? 'bg-acai-50 ring-2 ring-acai-700' : 'ring-line'}`}>
              <input type="radio" name="regra-grupo" value={rule} checked={draft.rule === rule} onChange={() => set({ rule })} className="mt-1 size-4 accent-acai-800" />
              <span>
                <span className="block text-sm font-bold text-acai-900">{RULES[rule].title}</span>
                <span className="block text-xs text-ink-soft">{RULES[rule].text}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="grupo-minimo" label="Mínimo" hint="Maior que zero: escolha obrigatória." error={error('minSelect')}>
            <CountInput id="grupo-minimo" value={draft.minSelect} onChange={(value) => set({ minSelect: value ?? 0 })} />
          </Field>
          <Field id="grupo-maximo" label="Máximo" hint="Vazio: sem máximo." error={error('maxSelect')}>
            <CountInput id="grupo-maximo" optional value={draft.maxSelect} onChange={(value) => set({ maxSelect: value })} />
          </Field>
        </div>
        <Switch checked={charges} onChange={(on) => set({ freeCount: on ? (draft.freeCount ?? 1) : null })} label="Cobrar a partir de certa quantidade" description="Algumas unidades grátis; cada uma a mais custa o preço extra." />
        {charges && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="grupo-gratis" label="Unidades grátis" error={error('freeCount')}>
              <CountInput id="grupo-gratis" value={draft.freeCount} onChange={(value) => set({ freeCount: value ?? 0 })} />
            </Field>
            <Field id="grupo-extra" label="Preço de cada unidade a mais" error={error('extraPriceCents')}>
              <MoneyInput id="grupo-extra" cents={draft.extraPriceCents} onChange={(cents) => set({ extraPriceCents: cents ?? -1 })} />
            </Field>
          </div>
        )}
        <Switch checked={draft.inCompleto} onChange={(inCompleto) => set({ inCompleto })} label='Entra no "Completo"' description="O Completo marca 1 de cada complemento grátis deste grupo." />
        <Switch checked={draft.available} onChange={(available) => set({ available })} label="Disponível" description="Desligado: todos os complementos do grupo aparecem esgotados." />
        <SaveBar dirty={JSON.stringify(draft) !== JSON.stringify(base)} save={save} onSave={() => void submit()} onCancel={onClose} />
      </div>
    </SellerDialog>
  )
}

export function OptionEditor({ option, records, onClose }: { option: OptionRecord; records: CatalogRecords; onClose: () => void }) {
  const [draft, setDraft] = useState(option)
  const [base, setBase] = useState(option)
  const [uploading, setUploading] = useState(false)
  const [problems, setProblems] = useState<Problem[]>([])
  const [save, run, setSave] = useWrite()
  const isNew = option.id === ''
  const error = (field: string) => problems.find((problem) => problem.field === field)?.message ?? null
  const set = (patch: Partial<OptionRecord>) => {
    setDraft((current) => ({ ...current, ...patch }))
    if (save.state !== 'saving') setSave({ state: 'idle' })
  }
  const montaveis = byPosition(records.products.filter((product) => product.kind === 'montavel' && product.archivedAt === null))

  const submit = async () => {
    const record = { ...draft, id: draft.id || freeId(draft.name, new Set(records.options.map((entry) => entry.id))), name: draft.name.trim() }
    const found = validateOption(record, records)
    setProblems(found)
    if (found.length > 0) return setSave({ state: 'error', message: found[0].message })
    if (await run((writer) => writer.saveOption(record))) {
      setDraft(record)
      setBase(record)
      if (isNew) onClose()
    }
  }
  const archive = async () => {
    if (await run((writer) => writer.patch('catalog_options', { id: option.id }, { archivedAt: nowIso() }))) onClose()
  }

  return (
    <SellerDialog title={isNew ? 'Novo complemento' : `Editar: ${option.name}`} titleId="titulo-editar-complemento" onClose={onClose} wide>
      <div className="flex flex-col gap-4" data-option-editor>
        <Field id="complemento-nome" label="Nome" error={error('name')}>
          <input id="complemento-nome" value={draft.name} maxLength={120} onChange={(event) => set({ name: event.target.value })} className={inputClass} {...describe('complemento-nome', undefined, error('name'))} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="complemento-grupo" label="Grupo" error={error('groupId')}>
            <select id="complemento-grupo" value={draft.groupId} onChange={(event) => set({ groupId: event.target.value })} className={inputClass}>
              {byPosition(records.groups).map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </Field>
          <Field id="complemento-preco" label="Preço" hint="Zero: sem custo." error={error('priceCents')}>
            <MoneyInput id="complemento-preco" cents={draft.priceCents} onChange={(cents) => set({ priceCents: cents ?? -1 })} />
          </Field>
        </div>
        <Field id="complemento-produto" label="Só neste produto" hint="Vazio: em todos os produtos que usam o grupo." error={error('productId')}>
          <select id="complemento-produto" value={draft.productId ?? ''} onChange={(event) => set({ productId: event.target.value || null })} className={inputClass}>
            <option value="">Todos os produtos do grupo</option>
            {montaveis.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="flex flex-col gap-1.5">
          <span className={labelClass}>Foto</span>
          <PhotoPicker value={draft.image ?? ''} alt={draft.name} onBusy={setUploading} onChange={(image) => set({ image: image || null })} />
          {error('image') && (
            <p role="alert" className="text-sm font-semibold text-red-700">
              {error('image')}
            </p>
          )}
        </div>
        <Switch checked={draft.noCompleto} onChange={(noCompleto) => set({ noCompleto })} label='Fica fora do "Completo"' description="O Completo não marca este complemento (como o leite condensado)." />
        <Switch checked={draft.available} onChange={(available) => set({ available })} label="Disponível" />
        {!isNew && (
          <div className="rounded-2xl bg-acai-50 p-4 ring-1 ring-line">
            <p className="text-sm font-bold text-acai-900">Arquivar complemento</p>
            <p className="mt-1 text-sm text-ink-soft">Sai do personalizador. Pedidos antigos continuam com o nome e o preço de quando foram feitos.</p>
            <button type="button" data-archive-option disabled={save.state === 'saving'} onClick={() => void archive()} className={`${dangerButton} mt-3`}>
              Arquivar complemento
            </button>
          </div>
        )}
        <SaveBar dirty={JSON.stringify(draft) !== JSON.stringify(base)} busy={uploading} save={save} onSave={() => void submit()} onCancel={onClose} />
      </div>
    </SellerDialog>
  )
}
