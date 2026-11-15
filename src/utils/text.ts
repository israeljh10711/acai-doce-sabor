/**
 * Texto em forma de comparação: sem acentos e em minúsculas. "Açaí" e "acai" ficam iguais.
 * O cedilha também sai (é um sinal combinado na forma decomposta), então "ç" vira "c".
 */
export function foldText(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** Primeira letra maiúscula, o resto como veio. */
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
