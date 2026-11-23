import { type FormEvent, useId, useState } from 'react'
import { Clock } from '../../components/ui/icons.tsx'
import { useStoreSettings } from '../catalog/catalogStore.ts'
import { atText, overrideFor } from '../store-hours/hours.ts'
import { serverNow } from '../store-hours/serverClock.ts'
import { storeStatusNow, useStoreStatus } from '../store-hours/useStoreStatus.ts'
import { DELIVERY_TIMES } from '../store/storeSettings.ts'
import { SellerDialog } from './SellerDialog.tsx'
import { useSellerMode } from './sellerModeContext.ts'
import { saveStore } from './storeSave.ts'
import { barButton, panelButton } from './sellerStyles.ts'


/**
 * Interruptor "Loja Aberta" / "Loja Fechada" (pedido de 2026-11-17, opção 1A): mostra o estado que
 * o cliente vê e, num toque, abre ou fecha a loja fora do horário. "Fechar" vale até a abertura do
 * dia seguinte; "Abrir" fora do horário vale até o fechamento (se abriu cedo) ou até as 5h.
 * Verde um tom mais escuro que o pedido, para o texto branco passar no contraste mínimo.
 */
export function StoreSwitch({ tone = 'dark' }: { tone?: 'dark' | 'light' } = {}) {
  const seller = useSellerMode()
  const status = useStoreStatus()
  const settings = useStoreSettings()
  const [state, setState] = useState<'idle' | 'saving' | 'failed'>('idle')
  const detailId = useId()

  const toggle = async () => {
    setState('saving')
    try {
      const current = storeStatusNow()
      await saveStore(seller, { override: overrideFor(current.open ? 'close' : 'open', serverNow(), settings.hours, settings.week) })
      setState('idle')
    } catch {
      setState('failed')
    }
  }

  const detail =
    state === 'failed'
      ? 'Não salvou. Toque de novo.'
      : status.manual
        ? `${status.open ? 'Aberta' : 'Fechada'} até ${atText(serverNow(), status.changesAt)}`
        : 'Pelo horário'

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        data-store-switch={status.open ? 'aberta' : 'fechada'}
        aria-describedby={detailId}
        disabled={state === 'saving'}
        onClick={() => void toggle()}
        className={`inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-extrabold text-white shadow-sm transition focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-orchid-400 disabled:cursor-wait disabled:opacity-70 ${
          status.open ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-red-600 hover:bg-red-700'
        }`}
      >
        <span aria-hidden="true" className="size-2.5 rounded-full bg-white" />
        {status.open ? 'Loja Aberta' : 'Loja Fechada'}
        <span className="sr-only">. Toque para {status.open ? 'fechar' : 'abrir'} a loja.</span>
      </button>
      <span id={detailId} data-store-switch-detail="" className={`text-xs ${tone === 'light' ? 'text-ink-soft' : 'text-white/85'}`}>
        {detail}
      </span>
    </div>
  )
}

/** "Tempo": o prazo de entrega do selo do topo, com 1 toque nas opções ou digitado. */
export function DeliveryTimeButton({ tone = 'dark' }: { tone?: 'dark' | 'light' } = {}) {
  const settings = useStoreSettings()
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" data-delivery-time="" aria-haspopup="dialog" className={tone === 'light' ? panelButton : barButton} onClick={() => setOpen(true)}>
        <Clock className="size-4" />
        <span>
          Tempo: <span className="nums">{settings.deliveryTime}</span>
        </span>
      </button>
      {open && <DeliveryTimeDialog onClose={() => setOpen(false)} />}
    </>
  )
}

function DeliveryTimeDialog({ onClose }: { onClose: () => void }) {
  const seller = useSellerMode()
  const settings = useStoreSettings()
  const uid = useId()
  const quick: readonly string[] = DELIVERY_TIMES
  const [custom, setCustom] = useState(quick.includes(settings.deliveryTime) ? '' : settings.deliveryTime)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const choose = async (time: string, from: HTMLElement) => {
    const value = time.trim().replace(/\s+/g, ' ')
    if (!value) return setMessage('Escreva o prazo, por exemplo 1 hora.')
    setBusy(true)
    try {
      await saveStore(seller, { deliveryTime: value })
      from.closest('dialog')?.close()
    } catch {
      setMessage('Não foi possível salvar. Confira a conexão e tente de novo.')
      setBusy(false)
    }
  }

  return (
    <SellerDialog
      title="Tempo de entrega"
      titleId={`${uid}-titulo`}
      description="Aparece no topo do site: “Aberto agora • Entrega: 30–45 min”."
      onClose={onClose}
    >
      <div className="flex flex-col gap-4 pb-2">
        <div role="group" aria-label="Prazos rápidos" className="grid grid-cols-2 gap-2">
          {quick.map((time) => (
            <button
              key={time}
              type="button"
              disabled={busy}
              aria-pressed={settings.deliveryTime === time}
              onClick={(event) => void choose(time, event.currentTarget)}
              className="nums inline-flex min-h-12 cursor-pointer flex-col items-center justify-center rounded-xl px-3 text-base font-bold text-acai-950 ring-1 ring-line transition hover:bg-acai-100 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800 aria-pressed:bg-orchid-100 aria-pressed:ring-2 aria-pressed:ring-orchid-400"
            >
              {time}
              {time === '30–45 min' && <span className="text-xs font-semibold text-ink-soft">padrão</span>}
            </button>
          ))}
        </div>
        <form
          noValidate
          className="flex flex-col gap-2"
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault()
            void choose(custom, event.currentTarget)
          }}
        >
          <label htmlFor={`${uid}-outro`} className="text-sm font-bold text-acai-950">
            Outro prazo
          </label>
          <input
            id={`${uid}-outro`}
            type="text"
            maxLength={30}
            placeholder="Ex.: 1 hora"
            value={custom}
            onChange={(event) => setCustom(event.target.value)}
            className="min-h-12 w-full rounded-xl bg-acai-50 px-4 text-base text-acai-950 ring-1 ring-line outline-none focus:bg-white focus:ring-2 focus:ring-acai-700"
          />
          {message && (
            <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 ring-1 ring-red-200">
              {message}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="btn-primary inline-flex min-h-12 cursor-pointer items-center justify-center rounded-xl px-5 font-extrabold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800 disabled:opacity-60"
          >
            Salvar prazo
          </button>
        </form>
      </div>
    </SellerDialog>
  )
}
