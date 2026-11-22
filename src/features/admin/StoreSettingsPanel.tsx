import { useMemo, useState } from 'react'
import { formatBRL } from '../../utils/money.ts'
import { formatBrazilPhone } from '../../utils/whatsapp.ts'
import { useStoreSettings } from '../catalog/catalogStore.ts'
import { effectiveStatus, overrideFor, scheduleText } from '../store-hours/hours.ts'
import { serverNow } from '../store-hours/serverClock.ts'
import {
  DELIVERY_TIMES,
  type DaySchedule,
  type DeliveryMode,
  MAX_PERIODS,
  MAX_ZONES,
  PAYMENT_LABELS,
  PIX_TYPE_LABELS,
  type PaymentId,
  type PixKeyType,
  type StoreSettings,
  type StoreSettingsChange,
  WEEKDAY_NAMES,
  parseStoreSettingsChange,
  pixKeyProblem,
} from '../store/storeSettings.ts'
import { readContact, readHours, readZones, timeInput, withSavedZoneIds } from '../seller/storeForm.ts'
import { saveStore } from '../seller/storeSave.ts'
import { useSellerMode } from '../seller/sellerModeContext.ts'
import { formatPriceInput } from '../seller/sellerForm.ts'
import { useHashScroll } from '../../hooks/useHashScroll.ts'
import { dangerButton, inputClass, labelClass, quietButton, SAVE_ERROR_TEXT, type SaveState } from './adminKit.ts'
import { Field, SaveBar, Switch } from './adminUi.tsx'

type ZoneForm = { key: string; id?: string; name: string; price: string; active: boolean }
type PeriodForm = { open: string; close: string }
type DayForm = { open: boolean; periods: PeriodForm[] }

type Form = {
  name: string
  subtitle: string
  slogan: string
  phone: string
  instagram: string
  whatsapp: string
  street: string
  city: string
  uf: string
  pixEnabled: boolean
  pixType: PixKeyType
  pixKey: string
  pixHolder: string
  payments: Record<PaymentId, boolean>
  mode: DeliveryMode
  zones: ZoneForm[]
  deliveryTime: string
  closedOrders: StoreSettings['closedOrders']
  sameEveryDay: boolean
  open: string
  close: string
  week: DayForm[]
}

let zoneCounter = 0
const zoneKey = () => `bairro-${++zoneCounter}`

function formOf(settings: StoreSettings): Form {
  const daily = { open: timeInput(settings.hours.opensAt), close: timeInput(settings.hours.closesAt) }
  return {
    ...settings.identity,
    ...settings.contact,
    pixEnabled: settings.pix.enabled,
    pixType: settings.pix.type,
    pixKey: settings.pix.key,
    pixHolder: settings.pix.holder,
    payments: { ...settings.payments },
    mode: settings.delivery.mode,
    zones: settings.delivery.zones.map((zone) => ({ key: zoneKey(), id: zone.id, name: zone.name, price: formatPriceInput(zone.feeCents), active: zone.active !== false })),
    deliveryTime: settings.deliveryTime,
    closedOrders: settings.closedOrders,
    sameEveryDay: settings.week === null,
    ...daily,
    week: (settings.week ?? Array.from({ length: 7 }, (): DaySchedule => ({ open: true, periods: [settings.hours] }))).map((day) => ({
      open: day.open,
      periods: (day.periods.length > 0 ? day.periods : [settings.hours]).map((period) => ({ open: timeInput(period.opensAt), close: timeInput(period.closesAt) })),
    })),
  }
}

type Read = { ok: true; change: StoreSettingsChange } | { ok: false; problems: Record<string, string> }

/** O formulário → a mudança guardada, com os avisos de cada campo. */
function readForm(form: Form): Read {
  const problems: Record<string, string> = {}
  const contact = readContact({ whatsapp: form.whatsapp, street: form.street, city: form.city, uf: form.uf })
  if (!contact.ok) for (const [field, message] of Object.entries(contact.problems)) problems[field] = message
  if (!form.name.trim()) problems.name = 'Escreva o nome da loja.'
  const phone = form.phone.trim() === '' ? '' : formatBrazilPhone(form.phone)
  if (phone === null) problems.phone = 'Telefone com DDD, por exemplo (83) 3333-4444.'
  if (form.instagram.trim() && !/^@?[A-Za-z0-9._]{1,30}$/.test(form.instagram.trim())) problems.instagram = 'Só o nome do perfil, sem espaços (ex.: acaiidocesabor).'
  if (form.pixEnabled) {
    const keyProblem = pixKeyProblem(form.pixType, form.pixKey)
    if (keyProblem) problems.pixKey = keyProblem
    if (!form.pixHolder.trim()) problems.pixHolder = 'Escreva o nome do titular, como o banco mostra.'
  }
  const payments = { ...form.payments, pix: form.payments.pix && form.pixEnabled }
  if (!payments.pix && !payments.dinheiro && !payments.cartao) problems.payments = 'Deixe pelo menos uma forma de pagamento ligada.'
  const zones = readZones(form.zones)
  if (!zones.ok) problems.zones = zones.problem
  if (form.mode === 'taxas' && zones.ok && !form.zones.some((zone) => zone.active && zone.name.trim())) problems.zones = 'Com taxa por bairro, deixe pelo menos um bairro ligado.'
  const hours = readHours(form.open, form.close)
  if (form.sameEveryDay && !hours.ok) problems.hours = hours.problem
  const week = form.week.map((day, index) => {
    const periods = day.periods.map((period) => readHours(period.open, period.close))
    const bad = periods.find((period) => !period.ok)
    if (!form.sameEveryDay && day.open && bad && !bad.ok) problems[`dia-${index}`] = bad.problem
    const read = periods.flatMap((period) => (period.ok ? [period.hours] : [])).sort((a, b) => a.opensAt - b.opensAt)
    if (!form.sameEveryDay && day.open && read.some((period, at) => at > 0 && period.opensAt < read[at - 1].closesAt)) problems[`dia-${index}`] = 'Os períodos do dia não podem se sobrepor.'
    return { open: day.open, periods: day.open ? read : [] }
  })
  if (Object.keys(problems).length > 0) return { ok: false, problems }
  const change: StoreSettingsChange = {
    identity: { name: form.name.trim(), subtitle: form.subtitle.trim(), slogan: form.slogan.trim(), phone: phone ?? '', instagram: form.instagram.trim().replace(/^@/, '') },
    contact: contact.ok ? contact.contact : undefined,
    pix: { enabled: form.pixEnabled, type: form.pixType, key: form.pixKey.trim(), holder: form.pixHolder.trim() },
    payments,
    delivery: { mode: form.mode, zones: zones.ok ? zones.zones.map((zone, index) => ({ ...zone, ...(form.zones.filter((entry) => entry.name.trim() || entry.price.trim())[index]?.active === false ? { active: false } : {}) })) : [] },
    deliveryTime: form.deliveryTime.trim() || DELIVERY_TIMES[1],
    closedOrders: form.closedOrders,
    week: form.sameEveryDay ? null : week,
    ...(hours.ok ? { hours: hours.hours } : {}),
  }
  // A leitura do banco decide o que vale: o que ela recusaria não é salvo. Se ela tiraria algum
  // bairro, avisa em vez de salvar sem ele (achado da auditoria E2E, 2026-11-21).
  const parsed = parseStoreSettingsChange(change)
  if ((parsed.delivery?.zones.length ?? 0) !== (change.delivery?.zones.length ?? 0)) {
    return { ok: false, problems: { zones: 'Não foi possível salvar algum bairro. Confira os nomes e os valores.' } }
  }
  return { ok: true, change: { ...change, ...parsed } }
}

/** Configurações da loja: identidade, Pix, formas de pagamento, entrega e horário. */
export function StoreSettingsPanel() {
  const seller = useSellerMode()
  const settings = useStoreSettings()
  const initial = useMemo(() => formOf(settings), [settings])
  const [form, setForm] = useState(initial)
  const [base, setBase] = useState(initial)
  const [problems, setProblems] = useState<Record<string, string>>({})
  const [save, setSave] = useState<SaveState>({ state: 'idle' })
  const [switching, setSwitching] = useState(false)
  const dirty = JSON.stringify(form) !== JSON.stringify(base)
  // Chegaram configurações mais novas (leitura do banco) e o vendedor ainda não mexeu: o formulário
  // passa a mostrar as novas, para o salvar não gravar uma cópia velha por cima (2026-11-21).
  const [seen, setSeen] = useState(initial)
  if (seen !== initial) {
    setSeen(initial)
    if (!dirty) {
      setForm(initial)
      setBase(initial)
    }
  }
  const set = (patch: Partial<Form>) => {
    setForm((current) => ({ ...current, ...patch }))
    if (save.state !== 'saving') setSave({ state: 'idle' })
  }
  const status = effectiveStatus(serverNow(), settings)
  // "Entrega / Frete" e "Horários e Contato" da faixa do vendedor levam direto à seção.
  useHashScroll()

  const submit = async () => {
    const read = readForm(form)
    if (!read.ok) {
      setProblems(read.problems)
      setSave({ state: 'error', message: Object.values(read.problems)[0] ?? SAVE_ERROR_TEXT })
      return
    }
    setProblems({})
    setSave({ state: 'saving' })
    try {
      await saveStore(seller, read.change)
      // Os bairros novos ficam com o id gravado: o próximo salvar mantém o mesmo bairro (2026-11-21).
      const savedForm = { ...form, zones: withSavedZoneIds(form.zones, read.change.delivery?.zones ?? []) }
      setForm((current) => (current === form ? savedForm : current))
      setBase(savedForm)
      setSave({ state: 'saved' })
    } catch {
      setSave({ state: 'error', message: SAVE_ERROR_TEXT })
    }
  }

  const switchStore = async (action: 'open' | 'close' | 'normal') => {
    setSwitching(true)
    try {
      await saveStore(seller, { override: action === 'normal' ? null : overrideFor(action, serverNow(), settings.hours, settings.week) })
    } catch {
      setSave({ state: 'error', message: SAVE_ERROR_TEXT })
    } finally {
      setSwitching(false)
    }
  }

  const text = (field: keyof Form, label: string, options: { hint?: string; max?: number; inputMode?: 'tel' | 'text' } = {}) => (
    <Field id={`loja-${field}`} label={label} hint={options.hint} error={problems[field]}>
      <input
        id={`loja-${field}`}
        value={form[field] as string}
        maxLength={options.max ?? 120}
        inputMode={options.inputMode}
        onChange={(event) => set({ [field]: event.target.value } as Partial<Form>)}
        className={inputClass}
        aria-invalid={problems[field] ? true : undefined}
      />
    </Field>
  )
  const section = 'flex flex-col gap-4 rounded-3xl bg-white p-5 ring-1 ring-line'
  const title = 'font-display text-xl font-extrabold text-acai-800'

  return (
    <div data-admin-store className="flex flex-col gap-5">
      <h2 className="font-display text-2xl font-black text-acai-800">Configurações da loja</h2>

      <section aria-labelledby="loja-identidade" className={section}>
        <h3 id="loja-identidade" className={title}>
          Identidade
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {text('name', 'Nome da loja', { max: 60 })}
          {text('subtitle', 'Subtítulo', { hint: 'Ex.: Açaí e milk-shake em Teixeira, PB' })}
          {text('slogan', 'Slogan')}
          {text('instagram', 'Instagram', { hint: 'Só o perfil, sem o @.', max: 31 })}
          {text('street', 'Rua e número', { max: 80 })}
          <div className="grid grid-cols-[1fr_5rem] gap-3">
            {text('city', 'Cidade', { max: 60 })}
            {text('uf', 'UF', { max: 2 })}
          </div>
          {text('whatsapp', 'WhatsApp da loja', { hint: 'Atendimento e dúvidas dos clientes.', inputMode: 'tel', max: 20 })}
          {text('phone', 'Telefone', { hint: 'Opcional.', inputMode: 'tel', max: 20 })}
        </div>
      </section>

      <section aria-labelledby="loja-pix" className={section}>
        <h3 id="loja-pix" className={title}>
          Pix
        </h3>
        <Switch checked={form.pixEnabled} onChange={(pixEnabled) => set({ pixEnabled })} label="Aceitar Pix" description="Desligado: o Pix some do carrinho e o servidor recusa pedido em Pix." />
        {form.pixEnabled && (
          <div className="grid gap-4 sm:grid-cols-3">
            <Field id="loja-pixType" label="Tipo da chave">
              <select id="loja-pixType" value={form.pixType} onChange={(event) => set({ pixType: event.target.value as PixKeyType })} className={inputClass}>
                {(Object.keys(PIX_TYPE_LABELS) as PixKeyType[]).map((type) => (
                  <option key={type} value={type}>
                    {PIX_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </Field>
            {text('pixKey', 'Chave Pix', { max: 80 })}
            {text('pixHolder', 'Nome do titular', { hint: 'Como o banco mostra ao cliente.', max: 80 })}
          </div>
        )}
      </section>

      <section aria-labelledby="loja-pagamento" className={section}>
        <h3 id="loja-pagamento" className={title}>
          Formas de pagamento
        </h3>
        <div className="flex flex-wrap gap-x-6">
          {(Object.keys(PAYMENT_LABELS) as PaymentId[]).map((id) => (
            <Switch key={id} name={`pagamento-${id}`} checked={form.payments[id] && (id !== 'pix' || form.pixEnabled)} onChange={(on) => set({ payments: { ...form.payments, [id]: on } })} label={PAYMENT_LABELS[id]} />
          ))}
        </div>
        {problems.payments && (
          <p role="alert" className="text-sm font-semibold text-red-700">
            {problems.payments}
          </p>
        )}
      </section>

      <section aria-labelledby="loja-entrega" className={section}>
        <h3 id="loja-entrega" className={title}>
          Entrega
        </h3>
        <fieldset className="flex flex-col gap-2">
          <legend className={labelClass}>Frete</legend>
          {(
            [
              ['gratis', 'Entrega grátis'],
              ['taxas', 'Taxa por bairro'],
              ['combinar', 'A combinar com o cliente'],
            ] as const
          ).map(([mode, label]) => (
            <label key={mode} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold text-acai-900">
              <input type="radio" name="loja-frete" value={mode} checked={form.mode === mode} onChange={() => set({ mode })} className="size-4 accent-acai-800" />
              {label}
            </label>
          ))}
        </fieldset>
        {form.mode === 'taxas' && (
          <div className="flex flex-col gap-2" data-zones>
            <p className="text-sm text-ink-soft">O cliente de um bairro fora da lista escolhe "Outro bairro" e o frete fica a combinar.</p>
            {form.zones.map((zone, index) => (
              <div key={zone.key} data-zone={index} className="grid gap-2 rounded-2xl bg-acai-50/60 p-3 ring-1 ring-line sm:grid-cols-[1fr_9rem_auto_auto] sm:items-center">
                <label className="sr-only" htmlFor={`bairro-${index}-nome`}>
                  Bairro {index + 1}
                </label>
                <input id={`bairro-${index}-nome`} value={zone.name} maxLength={40} placeholder="Bairro" onChange={(event) => set({ zones: form.zones.map((entry, at) => (at === index ? { ...entry, name: event.target.value } : entry)) })} className={inputClass} />
                <label className="sr-only" htmlFor={`bairro-${index}-taxa`}>
                  Taxa do bairro {index + 1}
                </label>
                <input id={`bairro-${index}-taxa`} inputMode="decimal" value={zone.price} placeholder="R$ 0,00" onChange={(event) => set({ zones: form.zones.map((entry, at) => (at === index ? { ...entry, price: event.target.value } : entry)) })} className={inputClass} />
                <Switch checked={zone.active} onChange={(active) => set({ zones: form.zones.map((entry, at) => (at === index ? { ...entry, active } : entry)) })} label="Ligado" />
                <button type="button" onClick={() => set({ zones: form.zones.filter((_, at) => at !== index) })} className={`${dangerButton} min-h-10`}>
                  Remover<span className="sr-only">: {zone.name}</span>
                </button>
              </div>
            ))}
            {problems.zones && (
              <p role="alert" className="text-sm font-semibold text-red-700">
                {problems.zones}
              </p>
            )}
            <button type="button" data-add-zone disabled={form.zones.length >= MAX_ZONES} onClick={() => set({ zones: [...form.zones, { key: zoneKey(), name: '', price: '', active: true }] })} className={`${quietButton} self-start`}>
              + Adicionar bairro
            </button>
          </div>
        )}
        <Field id="loja-deliveryTime" label="Tempo de entrega" hint={`Ex.: ${DELIVERY_TIMES.join(', ')}.`}>
          <input id="loja-deliveryTime" list="tempos-entrega" value={form.deliveryTime} maxLength={30} onChange={(event) => set({ deliveryTime: event.target.value })} className={inputClass} />
        </Field>
        <datalist id="tempos-entrega">
          {DELIVERY_TIMES.map((time) => (
            <option key={time} value={time} />
          ))}
        </datalist>
        {form.mode === 'taxas' && form.zones.some((zone) => zone.active && zone.name) && (
          <p className="text-sm text-ink-soft">
            Bairros ligados: {form.zones.filter((zone) => zone.active && zone.name).map((zone) => `${zone.name} (${zone.price ? `R$ ${zone.price}` : formatBRL(0)})`).join(', ')}.
          </p>
        )}
      </section>

      <section aria-labelledby="loja-horario" className={section}>
        <h3 id="loja-horario" className={title}>
          Horário
        </h3>
        <p className="text-sm text-ink-soft">
          Agora: <span className="font-bold text-acai-900">{status.open ? 'aberta' : 'fechada'}</span> · {scheduleText(settings)}
        </p>
        <Switch checked={form.sameEveryDay} onChange={(sameEveryDay) => set({ sameEveryDay })} label="Mesmo horário todos os dias" description="Desligado: um horário para cada dia, com até 3 períodos (ex.: almoço e noite)." />
        {form.sameEveryDay ? (
          <div className="grid max-w-md grid-cols-2 gap-3">
            <Field id="loja-open" label="Abre às" error={problems.hours}>
              <input id="loja-open" type="time" value={form.open} onChange={(event) => set({ open: event.target.value })} className={inputClass} />
            </Field>
            <Field id="loja-close" label="Fecha às" hint="00:00 é meia-noite.">
              <input id="loja-close" type="time" value={form.close} onChange={(event) => set({ close: event.target.value })} className={inputClass} />
            </Field>
          </div>
        ) : (
          <ol className="flex flex-col gap-2" data-week>
            {form.week.map((day, index) => (
              <li key={WEEKDAY_NAMES[index]} data-day={index} className="flex flex-col gap-2 rounded-2xl bg-acai-50/60 p-3 ring-1 ring-line">
                <Switch checked={day.open} onChange={(open) => set({ week: form.week.map((entry, at) => (at === index ? { ...entry, open } : entry)) })} label={WEEKDAY_NAMES[index].charAt(0).toUpperCase() + WEEKDAY_NAMES[index].slice(1)} description={day.open ? undefined : 'Fechado'} />
                {day.open && (
                  <div className="flex flex-col gap-2">
                    {day.periods.map((period, at) => (
                      <div key={at} className="flex flex-wrap items-end gap-2">
                        <label className="flex flex-col gap-1 text-xs font-bold text-acai-900">
                          Abre
                          <input type="time" value={period.open} onChange={(event) => set({ week: form.week.map((entry, n) => (n === index ? { ...entry, periods: entry.periods.map((p, k) => (k === at ? { ...p, open: event.target.value } : p)) } : entry)) })} className={`${inputClass} w-32`} />
                        </label>
                        <label className="flex flex-col gap-1 text-xs font-bold text-acai-900">
                          Fecha
                          <input type="time" value={period.close} onChange={(event) => set({ week: form.week.map((entry, n) => (n === index ? { ...entry, periods: entry.periods.map((p, k) => (k === at ? { ...p, close: event.target.value } : p)) } : entry)) })} className={`${inputClass} w-32`} />
                        </label>
                        {day.periods.length > 1 && (
                          <button type="button" onClick={() => set({ week: form.week.map((entry, n) => (n === index ? { ...entry, periods: entry.periods.filter((_, k) => k !== at) } : entry)) })} className={`${dangerButton} min-h-10`}>
                            Tirar período
                          </button>
                        )}
                      </div>
                    ))}
                    {day.periods.length < MAX_PERIODS && (
                      <button type="button" onClick={() => set({ week: form.week.map((entry, n) => (n === index ? { ...entry, periods: [...entry.periods, { open: '18:00', close: '23:00' }] } : entry)) })} className={`${quietButton} self-start`}>
                        + Outro período
                      </button>
                    )}
                    {problems[`dia-${index}`] && (
                      <p role="alert" className="text-sm font-semibold text-red-700">
                        {problems[`dia-${index}`]}
                      </p>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
        <fieldset className="flex flex-col gap-2">
          <legend className={labelClass}>Com a loja fechada</legend>
          {(
            [
              ['antecipado', 'Aceitar pedido antecipado (preparado quando abrir)'],
              ['bloquear', 'Não aceitar pedidos'],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold text-acai-900">
              <input type="radio" name="loja-fechada" value={value} checked={form.closedOrders === value} onChange={() => set({ closedOrders: value })} className="size-4 accent-acai-800" />
              {label}
            </label>
          ))}
        </fieldset>
        <div className="rounded-2xl bg-acai-50 p-4 ring-1 ring-line" data-store-switch>
          <p className="text-sm font-bold text-acai-900">Fechamento temporário</p>
          <p className="mt-1 text-sm text-ink-soft">
            {settings.override ? `Agora vale a exceção: ${settings.override.state === 'open' ? 'aberta' : 'fechada'} até ${new Date(settings.override.until).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}.` : 'Sem exceção: vale o horário.'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" data-store-close disabled={switching} onClick={() => void switchStore('close')} className={dangerButton}>
              Fechar agora (até a próxima abertura)
            </button>
            <button type="button" data-store-open disabled={switching} onClick={() => void switchStore('open')} className={quietButton}>
              Abrir agora
            </button>
            {settings.override && (
              <button type="button" data-store-normal disabled={switching} onClick={() => void switchStore('normal')} className={quietButton}>
                Voltar ao horário
              </button>
            )}
          </div>
        </div>
      </section>

      <SaveBar dirty={dirty} save={save} onSave={() => void submit()} inDialog={false} />
    </div>
  )
}
