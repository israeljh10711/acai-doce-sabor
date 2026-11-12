/**
 * Espaço reservado enquanto uma página carregada à parte chega (dezenas de milissegundos).
 * Sem indicador de carregamento: numa espera tão curta ele só piscaria. O espaço evita
 * que o rodapé suba e desça.
 */
export function PageLoading() {
  return <div aria-busy="true" className="min-h-[70svh]" />
}
