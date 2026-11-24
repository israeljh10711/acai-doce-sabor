import { m } from 'motion/react'
import { Logo } from '../components/brand/Logo.tsx'
import { Container } from '../components/layout/Container.tsx'
import { ButtonLink } from '../components/ui/ButtonLink.tsx'
import { ArrowRight, Camera, Chat, Clock, Crown, Pin } from '../components/ui/icons.tsx'
import { legacyAnchors, MONTE_TITLE } from '../features/catalog/catalogNav.ts'
import { useCatalogVersion } from '../features/catalog/catalogStore.ts'
import { MenuBrowser } from '../features/catalog/MenuBrowser.tsx'
import { useStoreSettings } from '../features/catalog/catalogStore.ts'
import { scheduleText } from '../features/store-hours/hours.ts'
import { StoreClosedCard } from '../features/store-hours/StoreClosedCard.tsx'
import { StoreStatusBadge } from '../features/store-hours/StoreStatusBadge.tsx'
import { storeAddressText } from '../features/store/storeSettings.ts'
import { useHashScroll } from '../hooks/useHashScroll.ts'
import { usePageTitle } from '../hooks/usePageTitle.ts'
import { storeInfo } from '../services/storeInfo.ts'
import { buildWhatsAppUrl } from '../utils/whatsapp.ts'

const EASE_OUT = [0.2, 0.7, 0.2, 1] as const

const rise = (delay: number) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, delay, ease: EASE_OUT },
})

export function HomePage() {
  // O título "Monte do seu jeito" pode ser renomeado pelo vendedor com a página aberta.
  useCatalogVersion()
  usePageTitle()
  useHashScroll(legacyAnchors())

  return (
    <>
      <Hero />

      {/* Loja fechada (pedido de 2026-11-17): o convite para voltar, o endereço e o WhatsApp. */}
      <Container className="pt-8 sm:pt-10 empty:hidden">
        <StoreClosedCard />
      </Container>

      {/* O cardápio inteiro (navegação, busca, destaques, os 4 produtos e as 5 seções), igual ao da página Cardápio. */}
      <MenuBrowser
        headingLevel={3}
        sectionId="cardapio"
        labelledBy="cardapio-titulo"
        className="pt-14 pb-14 sm:pt-20 sm:pb-20"
        intro={
          <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:mb-12 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-extrabold tracking-[0.16em] text-acai-600 uppercase">{MONTE_TITLE}</p>
              <h2 id="cardapio-titulo" className="mt-1 font-display text-4xl font-black tracking-tight text-acai-800 uppercase sm:text-5xl">
                Cardápio
              </h2>
            </div>
            <p className="max-w-sm text-ink-soft">
              Escolha a categoria, monte o seu com os ingredientes que quiser e acompanhe o preço na hora.
            </p>
          </div>
        }
      />

      <StoreInfo />
    </>
  )
}

function Hero() {
  return (
    <section
      aria-labelledby="inicio-titulo"
      className="relative overflow-hidden bg-brand text-white"
    >
      <Container className="grid items-center gap-10 pt-8 pb-14 sm:pt-12 lg:grid-cols-[1.05fr_1fr] lg:gap-6 lg:pt-14 lg:pb-20">
        <div className="relative z-10 flex flex-col items-start">
          <m.div className="flex flex-wrap items-center gap-3" {...rise(0)}>
            <Logo version="onBrand" sizes="72px" className="size-16 sm:size-18" />
            <StoreStatusBadge />
          </m.div>

          <m.h1
            id="inicio-titulo"
            className="mt-6 font-display text-[2.6rem] leading-[0.95] font-black tracking-tight text-balance uppercase min-[400px]:text-5xl sm:text-6xl xl:text-7xl"
            {...rise(0.08)}
          >
            O açaí mais saboroso <span className="text-orchid-400">de Teixeira</span>
          </m.h1>

          <m.p className="mt-5 max-w-lg text-lg leading-relaxed text-white/85" {...rise(0.16)}>
            Açaí no pote, no copo ou no isopor, açaí batido e milk-shake. Você monta do seu jeito e acompanha o preço na
            hora.
          </m.p>

          <m.div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row" {...rise(0.24)}>
            <a
              href="#cardapio"
              className="btn-primary inline-flex min-h-14 items-center justify-center gap-2 rounded-full px-8 text-base font-extrabold tracking-tight whitespace-nowrap uppercase focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-white"
            >
              Quero fazer meu pedido
              <ArrowRight className="size-5" />
            </a>
            <a
              href="#secao-acai-oca"
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full border-2 border-white/60 px-7 font-bold whitespace-nowrap text-white transition hover:border-white hover:bg-white hover:text-acai-800 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-white"
            >
              <Crown className="size-5 text-orchid-400" />
              Conheça o Açaí Oca
            </a>
          </m.div>
        </div>

        <HeroPhoto />
      </Container>
    </section>
  )
}

function HeroPhoto() {
  return (
    <picture className="mx-auto block w-full max-w-[34rem] overflow-hidden rounded-3xl shadow-2xl">
      <source
        media="(min-width: 64rem)"
        srcSet="/images/campanha/mesa-de-acai-640.webp 640w, /images/campanha/mesa-de-acai-1080.webp 1080w"
        sizes="(min-width: 72rem) 33rem, 46vw"
        width={1080}
        height={1080}
      />
      <img
        src="/images/campanha/primeira-colherada-600.webp"
        srcSet="/images/campanha/primeira-colherada-600.webp 600w, /images/campanha/primeira-colherada-1080.webp 1080w"
        sizes="(min-width: 36rem) 34rem, calc(100vw - 2rem)"
        width={600}
        height={400}
        fetchPriority="high"
        alt="Imagem de campanha com Açaí Oca em camadas, morangos e crocantes, uma tigela de açaí com banana e confeitos e um milk-shake de chocolate."
        className="block h-auto w-full"
      />
    </picture>
  )
}

function StoreInfo() {
  // Horário e contato atuais (o vendedor muda em "Horários e Contato", 2026-11-17).
  const settings = useStoreSettings()
  const { contact } = settings
  const { instagramHandle, instagramUrl } = storeInfo
  return (
    <section aria-labelledby="loja-titulo" className="bg-acai-950 text-white">
      <Container className="grid gap-10 py-14 sm:py-16 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <h2 id="loja-titulo" className="font-display text-3xl font-black tracking-tight uppercase sm:text-4xl">
            Peça agora
          </h2>
          <ul className="mt-6 grid gap-4 text-white/85 sm:grid-cols-3">
            <li className="flex gap-3">
              <Clock className="mt-0.5 size-5 shrink-0 text-orchid-400" />
              <span>
                <span className="block font-bold text-white">Funcionamento</span>
                {scheduleText(settings)}
              </span>
            </li>
            <li className="flex gap-3">
              <Pin className="mt-0.5 size-5 shrink-0 text-orchid-400" />
              <span>
                <span className="block font-bold text-white">Endereço</span>
                {storeAddressText(contact)}
              </span>
            </li>
            <li className="flex gap-3">
              <Chat className="mt-0.5 size-5 shrink-0 text-orchid-400" />
              <span>
                <span className="block font-bold text-white">WhatsApp</span>
                <span className="nums">{contact.whatsapp}</span>
              </span>
            </li>
          </ul>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <ButtonLink href={buildWhatsAppUrl(contact.whatsapp)} variant="onBrandPrimary">
            <Chat className="size-5" />
            Falar no WhatsApp
          </ButtonLink>
          <ButtonLink href={instagramUrl} variant="onBrandSecondary">
            <Camera className="size-5" />@{instagramHandle}
          </ButtonLink>
        </div>
      </Container>
    </section>
  )
}
