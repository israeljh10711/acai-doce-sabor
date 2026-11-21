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
  'inline-flex min-h-11 items-center font-medium text-white/85 hover:text-gold-400 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-white'

export function SiteFooter() {
  // Horário, contato e identidade atuais (Configurações da loja, 2026-11-17 e 2026-11-21).
  const settings = useStoreSettings()
  const { contact } = settings
  const { name } = settings.identity
  const instagramHandle = settings.identity.instagram
  const instagramUrl = instagramHandle ? `https://www.instagram.com/${instagramHandle}/` : storeInfo.instagramUrl

  return (
    <footer className="bg-acai-950 text-white/80">
      <Container className="flex flex-col gap-6 py-10 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Logo version="badge" sizes="56px" className="size-14" decorative />
          <div>
            <p className="font-display text-lg font-extrabold tracking-tight text-white uppercase" translate="no">{name}</p>
            <p className="text-sm">{storeAddressText(contact)}</p>
            <p className="text-sm">{scheduleText(settings)}</p>
          </div>
        </div>

        <nav aria-label="Rodapé">
          <ul className="flex flex-wrap gap-x-6 text-sm">
            <li>
              <Link to={paths.buildOrder} className={linkClass}>
                <span className="link-draw">Cardápio</span>
              </Link>
            </li>
            <li>
              <Link to={paths.cart} className={linkClass}>
                <span className="link-draw">Carrinho</span>
              </Link>
            </li>
            <li>
              {/* Meus pedidos (2026-11-21): os pedidos feitos neste aparelho, pela sessão dele (o código sozinho não abre nada). */}
              <Link to={paths.track()} data-footer-orders="" className={linkClass}>
                <span className="link-draw">Meus pedidos</span>
              </Link>
            </li>
            <li>
              <a href={buildWhatsAppUrl(contact.whatsapp)} target="_blank" rel="noreferrer" className={linkClass}>
                <span className="link-draw">WhatsApp</span>
                <span className="sr-only"> (abre em nova aba)</span>
              </a>
            </li>
            <li>
              <a href={instagramUrl} target="_blank" rel="noreferrer" className={linkClass}>
                <span className="link-draw">@{instagramHandle}</span>
                <span className="sr-only"> (abre em nova aba)</span>
              </a>
            </li>
            <li>
              <Link to={paths.credits} className={linkClass}>
                <span className="link-draw">Créditos das fotos</span>
              </Link>
            </li>
          </ul>
        </nav>
      </Container>

      <div className="border-t border-white/10">
        <Container className="py-4">
          <p className="text-xs">
            © {new Date().getFullYear()} {name}
          </p>
        </Container>
      </div>
    </footer>
  )
}
