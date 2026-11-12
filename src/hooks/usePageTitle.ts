import { useEffect } from 'react'
import { storeInfo } from '../services/storeInfo.ts'

/** Título da página inicial: o que é e onde fica. Igual ao `<title>` do index.html. */
export const HOME_TITLE = `${storeInfo.name} | Açaí e milk-shake em Teixeira, PB`

const defaultDescription =
  typeof document === 'undefined'
    ? ''
    : (document.querySelector('meta[name="description"]')?.getAttribute('content') ?? '')

type PageMetaOptions = {
  /** Descrição da página para buscadores. Sem ela, vale a descrição do index.html. */
  description?: string
  /** Tira a página dos resultados de busca (ex.: página não encontrada). */
  noindex?: boolean
}

/**
 * Define o título da aba, a descrição e, se pedido, o `noindex` da página atual.
 * Sem nome de página, o título é o da página inicial.
 */
export function usePageTitle(pageName?: string, { description, noindex = false }: PageMetaOptions = {}) {
  useEffect(() => {
    document.title = pageName ? `${pageName} | ${storeInfo.name}` : HOME_TITLE
    document.querySelector('meta[name="description"]')?.setAttribute('content', description ?? defaultDescription)

    let robots = document.querySelector('meta[name="robots"]')
    if (noindex) {
      if (!robots) {
        robots = document.createElement('meta')
        robots.setAttribute('name', 'robots')
        document.head.append(robots)
      }
      robots.setAttribute('content', 'noindex')
    } else {
      robots?.remove()
    }
  }, [pageName, description, noindex])
}
