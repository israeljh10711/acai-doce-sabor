/**
 * O que os formulários do painel do vendedor dividem e não é componente (cardápio dinâmico,
 * 2026-11-21): estilos, textos fixos, rótulos dos tipos e das regras e funções pequenas. Fica fora
 * dos arquivos `.tsx` para a recarga rápida do Vite continuar funcionando.
 */
import { formatBRL } from '../../utils/money.ts'
import type { EmblemIcon } from '../catalog/extras.ts'
import { catalogPhotoSrc } from '../catalog/photos.ts'
import type { CatalogRecords, GroupRecord, GroupRule, OptionRecord, ProductKind } from '../catalog/records.ts'
import { sellerInput, sellerPrimary } from '../seller/sellerStyles.ts'

export const inputClass = sellerInput
export const primaryButton = sellerPrimary
export const quietButton =
  'inline-flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-bold text-acai-800 ring-1 ring-line transition hover:bg-acai-100 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800'
export const dangerButton =
  'inline-flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-bold text-red-800 ring-1 ring-red-200 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-red-800'
export const labelClass = 'text-sm font-bold text-acai-900'

/** Atributos de acessibilidade de um campo com dica ou erro. */
export const describe = (id: string, hint: string | undefined, error: string | null | undefined) => ({
  'aria-invalid': error ? true : undefined,
  'aria-describedby': error ? `${id}-erro` : hint ? `${id}-dica` : undefined,
})

/** A lista com um item trocado de lugar. */
export function moved<T>(list: readonly T[], index: number, step: -1 | 1): T[] {
  const target = index + step
  if (target < 0 || target >= list.length) return [...list]
  const next = [...list]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

export type SaveState = { state: 'idle' } | { state: 'saving' } | { state: 'saved' } | { state: 'error'; message: string }

export const SAVED_TEXT = 'Alterações salvas com sucesso'
export const SAVE_ERROR_TEXT = 'Não foi possível salvar. Tente novamente.'
export const DIRTY_TEXT = 'Há alterações não salvas.'

/** Palavras separadas por vírgula → lista sem repetidas. */
export function parseWords(raw: string): string[] {
  return [...new Set(raw.split(',').map((word) => word.trim()).filter(Boolean))].slice(0, 30)
}

/** Miniatura do produto: a foto do cardápio (cópia leve) ou a enviada. */
export function thumbOf(image: string): string | null {
  if (!image || image.startsWith('idb:')) return null
  return image.startsWith('images/') ? catalogPhotoSrc(image, 480) : image
}

export const ICONS: readonly { id: EmblemIcon; label: string }[] = [
  { id: 'gift', label: 'Presente (combos)' },
  { id: 'sailboat', label: 'Barco (barcas)' },
  { id: 'popsicle', label: 'Picolé' },
  { id: 'iceCreamCone', label: 'Casquinha' },
  { id: 'iceCreamBowl', label: 'Tigela de açaí' },
  { id: 'cupSoda', label: 'Copo' },
  { id: 'glassWater', label: 'Bebida' },
  { id: 'candy', label: 'Doce' },
  { id: 'crown', label: 'Coroa' },
]

export const KIND_LABELS: Readonly<Record<ProductKind, { title: string; text: string }>> = {
  montavel: { title: 'Produto montável', text: 'O cliente monta: tamanho, sabor e complementos (como o Açaí Oca).' },
  variacoes: { title: 'Produto com sabores ou variações', text: 'O cliente escolhe sabor, tamanho ou outra opção (como os picolés).' },
  direto: { title: 'Produto direto', text: 'Vai direto para o carrinho, sem escolhas (como a água).' },
}

export const RULES: Readonly<Record<GroupRule, { title: string; text: string }>> = {
  limited: { title: 'Conta no limite grátis do tamanho', text: 'Segue a cota do tamanho no Oca. No Tradicional, pode escolher todos, um de cada.' },
  included: { title: 'Um de cada', text: 'Cada complemento entra uma vez; o preço dele (se tiver) soma.' },
  paid: { title: 'Cobrado por unidade', text: 'Pode repetir (até 10 de cada); cada unidade soma o preço.' },
}

/** O resumo das regras de um grupo, em uma linha. */
export function groupRuleText(group: GroupRecord): string {
  return [
    RULES[group.rule].title,
    group.minSelect > 0 ? `mínimo ${group.minSelect}` : '',
    group.maxSelect !== null ? `máximo ${group.maxSelect}` : '',
    group.freeCount !== null && group.extraPriceCents > 0 ? `${group.freeCount} grátis, depois ${formatBRL(group.extraPriceCents)} cada` : '',
  ]
    .filter(Boolean)
    .join(' · ')
}

/** Um complemento novo no fim do grupo. */
export function blankOption(records: CatalogRecords, groupId: string): OptionRecord {
  return {
    id: '',
    groupId,
    name: '',
    priceCents: 0,
    image: null,
    look: null,
    productId: null,
    noCompleto: false,
    available: true,
    position: records.options.filter((option) => option.groupId === groupId).length,
    archivedAt: null,
  }
}
