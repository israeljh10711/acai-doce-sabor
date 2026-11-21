import { useId, useState } from 'react'
import { Plus, Trash } from '../../components/ui/icons.tsx'
import { useStoreSettings } from '../catalog/catalogStore.ts'
import type { DeliveryMode } from '../store/storeSettings.ts'
import { SellerDialog } from './SellerDialog.tsx'
import { formatPriceInput } from './sellerForm.ts'
import { useSellerMode } from './sellerModeContext.ts'
import { sellerInput, sellerPrimary } from './sellerStyles.ts'
import { type ZoneRow, readZones } from './storeForm.ts'
import { saveStore } from './storeSave.ts'

type Row = ZoneRow & { key: string }

const MODES: readonly { id: DeliveryMode; label: string; hint: string }[] = [
  { id: 'gratis', label: 'Entrega grátis (R$ 0,00)', hint: 'Não cobra frete em nenhum endereço.' },
  { id: 'taxas', label: 'Taxa fixa ou por bairro / região', hint: 'O cliente escolhe o bairro e o frete soma no total. Para taxa fixa, cadastre uma linha só (ex.: "Toda a cidade").' },
  { id: 'combinar', label: 'A combinar com o cliente', hint: 'Não soma frete no carrinho; o telefone passa a ser obrigatório e a loja liga para combinar o valor.' },
]

let rowCounter = 0
const rowKey = () => `zona-${++rowCounter}`

/**
 * "Entrega / Frete" do modo vendedor (pedido de 2026-11-17): entrega grátis, taxa fixa ou lista de
 * bairros/regiões com o valor de cada um, ou frete a combinar. Retirada na loja: sempre grátis.
 */
export function DeliverySettingsModal({ onClose }: { onClose: () => void }) {
  const seller = useSellerMode()
  const { delivery } = useStoreSettings()
  const uid = useId()
  const [mode, setMode] = useState<DeliveryMode>(delivery.mode)
  const [rows, setRows] = useState<Row[]>(() => {
    const saved = delivery.zones.map((zone) => ({ key: rowKey(), id: zone.id, name: zone.name, price: formatPriceInput(zone.feeCents) }))
    return saved.length > 0 ? saved : [{ key: rowKey(), name: '', price: '' }]
  })
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const update = (key: string, patch: Partial<ZoneRow>) => setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)))

  return (
    <SellerDialog
      title="Entrega / Frete"
      titleId={`${uid}-titulo`}
      description="Retirada na loja fica sempre disponível e grátis para o cliente."
      onClose={onClose}
      wide
    >
      <form
        noValidate
        className="flex flex-col gap-4 pb-2"
        onSubmit={async (event) => {
          event.preventDefault()
          const form = event.currentTarget
          const read = readZones(mode === 'taxas' ? rows : [])
          if (!read.ok) return setProblem(read.problem)
          setProblem(null)
          setBusy(true)
          try {
            // Fora do modo de taxas, a lista guardada continua (volta se o vendedor voltar ao modo).
            await saveStore(seller, { delivery: { mode, zones: mode === 'taxas' ? read.zones : delivery.zones } })
            form.closest('dialog')?.close()
          } catch {
            setProblem('Não foi possível salvar. Confira a conexão e tente de novo.')
            setBusy(false)
          }
        }}
      >
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-bold text-acai-950">Como cobrar a entrega</legend>
          {MODES.map((option) => (
            <label
              key={option.id}
              className={`flex cursor-pointer gap-3 rounded-xl p-3 ring-1 transition has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-acai-800 ${
                mode === option.id ? 'bg-gold-100 ring-2 ring-gold-400' : 'ring-line hover:bg-acai-50'
              }`}
            >
              <input
                type="radio"
                name={`${uid}-modo`}
                value={option.id}
                checked={mode === option.id}
                onChange={() => setMode(option.id)}
                className="mt-1 size-4 shrink-0 accent-acai-800"
              />
              <span>
                <span className="block font-bold text-acai-950">{option.label}</span>
                <span className="block text-sm text-ink-soft">{option.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>

        {mode === 'taxas' && (
          <fieldset className="flex flex-col gap-2" data-zones="">
            <legend className="mb-1 text-sm font-bold text-acai-950">Bairros / regiões e valores</legend>
            {rows.map((row, index) => (
              <div key={row.key} className="grid grid-cols-[minmax(0,1fr)_6.5rem_auto] items-end gap-2">
                <label className="flex flex-col gap-1 text-xs font-semibold text-acai-950">
                  Bairro ou região
                  <input
                    data-zone-name={index}
                    type="text"
                    maxLength={40}
                    placeholder="Ex.: Centro"
                    value={row.name}
                    onChange={(event) => update(row.key, { name: event.target.value })}
                    className={sellerInput}
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-semibold text-acai-950">
                  Valor (R$)
                  <input
                    data-zone-price={index}
                    type="text"
                    inputMode="decimal"
                    placeholder="3,00"
                    value={row.price}
                    onChange={(event) => update(row.key, { price: event.target.value })}
                    className={`${sellerInput} nums`}
                  />
                </label>
                <button
                  type="button"
                  aria-label={`Excluir ${row.name.trim() || 'este bairro'}`}
                  onClick={() => setRows((current) => current.filter((candidate) => candidate.key !== row.key))}
                  className="grid size-12 cursor-pointer place-items-center rounded-xl text-red-800 ring-1 ring-red-800/30 transition hover:bg-red-50 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-red-800"
                >
                  <Trash className="size-5" />
                </button>
              </div>
            ))}
            <button
              type="button"
              data-add-zone=""
              onClick={() => setRows((current) => [...current, { key: rowKey(), name: '', price: '' }])}
              className="inline-flex min-h-11 w-fit cursor-pointer items-center gap-1.5 rounded-xl px-3 text-sm font-bold text-acai-800 ring-1 ring-acai-800/30 transition hover:bg-acai-100 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800"
            >
              <Plus className="size-4" />
              Adicionar bairro/taxa
            </button>
            <p className="text-xs text-ink-soft">
              O cliente que não achar o bairro na lista escolhe "Outro bairro" e a taxa fica a combinar. Sem nenhum bairro, a entrega fica a combinar.
            </p>
          </fieldset>
        )}

        {problem && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 ring-1 ring-red-200">
            {problem}
          </p>
        )}
        <button type="submit" disabled={busy} className={sellerPrimary}>
          {busy ? 'Salvando…' : 'Salvar entrega'}
        </button>
      </form>
    </SellerDialog>
  )
}
