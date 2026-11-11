import { Link } from 'react-router'
import { paths } from '../../paths.ts'
import { storeInfo } from '../../services/storeInfo.ts'
import { buildWhatsAppUrl } from '../../utils/whatsapp.ts'
import { Logo } from '../brand/Logo.tsx'
import { Container } from './Container.tsx'

const linkClass =
  'inline-flex min-h-11 items-center text-white/85 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'

export function SiteFooter() {
  const { address, instagramHandle, instagramUrl, name, whatsapp } = storeInfo

  return (
    <footer className="bg-plum-950 text-white/80">
      <Container className="flex flex-col gap-6 py-10 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Logo version="badge" sizes="56px" className="size-14" decorative />
          <div>
            <p className="font-display text-lg font-semibold tracking-tight text-white">{name}</p>
            <p className="text-sm">
              {address.city}, {address.state}
            </p>
          </div>
        </div>

        <nav aria-label="Rodapé">
          <ul className="flex flex-wrap gap-x-6 text-sm">
            <li>
              <Link to={paths.home} className={linkClass}>
                <span className="link-draw">Início</span>
              </Link>
            </li>
            <li>
              <Link to={paths.buildOrder} className={linkClass}>
                <span className="link-draw">Monte seu Pedido</span>
              </Link>
            </li>
            <li>
              <a
                href={buildWhatsAppUrl(whatsapp)}
                target="_blank"
                rel="noreferrer"
                className={linkClass}
              >
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
