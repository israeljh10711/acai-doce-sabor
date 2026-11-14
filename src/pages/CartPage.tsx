import { m } from 'motion/react'
import { useState } from 'react'
import { Link } from 'react-router'
import { Container } from '../components/layout/Container.tsx'
import { ButtonLink } from '../components/ui/ButtonLink.tsx'
import { ArrowLeft, Bag, Chat, Info, Minus, Pencil, Plus, Trash } from '../components/ui/icons.tsx'
import {
  type CartItem,
  MAX_ITEM_QUANTITY,
  cartCount,
  cartTotalCents,
  describeItem,
  lineTotalCents,
  unitPriceCents,
} from '../features/cart/cart.ts'
import { cartActions, useCart } from '../features/cart/cartStore.ts'
import { ILLUSTRATIVE_NOTICE } from '../features/catalog/notices.ts'
import { PRODUCTS } from '../features/catalog/menu.ts'
import { ProductPhoto } from '../features/catalog/ProductPhoto.tsx'
import { usePageTitle } from '../hooks/usePageTitle.ts'
import { paths } from '../paths.ts'
import { storeInfo } from '../services/storeInfo.ts'
import { formatBRL } from '../utils/money.ts'
import { buildWhatsAppUrl } from '../utils/whatsapp.ts'

/** Carrinho: cada item com a foto do que foi montado, as escolhas, a quantidade e os valores. */
export function CartPage() {
  usePageTitle('Carrinho', { noindex: true })
  const cart = useCart()
  const [announcement, setAnnouncement] = useState('')
  const count = cartCount(cart)

  const remove = (item: CartItem) => {
    cartActions.remove(item.id)
    setAnnouncement(`${describeItem(item).productName} removido do carrinho.`)
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
          <EmptyCart />
        ) : (
          <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <ul className="flex flex-col gap-4" aria-label="Itens do carrinho">
              {cart.items.map((item) => (
                <CartLine key={item.id} item={item} onRemove={() => remove(item)} />
              ))}
            </ul>
            <Checkout totalCents={cartTotalCents(cart)} />
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
      <p className="text-ink-soft">Monte um açaí, um açaí batido ou um milk-shake e ele aparece aqui.</p>
      <ButtonLink to={paths.buildOrder}>Ver o cardápio</ButtonLink>
    </div>
  )
}

function CartLine({ item, onRemove }: { item: CartItem; onRemove: () => void }) {
  const description = describeItem(item)
  const title = `${description.productName} · ${description.sizeName}`
  const unit = unitPriceCents(item)

  return (
    <m.li layout className="rounded-3xl bg-white p-4 shadow-card ring-1 ring-line sm:p-5">
      <article aria-label={title} className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-4 sm:grid-cols-[7rem_minmax(0,1fr)]">
        <div className="overflow-hidden rounded-2xl bg-acai-50">
          <ProductPhoto
            slug={item.slug}
            container={PRODUCTS[item.slug].sizes.find((size) => size.id === item.selection.sizeId)?.container}
            sizes="112px"
            className="size-full"
            decorative
          />
        </div>

        <div className="min-w-0">
          <h2 className="font-display text-lg leading-tight font-black tracking-tight text-acai-800 uppercase">
            {description.productName}
          </h2>
          <p className="text-sm font-semibold text-acai-950">
            {description.sizeName}
            {description.container && !description.sizeName.startsWith(description.container) && ` · ${description.container}`}
          </p>
          {description.flavorName && <p className="text-sm text-ink-soft">Sabor: {description.flavorName}</p>}
          {description.included.map(({ group, items }) => (
            <p key={group} className="mt-0.5 text-sm text-ink-soft">
              <span className="font-semibold text-acai-800">{group}:</span> {items.join(', ')}
            </p>
          ))}
          {description.paid.map((line) => (
            <p key={line.toppingId} className="mt-0.5 flex justify-between gap-3 text-sm text-ink-soft">
              <span>
                {line.quantity}x {line.name}
              </span>
              <span className="nums whitespace-nowrap">+ {formatBRL(line.totalCents)}</span>
            </p>
          ))}
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
            <Link
              to={paths.configurator(item.slug, item.id)}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-bold text-acai-800 ring-1 ring-acai-800/30 hover:bg-acai-100 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800 sm:flex-none"
            >
              <Pencil className="size-4" />
              Editar<span className="sr-only"> {title}</span>
            </Link>
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
 * Total e finalização. O envio pelo site depende do sistema de pedidos (banco de dados), que
 * ainda não foi conectado: a regra do projeto é gravar o pedido antes de abrir o WhatsApp.
 * Por isso não há botão de enviar fingindo funcionar.
 */
function Checkout({ totalCents }: { totalCents: number }) {
  return (
    <aside aria-labelledby="total-titulo" className="overflow-hidden rounded-3xl bg-white shadow-card ring-1 ring-line lg:sticky lg:top-6">
      <h2 id="total-titulo" className="bg-acai-800 px-5 py-4 font-display text-xl font-black tracking-tight text-white uppercase">
        Resumo
      </h2>
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-baseline justify-between gap-4">
          <span className="font-display text-lg font-extrabold text-acai-800 uppercase">Total</span>
          <span className="nums text-3xl font-extrabold whitespace-nowrap text-acai-800">{formatBRL(totalCents)}</span>
        </div>
        <p className="text-xs text-ink-soft">Taxa de entrega e forma de pagamento não entram neste total.</p>

        <div className="rounded-2xl bg-gold-100 p-4 text-sm text-acai-950 ring-1 ring-gold-400">
          <p className="flex gap-2 font-bold">
            <Info className="mt-0.5 size-4 shrink-0 text-acai-700" />
            Envio do pedido pelo site em breve
          </p>
          <p className="mt-1.5 leading-relaxed">
            A finalização entra quando o sistema de pedidos da loja for conectado. Seu carrinho fica salvo neste aparelho.
            Enquanto isso, fale com a loja pelo WhatsApp.
          </p>
        </div>

        <ButtonLink href={buildWhatsAppUrl(storeInfo.whatsapp)} className="w-full">
          <Chat className="size-5" />
          Falar com a loja
        </ButtonLink>
        <p className="text-xs text-ink-soft">{ILLUSTRATIVE_NOTICE}</p>
      </div>
    </aside>
  )
}
