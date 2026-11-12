import { m } from 'motion/react'
import { Container } from '../components/layout/Container.tsx'
import { ButtonLink } from '../components/ui/ButtonLink.tsx'
import { ArrowRight, Camera, Chat, Info, Pin } from '../components/ui/icons.tsx'
import { CategoryCards } from '../features/catalog/CategoryCards.tsx'
import { PRODUCTS } from '../features/catalog/menu.ts'
import { ILLUSTRATIVE_NOTICE } from '../features/catalog/notices.ts'
import { HERO_IMAGE } from '../features/catalog/showcaseImages.ts'
import { usePageTitle } from '../hooks/usePageTitle.ts'
import { paths } from '../paths.ts'
import { storeInfo } from '../services/storeInfo.ts'
import { buildWhatsAppUrl } from '../utils/whatsapp.ts'

const sectionTitle = 'font-display text-3xl font-black tracking-tight text-balance text-acai-800 uppercase sm:text-4xl'

const steps = [
  {
    title: 'Escolha o tamanho',
    text: 'Pote, copo ou isopor no açaí. No milk-shake, 400 ml ou 500 ml.',
  },
  {
    title: 'Monte do seu jeito',
    text: 'Adicionais, frutas e caldas no açaí. No milk-shake, um dos 13 sabores.',
  },
  {
    title: 'Envie pelo WhatsApp',
    text: 'O site abre a conversa com o pedido já escrito. Você confere e envia.',
  },
]

/** Fatos do cardápio, mostrados no destaque. Nada inventado: tudo vem do cardápio do proprietário. */
const facts = [
  { value: '3', label: 'jeitos de montar' },
  { value: String(PRODUCTS['milk-shake'].flavors.length), label: 'sabores de milk-shake' },
  { value: 'Grátis', label: 'frutas e coberturas no açaí' },
]

const rise = (delay: number) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.55, delay, ease: [0.2, 0.7, 0.2, 1] as const },
})

export function HomePage() {
  usePageTitle()

  const { address, instagramHandle, instagramUrl, whatsapp } = storeInfo
  const whatsappUrl = buildWhatsAppUrl(whatsapp)

  return (
    <>
      {/* Destaque: roxo da marca, título forte e os três produtos renderizados no Blender. */}
      <section className="relative isolate overflow-hidden bg-acai-800 text-white">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(55%_65%_at_78%_42%,#7b1d5c_0%,transparent_72%)]"
        />
        <Container className="grid items-center gap-4 pt-6 pb-12 lg:min-h-[calc(100svh-4.25rem)] lg:grid-cols-[1fr_1.05fr] lg:gap-10 lg:py-14">
          <div className="order-2 lg:order-1">
            <m.p
              {...rise(0.05)}
              className="flex items-center gap-2 text-sm font-bold tracking-[0.14em] text-gold-400 uppercase"
            >
              <Pin className="size-4" />
              {address.city}, {address.state}
            </m.p>
            <m.h1
              {...rise(0.12)}
              className="mt-3 font-display text-[2.7rem] leading-[0.95] font-black tracking-tight text-balance uppercase sm:text-6xl xl:text-7xl"
            >
              Açaí montado <span className="text-gold-400">do seu jeito.</span>
            </m.h1>
            <m.p {...rise(0.2)} className="mt-5 max-w-md text-lg text-white/85">
              Escolha o tamanho, os adicionais, as frutas e as caldas. Ou peça um milk-shake, em 13 sabores.
            </m.p>

            <m.div {...rise(0.28)} className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink to={paths.buildOrder} variant="onBrandPrimary">
                Montar meu pedido
                <ArrowRight />
              </ButtonLink>
              <ButtonLink href={whatsappUrl} variant="onBrandSecondary">
                <Chat />
                Chamar no WhatsApp
              </ButtonLink>
            </m.div>

            <m.dl {...rise(0.36)} className="mt-9 grid max-w-lg grid-cols-3 gap-3 border-t border-white/15 pt-6">
              {facts.map((fact) => (
                <div key={fact.label}>
                  <dt className="sr-only">{fact.label}</dt>
                  <dd>
                    <span className="block font-display text-2xl font-black text-gold-400 uppercase sm:text-3xl">
                      {fact.value}
                    </span>
                    <span aria-hidden="true" className="mt-1 block text-sm leading-snug text-white/80">
                      {fact.label}
                    </span>
                  </dd>
                </div>
              ))}
            </m.dl>
          </div>

          <m.figure
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, ease: [0.2, 0.7, 0.2, 1] }}
            className="order-1 mx-auto w-full max-w-md sm:max-w-lg lg:order-2 lg:max-w-none"
          >
            <img
              src={HERO_IMAGE.src}
              srcSet={HERO_IMAGE.srcSet}
              sizes="(min-width: 1152px) 560px, (min-width: 1024px) 50vw, (min-width: 640px) 512px, calc(100vw - 2rem)"
              width={HERO_IMAGE.width}
              height={HERO_IMAGE.height}
              alt={HERO_IMAGE.alt}
              fetchPriority="high"
              decoding="async"
              className="h-auto w-full drop-shadow-[0_30px_40px_rgb(20_2_14/0.45)]"
            />
            <figcaption className="text-center text-xs text-white/70">{ILLUSTRATIVE_NOTICE}</figcaption>
          </m.figure>
        </Container>
      </section>

      <Container className="pt-6">
        <p
          role="note"
          className="flex gap-3 rounded-2xl bg-acai-50 px-4 py-3 text-sm text-ink-soft ring-1 ring-line"
        >
          <Info className="mt-0.5 size-5 text-acai-700" />
          <span>
            Site em construção: você já pode montar seu açaí ou milk-shake e ver o preço, mas o envio do pedido pelo
            site ainda não está disponível. Por enquanto, os pedidos são feitos pelo WhatsApp da loja.
          </span>
        </p>
      </Container>

      <section className="py-14 sm:py-20">
        <Container>
          <p className="text-sm font-bold tracking-[0.14em] text-acai-600 uppercase">Monte seu açaí</p>
          <h2 className={`mt-2 ${sectionTitle}`}>Três opções para montar</h2>
          <p className="mt-3 max-w-prose text-lg text-ink-soft">
            No açaí, as frutas e as caldas entram à parte dos adicionais.
          </p>
          <CategoryCards headingLevel="h3" className="mt-8" />
        </Container>
      </section>

      <section className="bg-acai-50 py-14 sm:py-20">
        <Container>
          <h2 className={sectionTitle}>Como funciona o pedido</h2>
          <ol className="mt-8 grid gap-4 md:grid-cols-3 md:gap-5">
            {steps.map((step, index) => (
              <m.li
                key={step.title}
                initial={{ y: 14 }}
                whileInView={{ y: 0 }}
                viewport={{ once: true, margin: '0px 0px -40px 0px' }}
                transition={{ duration: 0.45, delay: index * 0.08, ease: [0.2, 0.7, 0.2, 1] }}
                className="rounded-3xl bg-white p-6 shadow-card ring-1 ring-line"
              >
                <p
                  aria-hidden="true"
                  className="grid size-12 place-items-center rounded-2xl bg-acai-800 font-display text-2xl font-black text-gold-400"
                >
                  {index + 1}
                </p>
                <h3 className="mt-4 font-display text-xl font-extrabold tracking-tight text-acai-800 uppercase">
                  {step.title}
                </h3>
                <p className="mt-2 text-ink-soft">{step.text}</p>
              </m.li>
            ))}
          </ol>
        </Container>
      </section>

      <section className="bg-acai-900 py-14 text-white sm:py-20">
        <Container>
          <h2 className="font-display text-3xl font-black tracking-tight text-gold-400 uppercase sm:text-4xl">
            Onde fica a loja
          </h2>
          <address className="mt-5 not-italic">
            <p className="font-display text-4xl leading-[1.02] font-black tracking-tight text-balance uppercase sm:text-6xl lg:text-7xl">
              {address.street}
            </p>
            <p className="mt-3 text-xl text-white/80">
              {address.city}, {address.state}
            </p>
          </address>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href={whatsappUrl} variant="onBrandPrimary">
              <Chat />
              Chamar no WhatsApp
            </ButtonLink>
            <ButtonLink href={instagramUrl} variant="onBrandSecondary">
              <Camera />
              Ver o Instagram
            </ButtonLink>
          </div>
          <p className="nums mt-5 text-sm text-white/75">
            WhatsApp {whatsapp} · Instagram @{instagramHandle}
          </p>
        </Container>
      </section>
    </>
  )
}
