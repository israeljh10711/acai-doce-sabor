import { type ReactNode, useMemo, useRef, useState } from 'react'
import { type LightboxApi, LightboxContext, type LightboxState } from './lightboxContext.ts'
import { ImageLightboxModal } from './ImageLightboxModal.tsx'

/** Uma foto ampliada para o site todo: qualquer componente abre com `useLightbox().show`. */
export function LightboxProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<LightboxState | null>(null)
  const opener = useRef<HTMLElement | null>(null)

  const api = useMemo<LightboxApi>(
    () => ({
      current,
      show: (image, element, origin = 'page') => {
        opener.current = element
        setCurrent({ image, origin })
      },
    }),
    [current],
  )

  return (
    <LightboxContext value={api}>
      {children}
      <ImageLightboxModal
        image={current?.image ?? null}
        onClose={() => {
          setCurrent(null)
          // O foco volta para a lupa (ou o botão "Ver foto") que abriu a foto.
          opener.current?.focus({ preventScroll: true })
          opener.current = null
        }}
      />
    </LightboxContext>
  )
}
