import { type ReactNode, useEffect, useId, useRef, useState } from 'react'
import { Camera, Plus, RotateCcw, Trash } from '../../components/ui/icons.tsx'
import { formatBRL } from '../../utils/money.ts'
import { BASE_CATEGORIES, findCategoryBySlug } from '../catalog/categories.ts'
import type { ItemChange, ProductChange, ProductSizeEntry, SectionChange, SizeEntry, ToppingChange } from '../catalog/catalogChanges.ts'
import { MONTE_TITLE } from '../catalog/catalogNav.ts'
import { getCatalogChanges } from '../catalog/catalogStore.ts'
import { BASE_EXTRA_ITEMS, DRAWERS, type DrawerId, type ExtraItem, drawerById, getExtraItem } from '../catalog/extras.ts'
import { BASE_TOPPINGS, PRODUCTS, TOPPING_GROUPS, type ToppingGroupId, getTopping } from '../catalog/menu.ts'
import { catalogPhotoSrc, ingredientPhoto } from '../catalog/photos.ts'
import { compressPhoto } from './photo.ts'
import { formatPriceInput, newId, parseFlavors, parsePriceInput } from './sellerForm.ts'
import { SellerDialog } from './SellerDialog.tsx'
import { type EditTarget, useSellerMode } from './sellerModeContext.ts'

const inputClass =
  'min-h-12 w-full rounded-xl bg-acai-50 px-4 text-base text-acai-950 ring-1 ring-line outline-none focus:bg-white focus:ring-2 focus:ring-acai-700 aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-red-500'
const labelClass = 'text-sm font-bold text-acai-950'
const primaryButton =
  'btn-gold inline-flex min-h-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl px-5 font-extrabold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800 disabled:cursor-not-allowed disabled:opacity-60'
const quietButton =
  'inline-flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-bold ring-1 transition focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800'

/**
 * Formulário do vendedor (pedido de 2026-11-16), o mesmo para editar e para adicionar: foto da
 * galeria ou da câmera, nome, preço e descrição; embaixo, as opções (seção, sabores,
 * disponível/esgotado) e, ao editar, "Excluir item" e "Restaurar original".
 */
export function SellerItemFormModal({ target, onClose }: { target: EditTarget; onClose: () => void }) {
  if (target.kind === 'product') return <ProductForm slug={target.id} onClose={onClose} />
  if (target.kind === 'topping') return <ToppingForm id={target.id} group={target.group} onClose={onClose} />
  if (target.kind === 'section') return <SectionForm id={target.id} onClose={onClose} />
  return <ItemForm id={target.id} drawer={target.drawer} copyOf={target.copyOf} onClose={onClose} />
}

/* "Tamanhos e Preços (Opcional)": linhas de nome e preço (e, nos açaís, adicionais grátis). */

type SizeRow = { key: string; id?: string; name: string; price: string; free: string }

let rowCount = 0
const rowKey = () => `linha-${++rowCount}`

function SizesEditor({
  rows,
  onChange,
  withFree,
  title = 'Tamanhos e Preços (Opcional)',
  hint,
}: {
  rows: SizeRow[]
  onChange: (rows: SizeRow[]) => void
  withFree: boolean
  title?: string
  hint?: string
}) {
  const update = (key: string, patch: Partial<SizeRow>) => onChange(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  return (
    <fieldset className="flex flex-col gap-2" data-sizes-editor="">
      <legend className={`${labelClass} mb-1.5`}>{title}</legend>
      {hint && <p className="text-xs text-ink-soft">{hint}</p>}
      {rows.map((row, index) => (
        <div key={row.key} className={`grid items-end gap-2 ${withFree ? 'grid-cols-[1fr_6.5rem_4.5rem_auto]' : 'grid-cols-[1fr_7rem_auto]'}`}>
          <label className="flex flex-col gap-1 text-xs font-semibold text-ink-soft">
            Nome do tamanho
            <input className={inputClass} value={row.name} maxLength={40} data-size-name={index} placeholder="Ex.: 500ml" onChange={(event) => update(row.key, { name: event.target.value })} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-ink-soft">
            Preço (R$)
            <input className={inputClass} inputMode="decimal" value={row.price} data-size-price={index} placeholder="0,00" onChange={(event) => update(row.key, { price: event.target.value })} />
          </label>
          {withFree && (
            <label className="flex flex-col gap-1 text-xs font-semibold text-ink-soft">
              Grátis
              <input className={inputClass} inputMode="numeric" value={row.free} data-size-free={index} onChange={(event) => update(row.key, { free: event.target.value })} />
            </label>
          )}
          <button
            type="button"
            aria-label={`Remover o tamanho ${row.name || index + 1}`}
            onClick={() => onChange(rows.filter((candidate) => candidate.key !== row.key))}
            className="grid size-12 cursor-pointer place-items-center rounded-xl text-red-700 ring-1 ring-red-200 transition hover:bg-red-50 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800"
          >
            <Trash className="size-5" />
          </button>
        </div>
      ))}
      <button
        type="button"
        data-add-size=""
        onClick={() => onChange([...rows, { key: rowKey(), name: '', price: '', free: '0' }])}
        className={`${quietButton} self-start text-acai-800 ring-line hover:bg-acai-100`}
      >
        <Plus className="size-4" />
        Adicionar tamanho
      </button>
    </fieldset>
  )
}

/** Linhas preenchidas → tamanhos; `null` quando alguma linha tem nome ou preço inválido. */
function readSizes(rows: readonly SizeRow[]): { name: string; priceCents: number; id?: string; freeToppings: number }[] | null {
  const sizes = []
  for (const row of rows) {
    const name = row.name.trim()
    if (!name && !row.price.trim()) continue
    const priceCents = parsePriceInput(row.price)
    const free = row.free.trim() === '' ? 0 : Number(row.free)
    if (!name || priceCents === null || !Number.isInteger(free) || free < 0 || free > 20) return null
    sizes.push({ ...(row.id ? { id: row.id } : {}), name, priceCents, freeToppings: free })
  }
  const names = sizes.map((size) => size.name.toLocaleLowerCase('pt-BR'))
  return new Set(names).size === names.length ? sizes : null
}

/* Peças comuns */

function useSubmit(onDone: () => void) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const run = async (task: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await task()
      onDone()
    } catch {
      setError('Não foi possível salvar. Confira a conexão e tente de novo.')
      setBusy(false)
    }
  }
  return { busy, error, run }
}

/** Fecha a janela do formulário (o <dialog> em volta), que avisa o `onClose`. */
const closeDialog = (element: HTMLElement | null) => element?.closest('dialog')?.close()

function PhotoField({ current, alt, onPick }: { current: string | null; alt: string; onPick: (blob: Blob | null) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [state, setState] = useState<'idle' | 'working' | 'error'>('idle')
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview])
  const shown = preview ?? current

  return (
    <div className="flex flex-col gap-2">
      <span className={labelClass}>Foto</span>
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="relative grid aspect-[4/3] w-full cursor-pointer place-items-center overflow-hidden rounded-2xl bg-acai-50 ring-1 ring-line focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800"
      >
        {shown ? (
          <img src={shown} alt={alt} className="absolute inset-0 size-full object-contain" />
        ) : (
          <span className="flex flex-col items-center gap-1 text-acai-700">
            <Camera className="size-10" />
            <span className="text-sm font-semibold">Sem foto</span>
          </span>
        )}
        <span className="sr-only">Trocar a foto</span>
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        aria-label="Escolher foto"
        data-photo-input=""
        className="sr-only"
        onChange={async (event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (!file) return
          setState('working')
          try {
            const blob = await compressPhoto(file)
            setPreview(URL.createObjectURL(blob))
            onPick(blob)
            setState('idle')
          } catch {
            onPick(null)
            setState('error')
          }
        }}
      />
      <button type="button" onClick={() => input.current?.click()} className={`${quietButton} text-acai-800 ring-line hover:bg-acai-100`}>
        <Camera className="size-5" />
        {state === 'working' ? 'Preparando a foto…' : 'Escolher Foto (Galeria / Câmera)'}
      </button>
      {state === 'error' && (
        <p role="alert" className="text-sm font-semibold text-red-700">
          Não deu para usar essa foto. Tente outra.
        </p>
      )}
    </div>
  )
}

function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string | null; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      {children}
      {hint && (
        <p id={`${id}-dica`} className="text-xs text-ink-soft">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-erro`} role="alert" className="text-sm font-semibold text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}

function Availability({ available, onChange }: { available: boolean; onChange: (value: boolean) => void }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className={`${labelClass} mb-1.5`}>Disponibilidade</legend>
      <div className="grid grid-cols-2 gap-2">
        {[
          { value: true, text: 'Disponível' },
          { value: false, text: 'Esgotado' },
        ].map((option) => (
          <label
            key={option.text}
            className={`flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl px-3 font-bold ring-1 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-acai-800 ${
              available === option.value
                ? option.value
                  ? 'bg-green-50 text-green-800 ring-green-300'
                  : 'bg-red-50 text-red-700 ring-red-300'
                : 'text-ink-soft ring-line'
            }`}
          >
            <input type="radio" name="disponibilidade" className="sr-only" checked={available === option.value} onChange={() => onChange(option.value)} />
            {option.text}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

/** "Excluir item" (com confirmação) e "Restaurar original", embaixo do formulário. */
function DangerZone({ canDelete, canRestore, onDelete, onRestore, busy }: { canDelete: boolean; canRestore: boolean; onDelete: () => void; onRestore: () => void; busy: boolean }) {
  const [confirming, setConfirming] = useState(false)
  if (!canDelete && !canRestore) return null
  return (
    <div className="flex flex-col gap-2 border-t border-line pt-4">
      {confirming ? (
        <div role="alertdialog" aria-labelledby="confirmar-exclusao" className="flex flex-col gap-2 rounded-xl bg-red-50 p-3 ring-1 ring-red-200">
          <p id="confirmar-exclusao" className="text-sm font-bold text-red-800">
            Excluir este item? Ele some do cardápio e dos carrinhos.
          </p>
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={onDelete} className={`${quietButton} flex-1 bg-red-600 text-white ring-red-600 hover:bg-red-700`}>
              Excluir
            </button>
            <button type="button" onClick={() => setConfirming(false)} className={`${quietButton} flex-1 text-acai-800 ring-line hover:bg-white`}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {canDelete && (
            <button type="button" onClick={() => setConfirming(true)} className={`${quietButton} text-red-700 ring-red-200 hover:bg-red-50`}>
              <Trash className="size-4" />
              Excluir item
            </button>
          )}
          {canRestore && (
            <button type="button" disabled={busy} onClick={onRestore} className={`${quietButton} text-acai-800 ring-line hover:bg-acai-100`}>
              <RotateCcw className="size-4" />
              Restaurar original
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/* Item das seções (e os 5 destaques) */

const flavorGroupOf = (entry?: ExtraItem) => (entry?.action.type === 'flavor_modal' ? entry.action.choices.find((group) => !group.prices) : undefined)
const sizeGroupOf = (entry?: ExtraItem) => (entry?.action.type === 'flavor_modal' ? entry.action.choices.find((group) => group.prices) : undefined)

function ItemForm({ id, drawer, copyOf, onClose }: { id: string | null; drawer?: string; copyOf?: string; onClose: () => void }) {
  const seller = useSellerMode()
  const uid = useId()
  const item = id ? getExtraItem(id) : undefined
  // "Duplicar" (pedido de 2026-11-17): cadastro novo, preenchido com o item de origem, sem a foto.
  const copy = !item && copyOf ? getExtraItem(copyOf) : undefined
  const source = item ?? copy
  const saved = id ? getCatalogChanges().items[id] : undefined
  const isBase = id ? BASE_EXTRA_ITEMS.some((candidate) => candidate.id === id) : false
  const customizer = item?.action.type === 'customizer'
  // Para saber o que mudou, compara com o próprio item (num item novo, grava tudo o que tiver).
  const firstGroup = flavorGroupOf(item)
  const sizeGroup = sizeGroupOf(item)
  const startSizes = sizeGroupOf(source)

  const [name, setName] = useState(item?.name ?? (copy ? `${copy.name} (Cópia)` : ''))
  const [price, setPrice] = useState(source ? formatPriceInput(source.priceCents) : '')
  const [oldPrice, setOldPrice] = useState(source?.originalPriceCents ? formatPriceInput(source.originalPriceCents) : '')
  const [description, setDescription] = useState(source?.description ?? '')
  const [section, setSection] = useState<DrawerId>((source?.drawer ?? drawer ?? DRAWERS[0].id) as DrawerId)
  const [flavors, setFlavors] = useState(flavorGroupOf(source)?.options.join(', ') ?? '')
  const [available, setAvailable] = useState(source?.available !== false)
  const [photo, setPhoto] = useState<Blob | null>(null)
  const [errors, setErrors] = useState<{ name?: string; price?: string; oldPrice?: string; sizes?: string }>({})
  const [sizeRows, setSizeRows] = useState<SizeRow[]>(() =>
    (startSizes?.options ?? []).map((option) => ({ key: rowKey(), name: option, price: formatPriceInput(startSizes?.prices?.[option] ?? 0), free: '0' })),
  )
  const hasSizes = sizeRows.length > 0
  const submit = useSubmit(onClose)

  return (
    <SellerDialog
      title={item ? `Editar: ${item.name}` : copy ? `Duplicar Item — ${copy.name} (Cópia)` : 'Adicionar produto'}
      titleId={`${uid}-titulo`}
      onClose={onClose}
      wide
    >
      <form
        noValidate
        className="flex flex-col gap-4 pb-2"
        onSubmit={(event) => {
          event.preventDefault()
          const form = event.currentTarget
          const sizes = customizer ? [] : readSizes(sizeRows)
          const priceCents = sizes && sizes.length > 0 ? Math.min(...sizes.map((size) => size.priceCents)) : parsePriceInput(price)
          const oldCents = !hasSizes && oldPrice.trim() ? parsePriceInput(oldPrice) : null
          const next = {
            name: name.trim() ? undefined : 'Escreva o nome.',
            price: priceCents === null ? 'Escreva o preço, por exemplo 3,00.' : undefined,
            oldPrice: !hasSizes && oldPrice.trim() && oldCents === null ? 'Preço antigo inválido.' : undefined,
            sizes: sizes === null ? 'Confira os tamanhos: cada um com nome (sem repetir) e preço.' : undefined,
          }
          setErrors(next)
          if (next.name || next.price || next.oldPrice || next.sizes) return
          void submit.run(async () => {
            const change: ItemChange = { ...saved, name: name.trim(), priceCents: priceCents!, originalPriceCents: oldCents, description: description.trim(), available, drawer: section }
            if (!customizer) {
              const entries: SizeEntry[] = (sizes ?? []).map((size) => ({ name: size.name, priceCents: size.priceCents }))
              const before = (sizeGroup?.options ?? []).map((option) => `${option}=${sizeGroup?.prices?.[option]}`).join('|')
              if (entries.map((size) => `${size.name}=${size.priceCents}`).join('|') !== before) change.sizes = entries
            }
            const parsed = parseFlavors(flavors)
            if (!customizer && parsed.join('|') !== (firstGroup?.options ?? []).join('|')) change.flavors = parsed
            if (photo) change.image = await seller.uploadPhoto(photo)
            const targetId = id ?? newId(name)
            if (!id) change.created = true
            await seller.save('items', targetId, change)
            closeDialog(form)
          })
        }}
      >
        <PhotoField current={item?.image ? catalogPhotoSrc(item.image, 480) : null} alt={item?.imageAlt ?? ''} onPick={setPhoto} />
        <Field id={`${uid}-nome`} label="Nome do produto" error={errors.name}>
          <input id={`${uid}-nome`} className={inputClass} value={name} maxLength={80} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? `${uid}-nome-erro` : undefined} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Picolé trufado" />
        </Field>
        {hasSizes ? (
          <p className="rounded-xl bg-acai-50 px-3 py-2 text-sm text-ink-soft ring-1 ring-line">
            Com tamanhos, o cardápio mostra "a partir de" o menor preço, e o cliente escolhe o tamanho ao pedir.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field id={`${uid}-preco`} label="Preço (R$)" error={errors.price}>
              <input id={`${uid}-preco`} className={inputClass} inputMode="decimal" value={price} aria-invalid={Boolean(errors.price)} aria-describedby={errors.price ? `${uid}-preco-erro` : undefined} onChange={(event) => setPrice(event.target.value)} placeholder="3,00" />
            </Field>
            <Field id={`${uid}-antigo`} label="Preço antigo riscado (R$)" error={errors.oldPrice}>
              <input id={`${uid}-antigo`} className={inputClass} inputMode="decimal" value={oldPrice} aria-invalid={Boolean(errors.oldPrice)} onChange={(event) => setOldPrice(event.target.value)} placeholder="opcional" />
            </Field>
          </div>
        )}
        {!customizer && (
          <>
            <SizesEditor rows={sizeRows} onChange={setSizeRows} withFree={false} hint="Sem tamanhos, vale o preço único acima." />
            {errors.sizes && (
              <p role="alert" className="text-sm font-semibold text-red-700">
                {errors.sizes}
              </p>
            )}
          </>
        )}
        <Field id={`${uid}-descricao`} label="Descrição">
          <textarea id={`${uid}-descricao`} className={`${inputClass} min-h-24 py-3`} value={description} maxLength={300} onChange={(event) => setDescription(event.target.value)} placeholder="Ex.: Picolé trufado sabor chocolate" />
        </Field>
        <details className="rounded-2xl ring-1 ring-line" open={!item}>
          <summary className="min-h-12 cursor-pointer list-inside px-4 py-3 font-bold text-acai-800">Mais opções</summary>
          <div className="flex flex-col gap-4 px-4 pb-4">
            <Field id={`${uid}-secao`} label="Categoria">
              <select id={`${uid}-secao`} className={inputClass} value={section} onChange={(event) => setSection(event.target.value as DrawerId)}>
                {DRAWERS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.navLabel}
                  </option>
                ))}
              </select>
            </Field>
            {!customizer && (
              <Field id={`${uid}-sabores`} label="Sabores (opcional)" hint="Separados por vírgula. Ex.: Chocolate, Morango, Maracujá">
                <input id={`${uid}-sabores`} className={inputClass} value={flavors} aria-describedby={`${uid}-sabores-dica`} onChange={(event) => setFlavors(event.target.value)} />
              </Field>
            )}
            <Availability available={available} onChange={setAvailable} />
          </div>
        </details>
        {submit.error && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 ring-1 ring-red-200">
            {submit.error}
          </p>
        )}
        <button type="submit" disabled={submit.busy} className={primaryButton}>
          {submit.busy ? 'Salvando…' : item ? 'Salvar alterações' : 'Adicionar produto'}
        </button>
        {item && (
          <DangerZone
            busy={submit.busy}
            canDelete={!customizer}
            canRestore={isBase && saved !== undefined}
            onDelete={() => void submit.run(() => seller.save('items', item.id, isBase ? { ...saved, deleted: true } : null))}
            onRestore={() => void submit.run(() => seller.save('items', item.id, null))}
          />
        )}
      </form>
    </SellerDialog>
  )
}

/* Os 4 produtos principais */

function ProductForm({ slug, onClose }: { slug: string; onClose: () => void }) {
  const seller = useSellerMode()
  const uid = useId()
  const category = findCategoryBySlug(slug)
  const product = PRODUCTS[slug as keyof typeof PRODUCTS]
  const saved = getCatalogChanges().products[slug]
  const [name, setName] = useState(category?.name ?? '')
  const [description, setDescription] = useState(category?.tagline ?? '')
  const [rows, setRows] = useState<SizeRow[]>(() =>
    product.sizes.map((size) => ({ key: rowKey(), id: size.id, name: size.name, price: formatPriceInput(size.priceCents), free: String(size.freeToppings) })),
  )
  const withFree = product.groups.includes('dry')
  const [photo, setPhoto] = useState<Blob | null>(null)
  const [error, setError] = useState<string | null>(null)
  const submit = useSubmit(onClose)
  if (!category) return null
  const base = BASE_CATEGORIES.find((candidate) => candidate.slug === category.slug)

  return (
    <SellerDialog title={`Editar: ${category.name}`} titleId={`${uid}-titulo`} onClose={onClose} wide>
      <form
        noValidate
        className="flex flex-col gap-4 pb-2"
        onSubmit={(event) => {
          event.preventDefault()
          const form = event.currentTarget
          const sizes = readSizes(rows)
          if (sizes === null) return setError('Confira os tamanhos: cada um com nome (sem repetir), preço e grátis de 0 a 20.')
          if (sizes.length === 0) return setError('Deixe pelo menos um tamanho.')
          if (!name.trim()) return setError('Escreva o nome.')
          setError(null)
          void submit.run(async () => {
            const entries: ProductSizeEntry[] = sizes.map((size) => ({ ...(size.id ? { id: size.id } : {}), name: size.name, priceCents: size.priceCents, freeToppings: size.freeToppings }))
            const change: ProductChange = { ...saved, name: name.trim(), description: description.trim(), sizes: entries }
            delete change.sizePrices
            if (photo) change.image = await seller.uploadPhoto(photo)
            await seller.save('products', category.slug, change)
            closeDialog(form)
          })
        }}
      >
        <PhotoField current={category.photo ?? null} alt={category.name} onPick={setPhoto} />
        <Field id={`${uid}-nome`} label="Nome">
          <input id={`${uid}-nome`} className={inputClass} value={name} maxLength={80} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field id={`${uid}-descricao`} label="Descrição">
          <textarea id={`${uid}-descricao`} className={`${inputClass} min-h-24 py-3`} value={description} maxLength={300} onChange={(event) => setDescription(event.target.value)} />
        </Field>
        <SizesEditor
          rows={rows}
          onChange={setRows}
          withFree={withFree}
          title="Tamanhos e Preços"
          hint={withFree ? '"Grátis": quantos adicionais grátis o tamanho inclui. Tamanho novo com "Copo", "Isopor" ou "Pote" no nome entra nesse grupo.' : undefined}
        />
        {(error || submit.error) && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 ring-1 ring-red-200">
            {error ?? submit.error}
          </p>
        )}
        <button type="submit" disabled={submit.busy} className={primaryButton}>
          {submit.busy ? 'Salvando…' : 'Salvar alterações'}
        </button>
        <DangerZone busy={submit.busy} canDelete={false} canRestore={Boolean(base) && saved !== undefined} onDelete={() => {}} onRestore={() => void submit.run(() => seller.save('products', category.slug, null))} />
      </form>
    </SellerDialog>
  )
}

/* Complementos do personalizador */

const GROUP_CHOICES: readonly ToppingGroupId[] = ['dry', 'fruit', 'syrup', 'paid']

function ToppingForm({ id, group, onClose }: { id: string | null; group?: string; onClose: () => void }) {
  const seller = useSellerMode()
  const uid = useId()
  const topping = id ? getTopping(id) : undefined
  const saved = id ? getCatalogChanges().toppings[id] : undefined
  const isBase = id ? BASE_TOPPINGS.some((candidate) => candidate.id === id) : false
  const [name, setName] = useState(topping?.name ?? '')
  const [price, setPrice] = useState(formatPriceInput(topping?.priceCents ?? 0))
  const [kind, setKind] = useState<ToppingGroupId>((topping?.group ?? (group as ToppingGroupId | undefined) ?? 'dry') as ToppingGroupId)
  const [available, setAvailable] = useState(topping?.available !== false)
  const [photo, setPhoto] = useState<Blob | null>(null)
  const [errors, setErrors] = useState<{ name?: string; price?: string }>({})
  const submit = useSubmit(onClose)
  const current = topping ? ingredientPhoto(topping)?.src ?? null : null

  return (
    <SellerDialog title={topping ? `Editar: ${topping.name}` : 'Adicionar complemento'} titleId={`${uid}-titulo`} onClose={onClose} wide>
      <form
        noValidate
        className="flex flex-col gap-4 pb-2"
        onSubmit={(event) => {
          event.preventDefault()
          const form = event.currentTarget
          const priceCents = parsePriceInput(price)
          const next = { name: name.trim() ? undefined : 'Escreva o nome.', price: priceCents === null ? 'Preço inválido (0,00 para sem custo).' : undefined }
          setErrors(next)
          if (next.name || next.price) return
          void submit.run(async () => {
            const change: ToppingChange = { ...saved, name: name.trim(), priceCents: priceCents!, available }
            if (photo) change.image = await seller.uploadPhoto(photo)
            const targetId = id ?? newId(name)
            if (!id) Object.assign(change, { created: true, group: kind })
            await seller.save('toppings', targetId, change)
            closeDialog(form)
          })
        }}
      >
        <PhotoField current={current} alt={topping?.name ?? ''} onPick={setPhoto} />
        <Field id={`${uid}-nome`} label="Nome do complemento" error={errors.name}>
          <input id={`${uid}-nome`} className={inputClass} value={name} maxLength={60} aria-invalid={Boolean(errors.name)} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Ovomaltine" />
        </Field>
        <Field id={`${uid}-preco`} label="Preço (R$)" hint="0,00 para os sem custo (adicionais dentro da cota, frutas e caldas)." error={errors.price}>
          <input id={`${uid}-preco`} className={inputClass} inputMode="decimal" value={price} aria-invalid={Boolean(errors.price)} aria-describedby={`${uid}-preco-dica`} onChange={(event) => setPrice(event.target.value)} />
        </Field>
        {!topping && (
          <Field id={`${uid}-grupo`} label="Grupo">
            <select id={`${uid}-grupo`} className={inputClass} value={kind} onChange={(event) => setKind(event.target.value as ToppingGroupId)}>
              {GROUP_CHOICES.map((option) => (
                <option key={option} value={option}>
                  {TOPPING_GROUPS[option].name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Availability available={available} onChange={setAvailable} />
        {topping && topping.priceCents > 0 && <p className="text-xs text-ink-soft">Preço atual: {formatBRL(topping.priceCents)}</p>}
        {submit.error && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 ring-1 ring-red-200">
            {submit.error}
          </p>
        )}
        <button type="submit" disabled={submit.busy} className={primaryButton}>
          {submit.busy ? 'Salvando…' : topping ? 'Salvar alterações' : 'Adicionar complemento'}
        </button>
        {topping && (
          <DangerZone
            busy={submit.busy}
            canDelete
            canRestore={isBase && saved !== undefined}
            onDelete={() => void submit.run(() => seller.save('toppings', topping.id, isBase ? { ...saved, deleted: true } : null))}
            onRestore={() => void submit.run(() => seller.save('toppings', topping.id, null))}
          />
        )}
      </form>
    </SellerDialog>
  )
}

/* Renomear uma seção (ou o grupo "Monte do seu jeito") */

function SectionForm({ id, onClose }: { id: string; onClose: () => void }) {
  const seller = useSellerMode()
  const uid = useId()
  const isGroup = id === 'monte'
  const drawer = isGroup ? undefined : drawerById(id as DrawerId)
  const saved = getCatalogChanges().sections[id]
  const [name, setName] = useState(isGroup ? MONTE_TITLE : (drawer?.title ?? ''))
  const [subtitle, setSubtitle] = useState(drawer?.subtitle ?? '')
  const [error, setError] = useState<string | null>(null)
  const submit = useSubmit(onClose)

  return (
    <SellerDialog title="Renomear categoria" titleId={`${uid}-titulo`} onClose={onClose}>
      <form
        noValidate
        className="flex flex-col gap-4 pb-2"
        onSubmit={(event) => {
          event.preventDefault()
          const form = event.currentTarget
          if (!name.trim()) return setError('Escreva o nome da categoria.')
          setError(null)
          void submit.run(async () => {
            const change: SectionChange = { name: name.trim(), ...(isGroup ? {} : { subtitle: subtitle.trim() }) }
            await seller.save('sections', id, change)
            closeDialog(form)
          })
        }}
      >
        <Field id={`${uid}-nome`} label="Nome da categoria" error={error}>
          <input id={`${uid}-nome`} className={inputClass} value={name} maxLength={60} onChange={(event) => setName(event.target.value)} />
        </Field>
        {!isGroup && (
          <Field id={`${uid}-subtitulo`} label="Subtítulo (opcional)">
            <input id={`${uid}-subtitulo`} className={inputClass} value={subtitle} maxLength={160} onChange={(event) => setSubtitle(event.target.value)} />
          </Field>
        )}
        {submit.error && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 ring-1 ring-red-200">
            {submit.error}
          </p>
        )}
        <button type="submit" disabled={submit.busy} className={primaryButton}>
          {submit.busy ? 'Salvando…' : 'Salvar nome'}
        </button>
        <DangerZone busy={submit.busy} canDelete={false} canRestore={saved !== undefined} onDelete={() => {}} onRestore={() => void submit.run(() => seller.save('sections', id, null))} />
      </form>
    </SellerDialog>
  )
}
