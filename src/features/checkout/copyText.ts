/**
 * Copia um texto para a área de transferência. Devolve se deu certo.
 *
 * `navigator.clipboard` só existe em página segura (https ou localhost). No celular aberto
 * pelo IP da rede local (http) ele não existe; aí entra o método antigo, que copia o texto
 * selecionado num campo escondido.
 */
export async function copyText(text: string): Promise<boolean> {
  if (window.isSecureContext && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Permissão negada: tenta o método antigo.
    }
  }
  const field = document.createElement('textarea')
  field.value = text
  field.setAttribute('readonly', '')
  field.style.position = 'fixed'
  field.style.opacity = '0'
  document.body.append(field)
  field.select()
  field.setSelectionRange(0, text.length)
  let copied: boolean
  try {
    copied = document.execCommand('copy')
  } catch {
    copied = false
  }
  field.remove()
  return copied
}
