import { Logo } from '../components/brand/Logo.tsx'
import { Container } from '../components/layout/Container.tsx'
import { ButtonLink } from '../components/ui/ButtonLink.tsx'
import { CategoryCards } from '../features/catalog/CategoryCards.tsx'
import { usePageTitle } from '../hooks/usePageTitle.ts'
import { paths } from '../paths.ts'
import { storeInfo } from '../services/storeInfo.ts'
import { buildWhatsAppUrl } from '../utils/whatsapp.ts'

const sectionTitle = 'font-display text-3xl font-semibold tracking-tight text-plum-900 sm:text-4xl'

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

export function HomePage() {
  usePageTitle()

  const { address, instagramHandle, instagramUrl, whatsapp } = storeInfo
  const whatsappUrl = buildWhatsAppUrl(whatsapp)

  return (
    <>
      {/* A primeira tela é só do destaque: a altura desconta o cabeçalho (4,25rem). */}
      <section className="flex min-h-[calc(100svh-4.25rem)] items-center bg-plum-700 text-white">
        <Container className="grid items-center gap-6 pt-2 pb-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-12 lg:pb-20">
          <div className="flex justify-center lg:order-2 lg:justify-end">
            <Logo
              version="onBrand"
              sizes="(min-width: 1024px) 416px, 224px"
              className="animate-rise size-56 lg:size-[26rem]"
            />
          </div>

          <div className="lg:order-1">
            <p className="animate-rise flex items-center gap-2 text-sm font-semibold tracking-wider text-white/80 uppercase [animation-delay:60ms]">
              <span aria-hidden="true" className="size-2 rounded-full bg-leaf-500" />
              {address.city}, {address.state}
            </p>
            <h1 className="animate-rise mt-3 font-display text-[2.75rem] leading-[1.02] font-semibold tracking-tight text-balance [animation-delay:120ms] sm:text-6xl lg:text-7xl">
              Açaí montado do seu jeito.
            </h1>
            <p className="animate-rise mt-4 max-w-md text-lg text-white/85 [animation-delay:180ms]">
              Escolha o tamanho, os adicionais, as frutas e as caldas. Ou peça um milk-shake, em
              13 sabores.
            </p>

            <div className="animate-rise mt-7 flex flex-col gap-3 [animation-delay:240ms] sm:flex-row">
              <ButtonLink to={paths.buildOrder} variant="onBrandPrimary">
                Montar meu pedido
              </ButtonLink>
              <ButtonLink href={whatsappUrl} variant="onBrandSecondary">
                Chamar no WhatsApp
              </ButtonLink>
            </div>
          </div>
        </Container>
      </section>

      <Container className="pt-6">
        <p
          role="note"
          className="rounded-xl border border-cream-200 bg-white px-4 py-3 text-sm text-plum-950/80"
        >
          Site em construção: o pedido online ainda não está disponível. Por enquanto, os pedidos
          são feitos pelo WhatsApp da loja.
        </p>
      </Container>

      <section className="py-14 sm:py-20">
        <Container>
          <h2 className={sectionTitle}>Três opções para montar</h2>
          <p className="mt-2 max-w-prose text-lg text-plum-950/75">
            No açaí, as frutas e as caldas entram à parte dos adicionais.
          </p>
          <CategoryCards headingLevel="h3" className="mt-8" />
        </Container>
      </section>

      <section className="bg-cream-100 py-14 sm:py-20">
        <Container>
          <h2 className={sectionTitle}>Como funciona o pedido</h2>
          <ol className="mt-8 grid gap-8 md:grid-cols-3 md:gap-6">
            {steps.map((step, index) => (
              <li key={step.title} className="border-t-2 border-leaf-500 pt-5">
                <p aria-hidden="true" className="font-display text-5xl font-semibold text-leaf-700">
                  {index + 1}
                </p>
                <h3 className="mt-3 text-xl font-semibold text-plum-900">{step.title}</h3>
                <p className="mt-2 text-plum-950/75">{step.text}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      <section className="py-14 sm:py-20">
        <Container>
          <h2 className={sectionTitle}>Onde fica a loja</h2>
          <address className="mt-5 not-italic">
            <p className="font-display text-4xl leading-[1.05] font-semibold tracking-tight text-balance text-berry-600 sm:text-6xl lg:text-7xl">
              {address.street}
            </p>
            <p className="mt-3 text-xl text-plum-950/75">
              {address.city}, {address.state}
            </p>
          </address>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href={whatsappUrl}>Chamar no WhatsApp</ButtonLink>
            <ButtonLink href={instagramUrl} variant="secondary">
              Ver o Instagram
            </ButtonLink>
          </div>
          <p className="mt-5 text-sm text-plum-950/70">
            WhatsApp {whatsapp} · Instagram @{instagramHandle}
          </p>
        </Container>
      </section>
    </>
  )
}
