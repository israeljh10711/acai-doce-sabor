/**
 * Acha a foto do produto numa captura de tela do catálogo do WhatsApp (pedido de 2026-11-16).
 *
 * A captura tem a foto em cima, numa moldura do cinza-escuro do WhatsApp (22, 23, 23), e embaixo
 * um bloco desse mesmo cinza com o nome, o preço e a descrição em branco. Às vezes a captura é só
 * a foto, sem bloco.
 *
 * - Fundo: pixel quase igual ao cinza do WhatsApp (diferença de até 6 em cada canal). Mais
 *   estrito que "escuro": uma foto com sombra ou chocolate quase preto não é confundida com fundo.
 * - Topo: a primeira linha que não é quase toda fundo (menos de 90%).
 * - Fim da foto: o começo da primeira sequência de 15 ou mais linhas com 90% ou mais de fundo
 *   (o espaço entre a foto e o texto). Sem sequência, a foto vai até o fim da captura.
 * - Depois tira, em cima e embaixo, as linhas com 80% ou mais de fundo ou da barrinha de
 *   rolagem do carrossel (cinza 59, 60, 60, logo abaixo da foto) e, dos lados, as colunas com 90%
 *   ou mais de fundo dentro da altura da foto (a moldura lateral, de 2 a 16 px).
 * - Por fim, se um pedaço da foto vizinha do carrossel aparece na beirada, separado por uma
 *   coluna do cinza do WhatsApp, esse pedaço sai.
 */
const BACKGROUND = [22, 23, 23]
/** A barrinha de rolagem do carrossel, logo abaixo da foto. */
const SCROLLBAR = [59, 60, 60]
const TOLERANCE = 6
const GAP_ROWS = 15

const near = (data, index, color) =>
  Math.abs(data[index] - color[0]) <= TOLERANCE &&
  Math.abs(data[index + 1] - color[1]) <= TOLERANCE &&
  Math.abs(data[index + 2] - color[2]) <= TOLERANCE

export const isBackground = (data, index) => near(data, index, BACKGROUND)

/** Fundo do WhatsApp ou barrinha de rolagem: o que não é foto nas beiradas. */
const isInterface = (data, index) => near(data, index, BACKGROUND) || near(data, index, SCROLLBAR)

/**
 * Caixa da foto: `{ left, top, width, height }` em pixels, e `caption` (a altura do bloco de
 * texto que sobrou embaixo, 0 se a captura não tem bloco). `data` é RGB cru (3 canais).
 */
export function detectPhotoBox(data, width, height) {
  const rowBackground = new Float64Array(height)
  const rowInterface = new Float64Array(height)
  for (let y = 0; y < height; y++) {
    let background = 0
    let ui = 0
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 3
      if (isBackground(data, index)) background++
      if (isInterface(data, index)) ui++
    }
    rowBackground[y] = background / width
    rowInterface[y] = ui / width
  }

  let top = 0
  while (top < height && rowBackground[top] >= 0.9) top++

  let bottom = height
  for (let y = top; y + GAP_ROWS <= height; y++) {
    let gap = true
    for (let k = 0; k < GAP_ROWS; k++) {
      if (rowBackground[y + k] < 0.9) {
        gap = false
        y += k
        break
      }
    }
    if (gap) {
      bottom = y
      break
    }
  }
  while (bottom > top && rowInterface[bottom - 1] >= 0.8) bottom--
  while (top < bottom && rowInterface[top] >= 0.8) top++

  const columnBackground = (x) => {
    let count = 0
    for (let y = top; y < bottom; y++) if (isBackground(data, (y * width + x) * 3)) count++
    return count / Math.max(1, bottom - top)
  }
  let left = 0
  while (left < width && columnBackground(left) >= 0.9) left++
  let right = width
  while (right > left && columnBackground(right - 1) >= 0.9) right--

  // Carrossel: um pedaço da foto vizinha aparece na beirada, separado por uma coluna do cinza do
  // WhatsApp. Se essa coluna está no último terço (ou no primeiro), o pedaço depois dela sai.
  const span = right - left
  for (let x = right - 1; x > left + span * 0.66; x--) {
    if (columnBackground(x) >= 0.85) {
      right = x
      while (right > left && columnBackground(right - 1) >= 0.6) right--
      break
    }
  }
  for (let x = left; x < left + span * 0.34; x++) {
    if (columnBackground(x) >= 0.85) {
      left = x + 1
      while (left < right && columnBackground(left) >= 0.6) left++
      break
    }
  }

  return { left, top, width: right - left, height: bottom - top, caption: height - bottom }
}
