import { m } from 'motion/react'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Container } from '../components/layout/Container.tsx'
import { ButtonLink } from '../components/ui/ButtonLink.tsx'
import { ArrowLeft, Bag, Minus, Pencil, Plus, Trash } from '../components/ui/icons.tsx'
import {
  type Cart,
  type CartItem,
  type CartItemProblem,
  type ExtraCartItem,
  MAX_ITEM_QUANTITY,
  MAX_NOTE_LENGTH,
  type ProductCartItem,
  cartCount,
  cartItemProblem,
  describeExtra,
  describeItem,
  lineTotalCents,
  unitPriceCents,
} from '../features/cart/cart.ts'
import { cartActions, useCart } from '../features/cart/cartStore.ts'
import { ILLUSTRATIVE_NOTICE } from '../features/catalog/notices.ts'
import { SoldOut } from '../features/catalog/CatalogSections.tsx'
import { CheckoutPanel } from '../features/checkout/CheckoutPanel.tsx'
import { getExtraItem } from '../features/catalog/extras.ts'
import { ExtraVisual, ProductVisual } from '../features/catalog/ItemVisual.tsx'
import { useCatalogVersion } from '../features/catalog/catalogStore.ts'
import { usePageTitle } from '../hooks/usePageTitle.ts'
import { paths } from '../paths.ts'
import { formatBRL } from '../utils/money.ts'
import { StoreClosedCard } from '../features/store-hours/StoreClosedCard.tsx'

/** Carrinho: cada item com a foto do que foi montado, as escolhas, a quantidade e os valores. */
export function CartPage() {
  // Preço ou item mudado pelo vendedor com a página aberta: redesenha.
  useCatalogVersion()
  usePageTitle('Carrinho', { noindex: true })
  const cart = useCart()
  const [announcement, setAnnouncement] = useState('')
  const count = cartCount(cart)

  const remove = (item: CartItem) => {
    cartActions.remove(item.id)
    setAnnouncement(`${itemName(item)} removido do carrinho.`)
  }

  return (
    <>
      <div className="bg-acai-800 bg-[radial-gradient(ellipse_at_80%_20%,#6a1650_0%,#4a0e36_50%,#3b072a_100%)] text-white">
        <Container className="pt-6 pb-10 sm:pt-8 sm:pb-12">
          <Link
            to={paths.buildOrder}
            className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-gold-400 hover:text-gold-300 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <ArrowLeft className="size-4" />
            <span className="link-draw">Continuar escolhendo</span>
          </Link>
          <h1 className="mt-1 font-display text-4xl font-black tracking-tight uppercase sm:text-5xl">Seu carrinho</h1>
          <p className="mt-2 text-lg text-white/85">
            {count === 0 ? 'Nenhum item ainda.' : `${count} ${count === 1 ? 'item' : 'itens'}, salvos neste aparelho.`}
          </p>
        </Container>
      </div>

      <Container className="py-8 sm:py-12">
        {cart.items.length === 0 ? (
          <>
            {/* Loja fechada (pedido de 2026-11-17): o aviso com o endereço e o WhatsApp. */}
            <StoreClosedCard className="mx-auto mb-6 max-w-2xl" />
            <EmptyCart />
          </>
        ) : (
          <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <ul className="flex flex-col gap-4" aria-label="Itens do carrinho">
              {cart.items.map((item) => (
                <CartLine key={item.id} item={item} onRemove={() => remove(item)} />
              ))}
            </ul>
            <Checkout cart={cart} onCleared={() => setAnnouncement('Carrinho esvaziado.')} />
          </div>
        )}
        <p aria-live="polite" className="sr-only">
          {announcement}
        </p>
      </Container>
    </>
  )
}

function EmptyCart() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-3xl bg-acai-50 px-6 py-12 text-center ring-1 ring-line">
      <Bag className="size-10 text-acai-700" />
      <h2 className="font-display text-2xl font-black tracking-tight text-acai-800 uppercase">Seu carrinho está vazio</h2>
      <p className="text-ink-soft">Monte um açaí ou escolha um picolé, uma bebida ou um doce do cardápio e ele aparece aqui.</p>
      <ButtonLink to={paths.buildOrder}>Ver o cardápio</ButtonLink>
    </div>
  )
}

/** Nome curto do item, para o anúncio de remoção. */
function itemName(item: CartItem): string {
  return item.kind === 'extra' ? describeExtra(item).name : describeItem(item).productName
}

function CartLine({ item, onRemove }: { item: CartItem; onRemove: () => void }) {
  return item.kind === 'extra' ? (
    <ExtraLine item={item} onRemove={onRemove} />
  ) : (
    <ProductLine item={item} onRemove={onRemove} />
  )
}

/** Produto montado no personalizador: tamanho, escolhas por grupo e os adicionais cobrados. */
function ProductLine({ item, onRemove }: { item: ProductCartItem; onRemove: () => void }) {
  const description = describeItem(item)
  const title = description.sizeName ? `${description.productName} · ${description.sizeName}` : description.productName

  return (
    <LineFrame
      item={item}
      title={title}
      visual={<ProductVisual slug={item.slug} sizes="112px" className="size-full" decorative zoom />}
      editTo={paths.configurator(item.slug, item.id)}
      onRemove={onRemove}
    >
      <h2 className="font-display text-lg leading-tight font-black tracking-tight text-acai-800 uppercase">
        {description.productName}
      </h2>
      {description.sizeName && (
        <p className="text-sm font-semibold text-acai-950">
          {description.sizeName}
          {description.container && !description.sizeName.startsWith(description.container) && ` · ${description.container}`}
        </p>
      )}
      {/* Completo (pedido de 2026-11-16): destaque no topo, para a equipe de montagem não errar. */}
      {description.montagem && (
        <p data-montagem="" className="mt-1 inline-block rounded-lg bg-gold-100 px-2 py-0.5 text-sm font-bold text-acai-950 ring-1 ring-gold-400">
          Montagem: {description.montagem}
        </p>
      )}
      {description.flavorName && (
        <p className="text-sm text-ink-soft">
          {description.flavorLabel}: {description.flavorName}
        </p>
      )}
      {description.included.map(({ group, items }) => (
        <p key={group} className="mt-0.5 text-sm text-ink-soft">
          <span className="font-semibold text-acai-800">{group}:</span> {items.join(', ')}
        </p>
      ))}
      {description.montagem && description.paid.length > 0 && (
        <p className="mt-1 text-sm font-semibold text-acai-800">Extras / Cremes e Caldas pagos:</p>
      )}
      {description.paid.map((line) => (
        <p key={line.toppingId} className="mt-0.5 flex justify-between gap-3 text-sm text-ink-soft">
          <span>
            {line.quantity}x {line.name}
          </span>
          <span className="nums whitespace-nowrap">+ {formatBRL(line.totalCents)}</span>
        </p>
      ))}
    </LineFrame>
  )
}

/** Item das gavetas (picolé, bebida, doce...): o sabor escolhido, quando tem. */
function ExtraLine({ item, onRemove }: { item: ExtraCartItem; onRemove: () => void }) {
  const { name, rows } = describeExtra(item)
  const extra = getExtraItem(item.itemId)

  return (
    <LineFrame item={item} title={name} visual={extra && <ExtraVisual item={extra} size="fill" zoom choices={item.choices} />} onRemove={onRemove}>
      <h2 className="font-display text-lg leading-tight font-black tracking-tight text-acai-800 uppercase">{name}</h2>
      {rows.map((row) => (
        <p key={row.label} className="mt-0.5 text-sm text-ink-soft">
          <span className="font-semibold text-acai-800">{row.label}:</span> {row.value}
        </p>
      ))}
    </LineFrame>
  )
}

/** Moldura de um item: foto ou emblema, o conteúdo, a quantidade, o valor, Editar e Remover. */
function LineFrame({
  item,
  title,
  visual,
  editTo,
  onRemove,
  children,
}: {
  item: CartItem
  title: string
  visual: ReactNode
  /** Só os produtos montados se editam (no personalizador). */
  editTo?: string
  onRemove: () => void
  children: ReactNode
}) {
  const unit = unitPriceCents(item)
  const problem = cartItemProblem(item)

  return (
    <m.li layout className={`rounded-3xl bg-white p-4 shadow-card sm:p-5 ${problem ? 'ring-2 ring-red-600' : 'ring-1 ring-line'}`}>
      <article aria-label={title} className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-4 sm:grid-cols-[7rem_minmax(0,1fr)]">
        <div className="relative self-start overflow-hidden rounded-2xl bg-white ring-1 ring-line">
          {visual}
          {problem?.kind === 'item' && <SoldOut available={false} />}
        </div>

        <div className="min-w-0">
          {children}
          {problem && <ProblemNotice problem={problem} editTo={editTo} onRemove={onRemove} title={title} />}
          <NoteField item={item} title={title} />
        </div>

        <div className="col-span-2 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
          <QuantityControl item={item} title={title} />
          <p className="nums text-right">
            <span className="block text-xs text-ink-soft">
              {item.quantity} x {formatBRL(unit)}
            </span>
            <span className="text-xl font-extrabold whitespace-nowrap text-acai-800">{formatBRL(lineTotalCents(item))}</span>
          </p>
          <div className="flex w-full gap-2 sm:w-auto">
            {editTo && (
              <Link
                to={editTo}
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-bold text-acai-800 ring-1 ring-acai-800/30 hover:bg-acai-100 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800 sm:flex-none"
              >
                <Pencil className="size-4" />
                Editar<span className="sr-only"> {title}</span>
              </Link>
            )}
            <button
              type="button"
              onClick={onRemove}
              className="inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full px-4 text-sm font-bold text-red-800 ring-1 ring-red-800/30 hover:bg-red-50 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-red-800 sm:flex-none"
            >
              <Trash className="size-4" />
              Remover<span className="sr-only"> {title}</span>
            </button>
          </div>
        </div>
      </article>
    </m.li>
  )
}

/**
 * Item que esgotou depois de entrar no carrinho (pedido de 2026-11-17): o aviso e o que fazer.
 * O envio do pedido espera o cliente tirar o item ou editar a montagem.
 */
function ProblemNotice({ problem, editTo, onRemove, title }: { problem: CartItemProblem; editTo?: string; onRemove: () => void; title: string }) {
  const action =
    'inline-flex min-h-10 cursor-pointer items-center justify-center rounded-full px-3 text-xs font-bold ring-1 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-red-800'
  return (
    <div data-cart-problem="" className="mt-2 rounded-xl bg-red-50 p-3 text-sm text-red-800 ring-1 ring-red-200">
      <p className="font-bold">
        {problem.kind === 'item' ? 'Esgotado: este item não está disponível agora.' : `Esgotou: ${problem.names.join(', ')}.`}
      </p>
      <p className="mt-0.5">{problem.kind === 'item' ? 'Remova para enviar o pedido.' : 'Edite o item para tirar o que esgotou, ou remova.'}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {problem.kind === 'toppings' && editTo && (
          <Link to={editTo} className={`${action} bg-white text-acai-800 ring-acai-800/30 hover:bg-acai-100`}>
            Editar item<span className="sr-only"> {title}</span>
          </Link>
        )}
        <button type="button" onClick={onRemove} className={`${action} bg-white text-red-800 ring-red-800/30 hover:bg-red-100`}>
          Remover item<span className="sr-only"> {title}</span>
        </button>
      </div>
    </div>
  )
}

/**
 * "+ Observação" (pedido de 2026-11-17, opção 2A): o cliente escreve um recado para o item
 * ("pouco gelo") e ele vai para a comanda do WhatsApp. Vazia, a linha não aparece na comanda.
 */
function NoteField({ item, title }: { item: CartItem; title: string }) {
  const [open, setOpen] = useState(Boolean(item.note))
  const [text, setText] = useState(item.note ?? '')
  const [focusNow, setFocusNow] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const id = `${item.id}-observacao`

  useEffect(() => {
    if (focusNow) input.current?.focus()
  }, [focusNow])

  if (!open) {
    return (
      <button
        type="button"
        data-note-add=""
        onClick={() => {
          setOpen(true)
          setFocusNow(true)
        }}
        className="mt-2 inline-flex min-h-9 cursor-pointer items-center gap-1 rounded-full px-2.5 text-xs font-bold text-acai-800 ring-1 ring-acai-800/25 transition hover:bg-acai-100 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800"
      >
        <Plus className="size-3.5" />
        Observação<span className="sr-only"> para {title}</span>
      </button>
    )
  }
  return (
    <div className="mt-2">
      <label htmlFor={id} className="text-xs font-bold text-acai-800">
        Observação (opcional)
      </label>
      <input
        ref={input}
        id={id}
        data-note-input=""
        type="text"
        maxLength={MAX_NOTE_LENGTH}
        placeholder="Ex.: pouco gelo"
        value={text}
        onChange={(event) => {
          setText(event.target.value)
          cartActions.setNote(item.id, event.target.value)
        }}
        onBlur={() => {
          if (!text.trim()) {
            setOpen(false)
            setFocusNow(false)
          }
        }}
        className="mt-1 min-h-11 w-full rounded-xl bg-white px-3 text-sm text-acai-950 ring-1 ring-line outline-none placeholder:text-ink-soft focus:ring-2 focus:ring-acai-700"
      />
    </div>
  )
}

function QuantityControl({ item, title }: { item: CartItem; title: string }) {
  const button =
    'grid size-11 cursor-pointer place-items-center rounded-full bg-acai-100 text-acai-800 transition hover:bg-acai-200 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800 disabled:cursor-not-allowed disabled:opacity-40'
  return (
    <div className="flex items-center gap-2" role="group" aria-label={`Quantidade de ${title}`}>
      <m.button
        type="button"
        whileTap={{ scale: 0.85 }}
        onClick={() => cartActions.setQuantity(item.id, item.quantity - 1)}
        disabled={item.quantity <= 1}
        aria-label="Diminuir quantidade"
        className={button}
      >
        <Minus className="size-4" />
      </m.button>
      <output aria-live="polite" className="nums w-8 text-center text-lg font-extrabold text-acai-950">
        {item.quantity}
      </output>
      <m.button
        type="button"
        whileTap={{ scale: 0.85 }}
        onClick={() => cartActions.setQuantity(item.id, item.quantity + 1)}
        disabled={item.quantity >= MAX_ITEM_QUANTITY}
        aria-label="Aumentar quantidade"
        className={button}
      >
        <Plus className="size-4" />
      </m.button>
    </div>
  )
}

/**
 * Total e finalização: valores com o frete, dados do cliente, entrega ou retirada, forma de
 * pagamento e envio do pedido pelo WhatsApp da loja (pedidos de 2026-11-14 e 2026-11-17).
 * Ver `features/checkout/CheckoutPanel.tsx`.
 */
function Checkout({ cart, onCleared }: { cart: Cart; onCleared: () => void }) {
  return (
    <aside aria-labelledby="total-titulo" className="overflow-hidden rounded-3xl bg-white shadow-card ring-1 ring-line">
      <h2 id="total-titulo" className="bg-acai-800 px-5 py-4 font-display text-xl font-black tracking-tight text-white uppercase">
        Resumo do pedido
      </h2>
      <div className="flex flex-col gap-5 p-5">
        <CheckoutPanel cart={cart} onCleared={onCleared} />
        <p className="text-xs text-ink-soft">{ILLUSTRATIVE_NOTICE}</p>
      </div>
    </aside>
  )
}
