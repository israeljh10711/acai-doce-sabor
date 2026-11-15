/**
 * Rascunho das escolhas de sabor de um item das gavetas, enquanto o cliente marca na janela.
 */
import { type ExtraItem, choiceGroupsOf } from './extras.ts'

/** Marca a opção "Outro sabor" de um grupo. */
export const OTHER_OPTION = '__outro__'

/** O que o cliente marcou e escreveu na janela, por grupo. */
export type ChoiceDraft = {
  picked: Readonly<Record<string, string>>
  other: Readonly<Record<string, string>>
}

export const EMPTY_DRAFT: ChoiceDraft = { picked: {}, other: {} }

/** Escolhas para o carrinho: a opção marcada, ou o texto do "Outro sabor". */
export function draftChoices(item: ExtraItem, draft: ChoiceDraft): Record<string, string> {
  const choices: Record<string, string> = {}
  for (const group of choiceGroupsOf(item)) {
    const picked = draft.picked[group.id]
    if (picked === undefined) continue
    choices[group.id] = picked === OTHER_OPTION ? (draft.other[group.id] ?? '') : picked
  }
  return choices
}
