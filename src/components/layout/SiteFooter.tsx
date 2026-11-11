import { storeInfo } from '../../services/storeInfo.ts'
import { buildWhatsAppUrl } from '../../utils/whatsapp.ts'

const linkClass =
  'inline-flex min-h-11 items-center underline underline-offset-4 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'

export function SiteFooter() {
  const { address, instagramHandle, whatsapp } = storeInfo

  return (
    <footer className="bg-brand-950 text-white/85">
      <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-8 text-sm sm:grid-cols-3 sm:px-6">
        <div>
          <h2 className="font-semibold text-white">WhatsApp</h2>
          <a
            href={buildWhatsAppUrl(whatsapp)}
            target="_blank"
            rel="noreferrer"
            className={linkClass}
          >
            {whatsapp}
            <span className="sr-only"> (abre em nova aba)</span>
          </a>
        </div>

        <div>
          <h2 className="font-semibold text-white">Instagram</h2>
          <a
            href={`https://www.instagram.com/${instagramHandle}/`}
            target="_blank"
            rel="noreferrer"
            className={linkClass}
          >
            @{instagramHandle}
            <span className="sr-only"> (abre em nova aba)</span>
          </a>
        </div>

        <div>
          <h2 className="font-semibold text-white">Endereço</h2>
          <address className="mt-3 not-italic">
            {address.street}
            <br />
            {address.city}, {address.state}
          </address>
        </div>
      </div>
    </footer>
  )
}
