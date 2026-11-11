import type { ReactNode } from 'react'

type ContainerProps = {
  children: ReactNode
  className?: string
}

/**
 * Largura e margens laterais do conteúdo. Todo bloco do site passa por aqui,
 * para as bordas esquerda e direita ficarem sempre alinhadas.
 */
export function Container({ children, className = '' }: ContainerProps) {
  return <div className={`mx-auto w-full max-w-6xl px-4 sm:px-6 ${className}`}>{children}</div>
}
