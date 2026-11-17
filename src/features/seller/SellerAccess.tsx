import { Suspense, lazy } from 'react'
import { Check, Lock, Pencil, Plus } from '../../components/ui/icons.tsx'
import { type EditTarget, useSellerMode } from './sellerModeContext.ts'

const SellerBarLazy = lazy(() => import('./SellerBar.tsx').then((module) => ({ default: module.SellerBar })))

/**
 * Acesso discreto do vendedor (pedido de 2026-11-16), no rodapé da barra lateral (computador) e do
 * menu Categorias (celular): "Senha para vendedor"; com o modo ligado, o selo dourado e "Sair".
 * `beforeOpen`: o menu do celular fecha antes de abrir a janela da senha.
 */
export function SellerAccessButton({ beforeOpen }: { beforeOpen?: () => void }) {
  const seller = useSellerMode()
  if (seller.active) {
    return (
      <div className="flex items-center gap-2">
        <span data-seller-active="" className="inline-flex flex-1 items-center gap-1.5 rounded-xl bg-gold-400 px-3 py-2 text-xs font-extrabold text-acai-800">
          <Check className="size-4" />
          Modo Vendedor Ativo
        </span>
        <button
          type="button"
          onClick={() => void seller.signOut()}
          className="inline-flex min-h-10 cursor-pointer items-center rounded-xl px-3 text-xs font-bold text-acai-800 ring-1 ring-line transition hover:bg-acai-100 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800"
        >
          Sair
        </button>
      </div>
    )
  }
  return (
    <button
      type="button"
      data-seller-access=""
      aria-haspopup="dialog"
      onClick={() => {
        beforeOpen?.()
        seller.openAuth()
      }}
      className="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold text-acai-800/70 transition hover:bg-acai-800/5 hover:text-acai-800 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800"
    >
      <Lock className="size-4" />
      Senha para vendedor
    </button>
  )
}

/** Faixa do modo vendedor no topo da página (só com o modo ligado; carrega sob demanda). */
export function SellerBarSlot() {
  const seller = useSellerMode()
  if (!seller.active) return null
  return (
    <Suspense fallback={null}>
      <SellerBarLazy />
    </Suspense>
  )
}

const editClass =
  'inline-flex min-h-9 cursor-pointer items-center gap-1 rounded-full bg-gold-400 px-2.5 text-xs font-extrabold text-acai-950 shadow-sm ring-1 ring-acai-800/20 transition hover:bg-gold-300 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800'

/** "Editar" sobre um item, produto ou complemento (só com o modo vendedor ligado). */
export function SellerEditButton({ target, label, className = '' }: { target: EditTarget; label: string; className?: string }) {
  const seller = useSellerMode()
  if (!seller.active) return null
  return (
    <button type="button" data-seller-edit="" onClick={() => seller.edit(target)} className={`${editClass} ${className}`}>
      <Pencil className="size-3.5" />
      Editar
      <span className="sr-only">: {label}</span>
    </button>
  )
}

/** "+ Adicionar produto" numa seção, ou "+ Adicionar complemento" num grupo do personalizador. */
export function SellerAddButton({ target, text, className = '' }: { target: EditTarget; text: string; className?: string }) {
  const seller = useSellerMode()
  if (!seller.active) return null
  return (
    <button type="button" data-seller-add="" onClick={() => seller.edit(target)} className={`${editClass} min-h-10 px-3 ${className}`}>
      <Plus className="size-4" />
      {text.replace(/^\+\s*/, '')}
    </button>
  )
}

/** "Renomear" ao lado do título de uma seção ou do grupo "Monte do seu jeito" (modo vendedor). */
export function SellerRenameButton({ id, label, className = '' }: { id: string; label: string; className?: string }) {
  const seller = useSellerMode()
  if (!seller.active) return null
  return (
    <button
      type="button"
      data-seller-rename={id}
      onClick={() => seller.edit({ kind: 'section', id })}
      className={`inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-full px-2 text-xs font-bold text-acai-800 ring-1 ring-acai-800/25 transition hover:bg-acai-100 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800 ${className}`}
    >
      <Pencil className="size-3.5" />
      Renomear
      <span className="sr-only">: {label}</span>
    </button>
  )
}
