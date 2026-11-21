import { useState } from 'react'
import { formatBRL } from '../../utils/money.ts'
import { offerText } from '../offers/baseOffers.ts'
import { type Problem, validateOffer } from '../catalog/catalogValidation.ts'
import { freeId } from '../catalog/productDraft.ts'
import { type CatalogRecords, type OfferRecord, byPosition } from '../catalog/records.ts'
import { type OfferState, offerState } from '../catalog/recordsAdapter.ts'
import { SellerDialog } from '../seller/SellerDialog.tsx'
import { useNow, useWrite } from './adminData.ts'
import { dangerButton, describe, inputClass, moved, primaryButton, quietButton } from './adminKit.ts'
import { Chip, Field, MoneyInput, MoveButtons, SaveBar } from './adminUi.tsx'

const STATE_CHIP: Readonly<Record<OfferState, { tone: 'ok' | 'warn' | 'off' | 'info'; text: string }>> = {
  ativa: { tone: 'ok', text: 'Ativa' },
  pausada: { tone: 'warn', text: 'Pausada' },
  agendada: { tone: 'info', text: 'Agendada' },
  encerrada: { tone: 'off', text: 'Encerrada' },
  arquivada: { tone: 'off', text: 'Arquivada' },
}

/** "2026-11-21T15:00" (campo de data e hora) ↔ ISO. */
const toLocalInput = (iso: string | null) => {
  if (!iso) return ''
  const date = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
const fromLocalInput = (value: string) => (value ? new Date(value).toISOString() : null)

/** O preço do produto ou do tamanho, para o resumo da oferta. */
function regularPrice(records: CatalogRecords, offer: OfferRecord): number | null {
  const variants = records.variants.filter((variant) => variant.productId === offer.productId)
  if (offer.variantId) return variants.find((variant) => variant.id === offer.variantId)?.priceCents ?? null
  if (variants.length > 0) return Math.min(...variants.map((variant) => variant.priceCents))
  return records.products.find((product) => product.id === offer.productId)?.priceCents ?? null
}

/** Ofertas: a ordem decide qual vale quando duas mudam o preço do mesmo produto (a de cima). */
export function OffersPanel({ records }: { records: CatalogRecords }) {
  const [showArchived, setShowArchived] = useState(false)
  const [editing, setEditing] = useState<OfferRecord | null>(null)
  const [save, run] = useWrite()
  const now = useNow()
  const offers = byPosition(records.offers).filter((offer) => showArchived || offer.status !== 'arquivada')
  const productName = (id: string) => records.products.find((product) => product.id === id)?.name ?? id
  const firstProduct = byPosition(records.products.filter((product) => product.archivedAt === null))[0]?.id ?? ''

  return (
    <section aria-labelledby="titulo-ofertas" data-admin-offers>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="titulo-ofertas" className="font-display text-2xl font-black text-acai-800">
          Ofertas
        </h2>
        <button
          type="button"
          data-new-offer
          onClick={() =>
            setEditing({
              id: '',
              productId: firstProduct,
              variantId: null,
              title: '',
              subtitle: '',
              badgeEmoji: '🔥',
              badgeText: 'Oferta',
              promoPriceCents: null,
              position: records.offers.length,
              status: 'ativa',
              startsAt: null,
              endsAt: null,
            })
          }
          className={primaryButton}
        >
          + Nova oferta
        </button>
      </div>
      <p className="mt-1 text-sm text-ink-soft">
        As ofertas ativas aparecem no aviso flutuante do cardápio. Com preço promocional, o preço muda em todo o site e no pedido. Se duas ofertas mudam o preço do mesmo produto, vale a de cima.
      </p>
      <div className="mt-2">
        <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold text-acai-900">
          <input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} className="size-4 accent-acai-800" />
          Mostrar as arquivadas
        </label>
      </div>
      {save.state === 'error' && (
        <p role="alert" className="mt-3 rounded-xl bg-red-50 px-4 py-2 text-sm font-semibold text-red-800">
          {save.message}
        </p>
      )}
      <ol className="mt-3 flex flex-col gap-2">
        {offers.map((offer, index) => {
          const state = offerState(offer, now)
          const regular = regularPrice(records, offer)
          const variant = records.variants.find((entry) => entry.productId === offer.productId && entry.id === offer.variantId)
          return (
            <li key={offer.id} data-offer={offer.id} data-offer-state={state} className="flex flex-col gap-3 rounded-2xl bg-white p-4 ring-1 ring-line lg:flex-row lg:items-center">
              <div className="min-w-0 flex-1">
                <p className="font-bold break-words text-acai-900">
                  <span aria-hidden="true">{offer.badgeEmoji}</span> {offer.title} <Chip tone={STATE_CHIP[state].tone}>{STATE_CHIP[state].text}</Chip>
                </p>
                <p className="text-sm text-ink-soft">
                  {productName(offer.productId)}
                  {variant ? ` · ${variant.name}` : ''}
                  {offer.promoPriceCents !== null && regular !== null ? ` · de ${formatBRL(regular)} por ${formatBRL(offer.promoPriceCents)}` : ' · só o aviso, sem mudar o preço'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <MoveButtons label={offer.title} first={index === 0} last={index === offers.length - 1} busy={save.state === 'saving'} onMove={(step) => void run((writer) => writer.reorder('ofertas', moved(offers, index, step).map((entry) => entry.id)))} />
                {offer.status !== 'arquivada' && (
                  <button
                    type="button"
                    data-toggle-offer
                    disabled={save.state === 'saving'}
                    onClick={() => void run((writer) => writer.patch('catalog_offers', { id: offer.id }, { status: offer.status === 'ativa' ? 'pausada' : 'ativa' }))}
                    className={quietButton}
                  >
                    {offer.status === 'ativa' ? 'Pausar' : 'Ativar'}
                    <span className="sr-only">: {offer.title}</span>
                  </button>
                )}
                <button type="button" data-edit-offer onClick={() => setEditing(offer)} className={quietButton}>
                  Editar<span className="sr-only">: {offer.title}</span>
                </button>
              </div>
            </li>
          )
        })}
      </ol>
      {editing && <OfferEditor key={editing.id || 'nova'} offer={editing} records={records} onClose={() => setEditing(null)} />}
    </section>
  )
}

function OfferEditor({ offer, records, onClose }: { offer: OfferRecord; records: CatalogRecords; onClose: () => void }) {
  const [draft, setDraft] = useState(offer)
  const [base, setBase] = useState(offer)
  const [problems, setProblems] = useState<Problem[]>([])
  const [save, run, setSave] = useWrite()
  const isNew = offer.id === ''
  const error = (field: string) => problems.find((problem) => problem.field === field)?.message ?? null
  const set = (patch: Partial<OfferRecord>) => {
    setDraft((current) => ({ ...current, ...patch }))
    if (save.state !== 'saving') setSave({ state: 'idle' })
  }
  const products = byPosition(records.products.filter((product) => product.archivedAt === null || product.id === draft.productId))
  const variants = byPosition(records.variants.filter((variant) => variant.productId === draft.productId))
  const regular = regularPrice(records, draft)
  const price = draft.promoPriceCents !== null && regular !== null && draft.promoPriceCents < regular ? draft.promoPriceCents : regular

  const submit = async () => {
    const record = { ...draft, id: draft.id || freeId(draft.title, new Set(records.offers.map((entry) => entry.id))), title: draft.title.trim() }
    const found = validateOffer(record, records)
    setProblems(found)
    if (found.length > 0) return setSave({ state: 'error', message: found[0].message })
    if (await run((writer) => writer.saveOffer(record))) {
      setDraft(record)
      setBase(record)
      if (isNew) onClose()
    }
  }

  return (
    <SellerDialog title={isNew ? 'Nova oferta' : `Editar oferta: ${offer.title}`} titleId="titulo-editar-oferta" onClose={onClose} wide>
      <div className="flex flex-col gap-4" data-offer-editor>
        <Field id="oferta-titulo" label="Título" error={error('title')}>
          <input id="oferta-titulo" value={draft.title} maxLength={120} onChange={(event) => set({ title: event.target.value })} className={inputClass} {...describe('oferta-titulo', undefined, error('title'))} />
        </Field>
        <Field id="oferta-frase" label="Frase" hint="{preco} vira o preço; {preco_antigo}, o preço de antes." error={error('subtitle')}>
          <textarea id="oferta-frase" rows={2} value={draft.subtitle} maxLength={600} onChange={(event) => set({ subtitle: event.target.value })} className={`${inputClass} py-3`} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-[6rem_1fr]">
          <Field id="oferta-emoji" label="Emoji" error={error('badgeEmoji')}>
            <input id="oferta-emoji" value={draft.badgeEmoji} maxLength={16} onChange={(event) => set({ badgeEmoji: event.target.value })} className={inputClass} />
          </Field>
          <Field id="oferta-selo" label="Selo" error={error('badgeText')}>
            <input id="oferta-selo" value={draft.badgeText} maxLength={60} onChange={(event) => set({ badgeText: event.target.value })} className={inputClass} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="oferta-produto" label="Produto" error={error('productId')}>
            <select id="oferta-produto" value={draft.productId} onChange={(event) => set({ productId: event.target.value, variantId: null })} className={inputClass}>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </Field>
          <Field id="oferta-tamanho" label="Tamanho" hint={variants.length === 0 ? 'Este produto não tem tamanhos.' : 'Vazio: todos os tamanhos.'} error={error('variantId')}>
            <select id="oferta-tamanho" value={draft.variantId ?? ''} disabled={variants.length === 0} onChange={(event) => set({ variantId: event.target.value || null })} className={inputClass}>
              <option value="">Todos</option>
              {variants.map((variant) => (
                <option key={variant.id} value={variant.id}>
                  {variant.name} ({formatBRL(variant.priceCents)})
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field id="oferta-preco" label="Preço promocional" hint="Vazio: só o aviso, sem mudar o preço. Maior que o preço normal: não vale." error={error('promoPriceCents')}>
          <MoneyInput id="oferta-preco" optional cents={draft.promoPriceCents} onChange={(cents) => set({ promoPriceCents: cents })} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="oferta-inicio" label="Começa em" hint="Vazio: já começou.">
            <input id="oferta-inicio" type="datetime-local" value={toLocalInput(draft.startsAt)} onChange={(event) => set({ startsAt: fromLocalInput(event.target.value) })} className={inputClass} />
          </Field>
          <Field id="oferta-fim" label="Termina em" hint="Vazio: sem fim." error={error('endsAt')}>
            <input id="oferta-fim" type="datetime-local" value={toLocalInput(draft.endsAt)} onChange={(event) => set({ endsAt: fromLocalInput(event.target.value) })} className={inputClass} />
          </Field>
        </div>
        <Field id="oferta-situacao" label="Situação">
          <select id="oferta-situacao" value={draft.status} onChange={(event) => set({ status: event.target.value as OfferRecord['status'] })} className={inputClass}>
            <option value="ativa">Ativa (aparece dentro das datas)</option>
            <option value="pausada">Pausada</option>
            <option value="arquivada">Arquivada</option>
          </select>
        </Field>
        <div className="rounded-2xl bg-acai-50 p-4 ring-1 ring-line" data-offer-preview>
          <p className="text-xs font-bold text-ink-soft uppercase">Como aparece</p>
          <p className="mt-1 text-sm font-bold text-acai-900">
            <span aria-hidden="true">{draft.badgeEmoji}</span> {draft.badgeText}
          </p>
          <p className="font-bold text-acai-900">{draft.title || 'Título da oferta'}</p>
          <p className="text-sm text-acai-950">{offerText(draft.subtitle, { price: price === null ? '' : formatBRL(price), oldPrice: price !== null && regular !== null && price < regular ? formatBRL(regular) : null })}</p>
        </div>
        {!isNew && draft.status !== 'arquivada' && (
          <button type="button" data-archive-offer onClick={() => set({ status: 'arquivada' })} className={`${dangerButton} self-start`}>
            Marcar como arquivada
          </button>
        )}
        <SaveBar dirty={JSON.stringify(draft) !== JSON.stringify(base)} save={save} onSave={() => void submit()} onCancel={onClose} />
      </div>
    </SellerDialog>
  )
}
