/**
 * Aviso sonoro de pedido novo no painel do vendedor (pedido de 2026-11-20, etapa 2): um bipe
 * duplo feito pela Web Audio do navegador, sem arquivo de áudio. O navegador só libera o som
 * depois de um toque na página: `unlockSound` vai no toque.
 */

type AudioContextClass = new () => AudioContext

let context: AudioContext | null = null

function audio(): AudioContext | null {
  if (context) return context
  const scope = globalThis as unknown as { AudioContext?: AudioContextClass; webkitAudioContext?: AudioContextClass }
  const Ctor = scope.AudioContext ?? scope.webkitAudioContext
  if (!Ctor) return null
  try {
    context = new Ctor()
  } catch {
    return null
  }
  return context
}

/** Chamar num toque do vendedor: libera o som para os avisos seguintes. */
export function unlockSound(): void {
  const ctx = audio()
  if (ctx && ctx.state === 'suspended') void ctx.resume().catch(() => undefined)
}

/** O som está liberado pelo navegador? */
export function soundReady(): boolean {
  return audio()?.state === 'running'
}

/** Bipe duplo (agudo, curto). Devolve `false` quando o navegador ainda não liberou o som. */
export function playNewOrderSound(): boolean {
  const ctx = audio()
  if (!ctx) return false
  if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined)
  const start = ctx.currentTime + 0.01
  for (const [offset, frequency] of [
    [0, 880],
    [0.22, 1175],
  ] as const) {
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.value = frequency
    gain.gain.setValueAtTime(0.0001, start + offset)
    gain.gain.exponentialRampToValueAtTime(0.35, start + offset + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.18)
    oscillator.connect(gain).connect(ctx.destination)
    oscillator.start(start + offset)
    oscillator.stop(start + offset + 0.2)
  }
  return ctx.state === 'running'
}

const SOUND_KEY = 'acai_doce_sabor_pedidos_som_v1'

/** Som ligado neste aparelho (padrão: ligado). */
export function loadSoundOn(): boolean {
  try {
    return globalThis.localStorage?.getItem(SOUND_KEY) !== '0'
  } catch {
    return true
  }
}

export function saveSoundOn(on: boolean): void {
  try {
    globalThis.localStorage?.setItem(SOUND_KEY, on ? '1' : '0')
  } catch {
    // Sem armazenamento: vale só nesta tela.
  }
}
