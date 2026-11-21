/**
 * "Lembrar meus dados neste dispositivo" (2026-11-21): nome, telefone e endereço do cliente no
 * `localStorage`, para a próxima compra, só quando ele marca a opção. Desmarcar apaga.
 *
 * Fica de fora: a modalidade (cada pedido escolhe a sua), o GPS (nunca é guardado), o pagamento,
 * a sessão de acompanhamento e qualquer token. Os dados lembrados só preenchem o formulário: não
 * confirmam identidade nem endereço, e o cliente pode mudar tudo antes de finalizar.
 */
import { type CustomerDraft, EMPTY_CUSTOMER, parseCustomerDraft } from './delivery.ts'

export const REMEMBERED_KEY = 'acai_doce_sabor_meus_dados_v1'

/** Os campos que podem ser lembrados. */
export type RememberedCustomer = Pick<CustomerDraft, 'name' | 'phone' | 'street' | 'number' | 'district' | 'zoneId' | 'reference'>

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'> | null

/** Só os campos permitidos, já limpos pelas mesmas regras do formulário. */
export function rememberedFields(draft: CustomerDraft): RememberedCustomer {
  const { name, phone, street, number, district, zoneId, reference } = parseCustomerDraft(draft)
  return { name, phone, street, number, district, zoneId, reference }
}

const isEmpty = (data: RememberedCustomer) => Object.values(data).every((value) => value === null || value === '')

/** Os dados lembrados neste aparelho (ou `null`: nada guardado, estragado ou sem armazenamento). */
export function loadRemembered(storage: Storage): RememberedCustomer | null {
  try {
    const raw = storage?.getItem(REMEMBERED_KEY)
    if (!raw) return null
    const data = rememberedFields({ ...EMPTY_CUSTOMER, ...(JSON.parse(raw) as object) })
    return isEmpty(data) ? null : data
  } catch {
    return null
  }
}

/** Guarda (ou atualiza) os dados permitidos. Sem armazenamento: não guarda, sem erro. */
export function saveRemembered(storage: Storage, draft: CustomerDraft): void {
  try {
    const data = rememberedFields(draft)
    if (isEmpty(data)) storage?.removeItem(REMEMBERED_KEY)
    else storage?.setItem(REMEMBERED_KEY, JSON.stringify(data))
  } catch {
    // Armazenamento cheio ou bloqueado: vale só nesta tela.
  }
}

/** Desmarcou a opção: apaga o que estava lembrado. */
export function forgetRemembered(storage: Storage): void {
  try {
    storage?.removeItem(REMEMBERED_KEY)
  } catch {
    // Nada a fazer.
  }
}

/**
 * O formulário ao abrir: o que já foi digitado nesta aba vale mais (nunca é trocado por dados
 * antigos); sem nada digitado, os dados lembrados.
 */
export function initialCustomer(session: CustomerDraft, remembered: RememberedCustomer | null): CustomerDraft {
  const typed = Object.entries(rememberedFields(session)).some(([, value]) => value !== null && value !== '')
  if (typed || !remembered) return session
  return { ...session, ...remembered }
}
