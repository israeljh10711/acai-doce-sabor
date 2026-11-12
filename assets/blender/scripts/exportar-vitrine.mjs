// Grava em assets/blender/vitrine.json a montagem 3D das três vitrines da página inicial,
// calculada pelo próprio site (a mesma função da cena 3D), para o Blender renderizar igual.
//
// Uso, com o site rodando em desenvolvimento (npm run dev):
//   node assets/blender/scripts/exportar-vitrine.mjs [endereçoBase]
import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { openBrowser } from '../../../tests/browser/lib.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const baseUrl = process.argv[2] ?? 'http://127.0.0.1:5173'
const out = join(here, '..', 'vitrine.json')

const browser = await openBrowser(join(tmpdir(), 'acai-doce-sabor-conferencia', 'edge-profile-vitrine'), 9343)
try {
  await browser.goto(baseUrl + '/', { width: 800, height: 600 })
  const json = await browser.evaluate(`(async () => {
    const { layoutScene } = await import('/src/features/configurator-3d/layout.ts')
    const { showcaseOf } = await import('/src/features/catalog/showcase.ts')
    const out = {}
    for (const slug of ['acai-oca', 'acai-tradicional', 'milk-shake']) {
      const showcase = showcaseOf(slug)
      out[slug] = { title: showcase.title, layout: layoutScene(showcase) }
    }
    return JSON.stringify(out, null, 2)
  })()`)
  writeFileSync(out, json + '\n')
  console.log('gravado:', out)
} finally {
  browser.close()
}
