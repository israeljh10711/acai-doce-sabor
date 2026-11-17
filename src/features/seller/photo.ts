/**
 * Foto escolhida na galeria ou na câmera (pedido de 2026-11-16): reduzida no próprio aparelho a
 * até 800 px no lado maior e comprimida em WebP (qualidade 0,82), ou JPEG quando o navegador não
 * gera WebP (Safari antigo). Assim a foto de 12 MP do celular vira algumas dezenas de KB.
 */
import { fitWithin } from './sellerForm.ts'

const QUALITY = 0.82

const toBlob = (canvas: HTMLCanvasElement, type: string) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, QUALITY))

export async function compressPhoto(file: File): Promise<Blob> {
  // createImageBitmap respeita a rotação da câmera (EXIF) nos navegadores atuais.
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  try {
    const size = fitWithin(bitmap.width, bitmap.height)
    const canvas = document.createElement('canvas')
    canvas.width = size.width
    canvas.height = size.height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Sem canvas')
    context.imageSmoothingQuality = 'high'
    context.drawImage(bitmap, 0, 0, size.width, size.height)
    const webp = await toBlob(canvas, 'image/webp')
    if (webp && webp.type === 'image/webp') return webp
    const jpeg = await toBlob(canvas, 'image/jpeg')
    if (!jpeg) throw new Error('Não deu para comprimir a foto')
    return jpeg
  } finally {
    bitmap.close()
  }
}
