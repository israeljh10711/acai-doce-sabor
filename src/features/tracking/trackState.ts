/**
 * O recado que a finalização e o acréscimo deixam para a tela de acompanhamento (o `state` da
 * navegação, nunca a URL): "Pedido recebido com sucesso!" ou "Itens adicionados". Recarregar a
 * página não repete o recado (o navegador guarda o `state`, mas a tela o limpa depois de mostrar).
 */
export type TrackState = { placed?: boolean; added?: boolean }

export function readTrackState(raw: unknown): TrackState {
  if (typeof raw !== 'object' || raw === null) return {}
  const state = raw as Record<string, unknown>
  return { placed: state.placed === true, added: state.added === true }
}
