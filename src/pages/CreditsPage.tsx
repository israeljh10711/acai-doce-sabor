import { Container } from '../components/layout/Container.tsx'
import { getExtraItem } from '../features/catalog/extras.ts'
import { usePageTitle } from '../hooks/usePageTitle.ts'
import catalog from '../../scripts/fotos/catalogo.json'
import sources from '../../scripts/fotos/fontes.json'

/** Uma foto do cardápio (gavetas) em `catalogo.json`: de banco, ou montagem com peças. */
type CatalogSource = {
  item: string
  origem?: string
  titulo?: string
  autor?: string
  licenca?: string
  pagina?: string
  pecas?: string[]
}
type CatalogPiece = { origem: string; titulo: string; autor: string; licenca: string; pagina?: string }

const CATALOG_PHOTOS = Object.entries(catalog.fotos as unknown as Record<string, CatalogSource>)
const CATALOG_PIECES = catalog._pecas as unknown as Record<string, CatalogPiece>
const PIECE_NAMES: Record<string, string> = {
  pote: 'pote de sorvete',
  casquinhas: 'casquinhas',
  'cobertura-chocolate': 'cobertura de chocolate',
  'cobertura-morango': 'cobertura de morango',
}

/** Endereço de cada licença, para o crédito apontar o texto completo. */
const LICENSE_URLS: Record<string, string> = {
  'CC BY 2.0': 'https://creativecommons.org/licenses/by/2.0/deed.pt-br',
  'CC BY 2.5': 'https://creativecommons.org/licenses/by/2.5/deed.pt-br',
  'CC BY 4.0': 'https://creativecommons.org/licenses/by/4.0/deed.pt-br',
  'CC BY-SA 2.0': 'https://creativecommons.org/licenses/by-sa/2.0/deed.pt-br',
  'CC BY-SA 2.5': 'https://creativecommons.org/licenses/by-sa/2.5/deed.pt-br',
  'CC BY-SA 3.0': 'https://creativecommons.org/licenses/by-sa/3.0/deed.pt-br',
  'CC BY-SA 4.0': 'https://creativecommons.org/licenses/by-sa/4.0/deed.pt-br',
  CC0: 'https://creativecommons.org/publicdomain/zero/1.0/deed.pt-br',
  'Licença Pexels': 'https://www.pexels.com/pt-br/license/',
}

/** Fotos enviadas pela loja em 2026-11-14 (assets/fotos-loja). */
const STORE_PHOTOS = [
  'Fotos dos produtos: Açaí Oca, Açaí Tradicional, Açaí Batido e Milk-shake',
  'Leite condensado (Italac)',
  'Leite em pó (Ninho)',
  'Farinha láctea (Nestlé)',
  'Marshmallow',
  'Amendoim',
  'Chocoball',
  'Paçoca',
  'Disquete (confete)',
  'Banana',
  'Creme de ninho',
  'Creme de avelã',
  'Creme de cookies, Creme de morango e Ovomaltine (adicionais do Açaí Batido)',
  'Coberturas Du Porto: frutas vermelhas, doce de leite, açaí, banana caramelada, chocolate e morango',
]

const label = (key: string) => key.replaceAll('-', ' ')

const linkClass = 'text-acai-700 underline underline-offset-2'

function LicenseLink({ license }: { license: string }) {
  const url = LICENSE_URLS[license]
  if (!url) return <>{license === 'Licença Pexels' || license === 'Foto da loja' ? license : 'Domínio público'}</>
  return (
    <a href={url} target="_blank" rel="noreferrer" className="font-semibold text-acai-700 underline underline-offset-2">
      {license}
    </a>
  )
}

/**
 * Créditos das fotos: as enviadas pela loja e as de banco (autor, licença e página de origem).
 * As licenças CC BY e CC BY-SA pedem esse crédito; nas CC BY-SA, as imagens derivadas
 * (recortes, texturas e ajustes de cor) seguem a mesma licença.
 */
export function CreditsPage() {
  usePageTitle('Créditos das fotos', {
    description:
      'Autores, licenças e origem das fotos de ingredientes e do cardápio usadas no site do Açaí Doce Sabor, em Teixeira, Paraíba.',
  })

  return (
    <Container className="py-10 sm:py-14">
      <h1 className="font-display text-4xl font-black tracking-tight text-acai-800 uppercase">Créditos das fotos</h1>
      <div className="mt-4 max-w-3xl space-y-3 text-ink-soft">
        <p>
          As fotos dos produtos e da maior parte dos ingredientes foram enviadas pela loja. As demais fotos de
          ingredientes e as fotos dos itens de “Mais opções do cardápio” são de bancos com licença de uso comercial
          (Pexels, Wikimedia Commons e Open Food Facts) e não são da loja: são ilustrativas. Foram recortadas em
          quadrado; as imagens feitas a partir de fotos CC BY-SA seguem a mesma licença.
        </p>
      </div>

      <h2 className="mt-10 font-display text-2xl font-black tracking-tight text-acai-800 uppercase">Fotos enviadas pela loja</h2>
      <p className="mt-2 max-w-3xl text-ink-soft">
        Fotos dos produtos e embalagens que a loja usa, enviadas em 14/11/2026. As marcas pertencem aos seus donos.
      </p>
      <ul className="mt-3 grid max-w-3xl list-disc gap-1 pl-5 text-acai-950 sm:grid-cols-2">
        {STORE_PHOTOS.map((name) => (
          <li key={name}>{name}</li>
        ))}
      </ul>

      <h2 className="mt-10 font-display text-2xl font-black tracking-tight text-acai-800 uppercase">
        Fotos do cardápio
      </h2>
      <p className="mt-2 max-w-3xl text-ink-soft">
        Uma foto para cada item das gavetas (combos, potes, picolés, bebidas e doces). Os dois kits e o Combo 1 Litro
        são montagens feitas para o site com fotos recortadas.
      </p>

      <div className="mt-4 overflow-x-auto rounded-2xl ring-1 ring-line">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <caption className="sr-only">Fotos do cardápio, autores e licenças</caption>
          <thead className="bg-acai-50 text-acai-800">
            <tr>
              <th scope="col" className="px-4 py-3 font-bold">Item</th>
              <th scope="col" className="px-4 py-3 font-bold">Autor</th>
              <th scope="col" className="px-4 py-3 font-bold">Licença</th>
              <th scope="col" className="px-4 py-3 font-bold">Original</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {CATALOG_PHOTOS.map(([file, source]) => {
              const name = getExtraItem(source.item)?.name ?? source.item
              if (source.pecas) {
                return (
                  <tr key={file}>
                    <td className="px-4 py-2.5 font-semibold text-acai-950">{name}</td>
                    <td className="px-4 py-2.5 text-acai-950" colSpan={3}>
                      Montagem feita para o site com:{' '}
                      {source.pecas.map((key, index) => {
                        const piece = CATALOG_PIECES[key]
                        return (
                          <span key={key}>
                            {index > 0 && '; '}
                            {PIECE_NAMES[key] ?? key} ({piece.autor}, {piece.licenca}
                            {piece.pagina && (
                              <>
                                {', '}
                                <a href={piece.pagina} target="_blank" rel="noreferrer" className={linkClass}>
                                  {piece.origem}
                                  <span className="sr-only"> (abre em nova aba)</span>
                                </a>
                              </>
                            )}
                            )
                          </span>
                        )
                      })}
                    </td>
                  </tr>
                )
              }
              return (
                <tr key={file}>
                  <td className="px-4 py-2.5 font-semibold text-acai-950">{name}</td>
                  <td className="px-4 py-2.5 text-acai-950">{source.autor}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <LicenseLink license={source.licenca ?? ''} />
                  </td>
                  <td className="px-4 py-2.5">
                    <a href={source.pagina} target="_blank" rel="noreferrer" className={linkClass}>
                      {source.origem}
                      <span className="sr-only">: {source.titulo} (abre em nova aba)</span>
                    </a>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <h2 className="mt-10 font-display text-2xl font-black tracking-tight text-acai-800 uppercase">
        Fotos de banco dos ingredientes
      </h2>

      <div className="mt-4 overflow-x-auto rounded-2xl ring-1 ring-line">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <caption className="sr-only">Fotos, autores e licenças</caption>
          <thead className="bg-acai-50 text-acai-800">
            <tr>
              <th scope="col" className="px-4 py-3 font-bold">Uso no site</th>
              <th scope="col" className="px-4 py-3 font-bold">Autor</th>
              <th scope="col" className="px-4 py-3 font-bold">Licença</th>
              <th scope="col" className="px-4 py-3 font-bold">Original</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {Object.entries(sources).map(([key, source]) => {
              const licenseUrl = LICENSE_URLS[source.licenca]
              return (
                <tr key={key}>
                  <td className="px-4 py-2.5 font-semibold text-acai-950 first-letter:uppercase">{label(key)}</td>
                  <td className="px-4 py-2.5 text-acai-950">{source.autor}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    {licenseUrl ? (
                      <a href={licenseUrl} target="_blank" rel="noreferrer" className="font-semibold text-acai-700 underline underline-offset-2">
                        {source.licenca}
                      </a>
                    ) : (
                      'Domínio público'
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <a href={source.pagina} target="_blank" rel="noreferrer" className="text-acai-700 underline underline-offset-2">
                      {source.origem}
                      <span className="sr-only">: {source.arquivo} (abre em nova aba)</span>
                    </a>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Container>
  )
}
