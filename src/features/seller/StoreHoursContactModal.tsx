import { type ReactNode, useId, useState } from 'react'
import { useStoreSettings } from '../catalog/catalogStore.ts'
import type { ClosedOrders, StoreContact } from '../store/storeSettings.ts'
import { SellerDialog } from './SellerDialog.tsx'
import { useSellerMode } from './sellerModeContext.ts'
import { sellerInput, sellerPrimary } from './sellerStyles.ts'
import { type ContactField, readContact, readHours, timeInput } from './storeForm.ts'
import { saveStore } from './storeSave.ts'

/**
 * "Horários e Contato" do modo vendedor (pedido de 2026-11-17): o horário automático de todos os
 * dias, o que fazer com pedidos quando a loja está fechada e o contato da loja (o WhatsApp que
 * recebe os pedidos e o endereço do aviso de loja fechada e do rodapé).
 */
export function StoreHoursContactModal({ onClose }: { onClose: () => void }) {
  const seller = useSellerMode()
  const settings = useStoreSettings()
  const uid = useId()
  const [open, setOpen] = useState(timeInput(settings.hours.opensAt))
  const [close, setClose] = useState(timeInput(settings.hours.closesAt))
  const [closedOrders, setClosedOrders] = useState<ClosedOrders>(settings.closedOrders)
  const [contact, setContact] = useState<StoreContact>(settings.contact)
  const [hoursProblem, setHoursProblem] = useState<string | null>(null)
  const [contactProblems, setContactProblems] = useState<Partial<Record<ContactField, string>>>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const field = (name: ContactField) => `${uid}-${name}`
  const invalid = (name: ContactField) =>
    contactProblems[name] ? { 'aria-invalid': true as const, 'aria-describedby': `${field(name)}-erro` } : {}

  return (
    <SellerDialog
      title="Horários e Contato"
      titleId={`${uid}-titulo`}
      description="O horário abre e fecha a loja sozinho todos os dias. O botão Loja Aberta / Fechada é para as exceções."
      onClose={onClose}
      wide
    >
      <form
        noValidate
        className="flex flex-col gap-5 pb-2"
        onSubmit={async (event) => {
          event.preventDefault()
          const form = event.currentTarget
          const hours = readHours(open, close)
          const readContactResult = readContact(contact)
          setHoursProblem(hours.ok ? null : hours.problem)
          setContactProblems(readContactResult.ok ? {} : readContactResult.problems)
          if (!hours.ok || !readContactResult.ok) return
          setError(null)
          setBusy(true)
          try {
            await saveStore(seller, { hours: hours.hours, closedOrders, contact: readContactResult.contact })
            form.closest('dialog')?.close()
          } catch {
            setError('Não foi possível salvar. Confira a conexão e tente de novo.')
            setBusy(false)
          }
        }}
      >
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-bold text-acai-950">Horário de funcionamento (todos os dias)</legend>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm font-semibold text-acai-950">
              Abre às
              <input
                data-hours="abre"
                type="time"
                step={900}
                value={open}
                onChange={(event) => setOpen(event.target.value)}
                aria-invalid={hoursProblem ? true : undefined}
                className={`${sellerInput} nums`}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold text-acai-950">
              Fecha às
              <input
                data-hours="fecha"
                type="time"
                step={900}
                value={close}
                onChange={(event) => setClose(event.target.value)}
                aria-invalid={hoursProblem ? true : undefined}
                className={`${sellerInput} nums`}
              />
            </label>
          </div>
          <p className="text-xs text-ink-soft">Para fechar à meia-noite, use 00:00. A abertura vale a partir das 05:00.</p>
          {hoursProblem && (
            <p role="alert" className="text-sm font-bold text-red-800">
              {hoursProblem}
            </p>
          )}
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-bold text-acai-950">Com a loja fechada</legend>
          {(
            [
              ['antecipado', 'Aceitar como pedido antecipado', 'O cliente envia e a comanda chega marcada como "Pedido antecipado".'],
              ['bloquear', 'Bloquear o envio', 'O botão de enviar fica desligado até a loja abrir.'],
            ] as const
          ).map(([value, label, hint]) => (
            <label
              key={value}
              className={`flex cursor-pointer gap-3 rounded-xl p-3 ring-1 transition has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-acai-800 ${
                closedOrders === value ? 'bg-gold-100 ring-2 ring-gold-400' : 'ring-line hover:bg-acai-50'
              }`}
            >
              <input
                type="radio"
                name={`${uid}-fechada`}
                value={value}
                checked={closedOrders === value}
                onChange={() => setClosedOrders(value)}
                className="mt-1 size-4 shrink-0 accent-acai-800"
              />
              <span>
                <span className="block font-bold text-acai-950">{label}</span>
                <span className="block text-sm text-ink-soft">{hint}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-sm font-bold text-acai-950">Contato da loja</legend>
          <ContactInput id={field('whatsapp')} label="WhatsApp (recebe os pedidos)" problem={contactProblems.whatsapp}>
            <input
              id={field('whatsapp')}
              type="tel"
              inputMode="tel"
              maxLength={20}
              value={contact.whatsapp}
              onChange={(event) => setContact({ ...contact, whatsapp: event.target.value })}
              className={`${sellerInput} nums`}
              {...invalid('whatsapp')}
            />
          </ContactInput>
          <ContactInput id={field('street')} label="Endereço (rua e número)" problem={contactProblems.street}>
            <input
              id={field('street')}
              type="text"
              maxLength={80}
              value={contact.street}
              onChange={(event) => setContact({ ...contact, street: event.target.value })}
              className={sellerInput}
              {...invalid('street')}
            />
          </ContactInput>
          <div className="grid grid-cols-[minmax(0,1fr)_5.5rem] gap-3">
            <ContactInput id={field('city')} label="Cidade" problem={contactProblems.city}>
              <input
                id={field('city')}
                type="text"
                maxLength={60}
                value={contact.city}
                onChange={(event) => setContact({ ...contact, city: event.target.value })}
                className={sellerInput}
                {...invalid('city')}
              />
            </ContactInput>
            <ContactInput id={field('uf')} label="UF" problem={contactProblems.uf}>
              <input
                id={field('uf')}
                type="text"
                maxLength={2}
                value={contact.uf}
                onChange={(event) => setContact({ ...contact, uf: event.target.value })}
                className={`${sellerInput} uppercase`}
                {...invalid('uf')}
              />
            </ContactInput>
          </div>
        </fieldset>

        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 ring-1 ring-red-200">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy} className={sellerPrimary}>
          {busy ? 'Salvando…' : 'Salvar horários e contato'}
        </button>
      </form>
    </SellerDialog>
  )
}

function ContactInput({ id, label, problem, children }: { id: string; label: string; problem?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-semibold text-acai-950">
        {label}
      </label>
      {children}
      {problem && (
        <p id={`${id}-erro`} role="alert" className="text-sm font-bold text-red-800">
          {problem}
        </p>
      )}
    </div>
  )
}
