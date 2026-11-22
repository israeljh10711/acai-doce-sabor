import { Link } from 'react-router'
import { useStoreSettings } from '../../features/catalog/catalogStore.ts'
import { scheduleText } from '../../features/store-hours/hours.ts'
import { storeAddressText } from '../../features/store/storeSettings.ts'
import { paths } from '../../paths.ts'
import { storeInfo } from '../../services/storeInfo.ts'
import { buildWhatsAppUrl } from '../../utils/whatsapp.ts'
import { Logo } from '../brand/Logo.tsx'
import { Container } from './Container.tsx'

const linkClass =
  'inline-flex min-h-11 items-center font-medium text-white/85 transition-colors duration-150 hover:text-orchid-300 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-white'
const groupLabel = 'text-sm font-semibold text-orchid-300'

/**
 * Rodapé (redesenho de 2026-11-22): berinjela da marca, com a palavra "Açaí" gigante ao fundo, como
 * nas artes de referência. Identidade, endereço e horário à esquerda; os links em três grupos.
 */
export function SiteFooter() {
  // Horário, contato e identidade atuais (Configurações da loja, 2026-11-17 e 2026-11-21).
  const settings = useStoreSettings()
  const { contact } = settings
  const { name } = settings.identity
  const instagramHandle = settings.identity.instagram
  const instagramUrl = instagramHandle ? `https://www.instagram.com/${instagramHandle}/` : storeInfo.instagramUrl

  return (
    <footer className="bg-brand relative overflow-hidden text-white/85">
      {/* Decoração: a palavra gigante, quase transparente, cortada só pela borda de baixo (de lado ela
          fica inteira, sem passar da tela). */}
      <span
        aria-hidden="true"
        data-decorative=""
        translate="no"
        className="pointer-events-none absolute right-0 bottom-[-0.22em] font-display text-[clamp(7rem,26vw,19rem)] leading-none font-extrabold tracking-tight text-white/[0.06] select-none"
      >
        Açaí
      </span>

      <Container className="relative grid gap-10 py-12 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] md:gap-16 md:py-16">
        <div className="flex items-start gap-4">
          <Logo version="symbolOnBrand" sizes="64px" className="size-16 shrink-0" decorative />
          <div className="min-w-0">
            <p className="font-display text-2xl font-extrabold tracking-tight text-white" translate="no">
              {name}
            </p>
            <p className="mt-2 text-sm text-pretty">{storeAddressText(contact)}</p>
            <p className="text-sm text-pretty">{scheduleText(settings)}</p>
          </div>
        </div>

        <nav aria-label="Rodapé" className="grid grid-cols-2 gap-x-6 gap-y-8 text-sm sm:grid-cols-3">
          <div>
            <p id="rodape-pedir" className={groupLabel}>
              Pedir
            </p>
            <ul aria-labelledby="rodape-pedir" className="mt-2">
              <li>
                <Link to={paths.buildOrder} className={linkClass}>
                  Cardápio
                </Link>
              </li>
              <li>
                <Link to={paths.cart} className={linkClass}>
                  Carrinho
                </Link>
              </li>
              <li>
                {/* Meus pedidos (2026-11-21): os pedidos feitos neste aparelho, pela sessão dele (o código sozinho não abre nada). */}
                <Link to={paths.track()} data-footer-orders="" className={linkClass}>
                  Meus pedidos
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p id="rodape-contato" className={groupLabel}>
              Fale com a loja
            </p>
            <ul aria-labelledby="rodape-contato" className="mt-2">
              <li>
                <a href={buildWhatsAppUrl(contact.whatsapp)} target="_blank" rel="noreferrer" className={linkClass}>
                  WhatsApp
                  <span className="sr-only"> (abre em nova aba)</span>
                </a>
              </li>
              <li>
                <a href={instagramUrl} target="_blank" rel="noreferrer" className={linkClass}>
                  @{instagramHandle}
                  <span className="sr-only"> (abre em nova aba)</span>
                </a>
              </li>
            </ul>
          </div>
          <div>
            <p id="rodape-sobre" className={groupLabel}>
              Sobre
            </p>
            <ul aria-labelledby="rodape-sobre" className="mt-2">
              <li>
                <Link to={paths.credits} className={linkClass}>
                  Créditos das fotos
                </Link>
              </li>
            </ul>
          </div>
        </nav>
      </Container>

      <div className="relative border-t border-white/10">
        <Container className="py-4">
          <p className="text-xs text-white/75">
            © {new Date().getFullYear()} {name}
          </p>
        </Container>
      </div>
    </footer>
  )
}
