import { Suspense, lazy, useState } from 'react'
import { Ban, Check, Copy, Lock, Pencil, Plus } from '../../components/ui/icons.tsx'
import { getCatalogRecords } from '../catalog/catalogStore.ts'
import { catalogWrite } from './sellerBackend.ts'
import type { ExtraItem } from '../catalog/extras.ts'
import type { Flavor, Product } from '../catalog/menu.ts'
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

/**
 * "Disponível" / "Esgotado" em 1 toque, sem abrir o formulário (pedido de 2026-11-17): grava na
 * hora (aparelho ou Supabase). Verde um tom mais escuro que o pedido, para o texto branco passar
 * no contraste mínimo.
 */
export function SellerStockToggle({
  kind,
  id,
  available,
  label,
  className = '',
}: {
  kind: 'items' | 'products' | 'toppings'
  id: string
  available: boolean
  label: string
  className?: string
}) {
  const seller = useSellerMode()
  if (!seller.active) return null
  return (
    <StockPill
      available={available}
      label={label}
      className={className}
      onToggle={async () => {
        // Cardápio do banco (2026-11-21): grava no produto ou no complemento.
        const table = kind === 'toppings' ? 'catalog_options' : 'catalog_products'
        await catalogWrite((writer) => writer.patch(table, { id }, { available: !available }))
      }}
    />
  )
}

/**
 * "Disponível / Esgotado" de um sabor no personalizador (gerenciador de sabores, 2026-11-17). Na
 * Barca, as coberturas são as caldas: o toque grava na calda e vale nos dois lugares.
 */
export function SellerFlavorToggle({ product, flavor, className = '' }: { product: Product; flavor: Flavor; className?: string }) {
  const seller = useSellerMode()
  if (!seller.active) return null
  const available = flavor.available !== false
  if (product.flavorsFrom) return <SellerStockToggle kind="toppings" id={flavor.id} available={available} label={flavor.name} className={className} />
  return (
    <StockPill
      available={available}
      label={flavor.name}
      className={className}
      onToggle={async () => {
        // O sabor é uma opção da escolha do produto (a primeira; no código, "sabor").
        const choice = getCatalogRecords()
          ?.choices.filter((entry) => entry.productId === product.slug)
          .sort((a, b) => a.position - b.position)[0]
        if (!choice) throw new Error('Produto sem escolha de sabor')
        await catalogWrite((writer) =>
          writer.patch('catalog_choice_options', { product_id: product.slug, choice_id: choice.id, id: flavor.id }, { available: !available }),
        )
      }}
    />
  )
}

/** A pílula em si: um toque alterna e grava; se não gravar, avisa e deixa tocar de novo. */
function StockPill({ available, label, className, onToggle }: { available: boolean; label: string; className: string; onToggle: () => Promise<void> }) {
  const [state, setState] = useState<'idle' | 'saving' | 'failed'>('idle')
  const toggle = async () => {
    setState('saving')
    try {
      await onToggle()
      setState('idle')
    } catch {
      setState('failed')
    }
  }
  return (
    <button
      type="button"
      data-seller-stock={available ? 'disponivel' : 'esgotado'}
      disabled={state === 'saving'}
      onClick={() => void toggle()}
      className={`inline-flex min-h-9 cursor-pointer items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold text-white shadow ring-1 ring-black/10 transition focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800 disabled:cursor-wait disabled:opacity-70 ${
        available ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-red-600 hover:bg-red-700'
      } ${className}`}
    >
      {available ? <Check className="size-3.5" /> : <Ban className="size-3.5" />}
      {state === 'failed' ? 'Não salvou, toque de novo' : available ? 'Disponível' : 'Esgotado'}
      <span className="sr-only">
        : {label}. Toque para marcar como {available ? 'esgotado' : 'disponível'}.
      </span>
    </button>
  )
}

/**
 * "Duplicar" discreto (pedido de 2026-11-17), longe do "Editar": abre o cadastro já preenchido com
 * o item, para o vendedor só trocar a foto e o nome. Pote 1 L e Barca não (abrem o personalizador).
 */
export function SellerDuplicateButton({ item, className = '' }: { item: ExtraItem; className?: string }) {
  const seller = useSellerMode()
  if (!seller.active || item.action.type === 'customizer') return null
  return (
    <button
      type="button"
      data-seller-duplicate=""
      onClick={() => seller.edit({ kind: 'item', id: null, drawer: item.drawer, copyOf: item.id })}
      className={`inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-lg border border-gray-200/80 bg-gray-100/90 px-2 py-1 text-[11px] font-medium text-gray-600 transition hover:bg-gray-200/80 hover:text-[#4A0E36] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800 ${className}`}
    >
      <Copy className="size-3.5" />
      Duplicar<span className="sr-only">: {item.name}</span>
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
