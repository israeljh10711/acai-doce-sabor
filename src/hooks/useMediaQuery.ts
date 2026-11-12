import { useSyncExternalStore } from 'react'

/** Acompanha uma media query do CSS. Ex.: useMediaQuery('(min-width: 64rem)'). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}
