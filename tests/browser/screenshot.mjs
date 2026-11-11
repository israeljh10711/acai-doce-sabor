// Fotografa uma página em um tamanho de tela: inteira, só a primeira tela ou um recorte.
//
// Uso (com o site rodando):
//   node tests/browser/screenshot.mjs <endereço> <largura> <altura> <saída.png> [tela | x,y,largura,altura] [dpr]
//
// Exemplos:
//   node tests/browser/screenshot.mjs http://127.0.0.1:5173/ 390 844 inicio.png
//   node tests/browser/screenshot.mjs http://127.0.0.1:5173/ 390 844 primeira-tela.png tela 2
import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openBrowser } from './lib.mjs'

const [url, widthArg, heightArg, out, area, dprArg] = process.argv.slice(2)
if (!url || !widthArg || !heightArg || !out) {
  console.error(
    'Uso: node tests/browser/screenshot.mjs <endereço> <largura> <altura> <saída.png> [tela | x,y,largura,altura] [dpr]',
  )
  process.exit(2)
}

const width = Number(widthArg)
const height = Number(heightArg)

const browser = await openBrowser(
  join(tmpdir(), 'acai-doce-sabor-conferencia', 'edge-profile-foto'),
  9335,
)
try {
  await browser.goto(url, { width, height, dpr: Number(dprArg ?? 1) })

  let clip
  if (area === 'tela') {
    clip = { x: 0, y: 0, width, height }
  } else if (area) {
    const [x, y, w, h] = area.split(',').map(Number)
    clip = { x, y, width: w, height: h }
  }

  writeFileSync(out, await browser.screenshot(clip))
  console.log('salvo:', out)
} finally {
  browser.close()
}
