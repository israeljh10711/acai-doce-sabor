/**
 * Lê o cabeçalho binário de uma imagem (JPEG, PNG ou WebP) e devolve o formato e o tamanho em
 * pixels, sem decodificar a imagem. `null` quando o arquivo não começa como nenhum dos três
 * (página de erro salva no lugar da foto, arquivo cortado...).
 */
export type ImageInfo = { format: 'jpeg' | 'png' | 'webp'; width: number; height: number }

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

export function imageInfo(data: Buffer): ImageInfo | null {
  if (data.length >= 24 && PNG_SIGNATURE.every((byte, index) => data[index] === byte) && data.toString('ascii', 12, 16) === 'IHDR') {
    return { format: 'png', width: data.readUInt32BE(16), height: data.readUInt32BE(20) }
  }
  if (data.length >= 4 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return jpegInfo(data)
  if (data.length >= 30 && data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP') return webpInfo(data)
  return null
}

function jpegInfo(data: Buffer): ImageInfo | null {
  let offset = 2
  while (offset + 9 < data.length) {
    if (data[offset] !== 0xff) return null
    const marker = data[offset + 1]
    // Quadro (SOF0 a SOF15, menos DHT C4, JPG C8 e DAC CC): altura e largura do quadro.
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { format: 'jpeg', height: data.readUInt16BE(offset + 5), width: data.readUInt16BE(offset + 7) }
    }
    offset += 2 + data.readUInt16BE(offset + 2)
  }
  return null
}

function webpInfo(data: Buffer): ImageInfo | null {
  const chunk = data.toString('ascii', 12, 16)
  if (chunk === 'VP8 ' && data[23] === 0x9d && data[24] === 0x01 && data[25] === 0x2a) {
    return { format: 'webp', width: data.readUInt16LE(26) & 0x3fff, height: data.readUInt16LE(28) & 0x3fff }
  }
  if (chunk === 'VP8L' && data[20] === 0x2f) {
    const bits = data.readUInt32LE(21)
    return { format: 'webp', width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 }
  }
  if (chunk === 'VP8X') {
    return { format: 'webp', width: data.readUIntLE(24, 3) + 1, height: data.readUIntLE(27, 3) + 1 }
  }
  return null
}
