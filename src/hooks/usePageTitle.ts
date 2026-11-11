import { useEffect } from 'react'
import { storeInfo } from '../services/storeInfo.ts'

/**
 * Define o título da aba do navegador para a página atual.
 * Sem nome de página, o título é só o nome da loja.
 */
export function usePageTitle(pageName?: string) {
  useEffect(() => {
    document.title = pageName ? `${pageName} | ${storeInfo.name}` : storeInfo.name
  }, [pageName])
}
