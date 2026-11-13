import { useEffect } from 'react'
import { useLocation } from 'react-router'

/**
 * Ao chegar numa página com âncora (ex.: "/#cardapio", vindo de outra página), rola até a seção.
 * Dentro da mesma página o navegador já cuida disso.
 */
export function useHashScroll() {
  const { hash } = useLocation()
  useEffect(() => {
    if (!hash) return
    const target = document.getElementById(decodeURIComponent(hash.slice(1)))
    target?.scrollIntoView({ block: 'start' })
  }, [hash])
}
