import logo96 from '../../assets/brand/logo-96.webp'
import logo192 from '../../assets/brand/logo-192.webp'
import logo384 from '../../assets/brand/logo-384.webp'
import logoClean384 from '../../assets/brand/logo-clean-384.webp'
import logoClean768 from '../../assets/brand/logo-clean-768.webp'
import symbolClean96 from '../../assets/brand/symbol-clean-96.webp'
import symbolClean192 from '../../assets/brand/symbol-clean-192.webp'
import { storeInfo } from '../../services/storeInfo.ts'

/**
 * Versões da logo oficial, todas tiradas do arquivo enviado pelo proprietário
 * (o original fica em `assets/brand/logo-original.jpg`).
 *
 * - `badge`: a logo inteira dentro do disco roxo. Serve em qualquer fundo.
 * - `onBrand`: a logo inteira sem o disco, só a tigela, as folhas e o nome.
 *   Para o fundo roxo da marca, onde não deixa contorno nem halo.
 * - `symbolOnBrand`: só a tigela com as folhas, sem o disco, para tamanhos pequenos
 *   no fundo roxo, onde o nome em letra cursiva ficaria ilegível.
 */
const versions = {
  badge: {
    fallback: logo192,
    files: [
      [logo96, 96],
      [logo192, 192],
      [logo384, 384],
    ],
  },
  onBrand: {
    fallback: logoClean384,
    files: [
      [logoClean384, 384],
      [logoClean768, 768],
    ],
  },
  symbolOnBrand: {
    fallback: symbolClean96,
    files: [
      [symbolClean96, 96],
      [symbolClean192, 192],
    ],
  },
} as const

type LogoProps = {
  version: keyof typeof versions
  /** Largura em que a logo aparece na tela, no formato do atributo `sizes`. Ex.: "44px". */
  sizes: string
  /** Classes de tamanho e posição. A logo é sempre quadrada. */
  className?: string
  /** Use quando o nome da loja já aparece em texto ao lado, para não ser lido duas vezes. */
  decorative?: boolean
}

/** O navegador escolhe o arquivo mais leve que atende ao tamanho pedido. */
export function Logo({ version, sizes, className, decorative = false }: LogoProps) {
  const { fallback, files } = versions[version]

  return (
    <img
      src={fallback}
      srcSet={files.map(([url, width]) => `${url} ${width}w`).join(', ')}
      sizes={sizes}
      width={384}
      height={384}
      alt={decorative ? '' : storeInfo.name}
      decoding="async"
      className={className}
    />
  )
}
