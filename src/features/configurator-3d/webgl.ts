let cached: boolean | undefined

/** Diz se o aparelho consegue criar um contexto WebGL. Testa uma vez e guarda a resposta. */
export function canUseWebGL(): boolean {
  if (cached !== undefined) return cached
  try {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
    cached = context !== null
    // libera o contexto de teste na hora; aparelhos limitam quantos ficam abertos
    context?.getExtension('WEBGL_lose_context')?.loseContext()
  } catch {
    cached = false
  }
  return cached
}
