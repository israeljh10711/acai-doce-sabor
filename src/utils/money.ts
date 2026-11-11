const brlFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

/** Espaço não separável (código 160), que o Intl põe entre "R$" e o valor. */
const NON_BREAKING_SPACE = String.fromCharCode(160)

/**
 * Formata um valor em centavos como reais. Ex.: 600 -> "R$ 6,00".
 *
 * Os preços circulam pelo sistema em centavos inteiros, para que as somas
 * não sofram erros de arredondamento.
 */
export function formatBRL(cents: number): string {
  if (!Number.isInteger(cents)) {
    throw new RangeError(`Valor em centavos inválido: ${cents}`)
  }

  // Trocamos o espaço não separável por espaço comum, para o texto ser
  // previsível em mensagens e testes.
  return brlFormatter.format(cents / 100).replaceAll(NON_BREAKING_SPACE, ' ')
}
