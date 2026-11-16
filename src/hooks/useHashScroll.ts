import { useEffect } from 'react'
import { useLocation } from 'react-router'

/**
 * Ao chegar numa página com âncora (ex.: "/#cardapio", vindo de outra página), rola até a seção.
 * Dentro da mesma página o navegador já cuida disso. `aliases` leva âncoras antigas às novas
 * (no cardápio, "#bebidas" vai para "#secao-bebidas", desde 2026-11-16).
 */
export function useHashScroll(aliases: Readonly<Record<string, string>> = {}) {
  const { hash } = useLocation()
  useEffect(() => {
    if (!hash) return
    const id = decodeURIComponent(hash.slice(1))
    const target = document.getElementById(aliases[id] ?? id)
    target?.scrollIntoView({ block: 'start' })
  }, [hash, aliases])
}
