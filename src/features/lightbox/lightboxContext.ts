import { createContext, useContext } from 'react'
import type { LightboxImage } from './lightboxImages.ts'

/**
 * De onde a foto foi aberta. A da notificação de oferta segura a oferta na tela (pausa a
 * contagem); as outras funcionam como qualquer janela: a oferta some até a foto fechar.
 */
export type LightboxOrigin = 'page' | 'offer'

export type LightboxState = { image: LightboxImage; origin: LightboxOrigin }

export type LightboxApi = {
  /** Foto aberta agora, ou `null`. */
  current: LightboxState | null
  /** Abre a foto ampliada. `opener` recebe o foco de volta quando ela fecha. */
  show: (image: LightboxImage, opener: HTMLElement | null, origin?: LightboxOrigin) => void
}

export const LightboxContext = createContext<LightboxApi | null>(null)

export function useLightbox(): LightboxApi {
  const api = useContext(LightboxContext)
  if (!api) throw new Error('useLightbox fora do LightboxProvider')
  return api
}
