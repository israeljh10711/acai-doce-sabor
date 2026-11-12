// Grava, a partir do próprio site (as mesmas funções da cena 3D), o que o Blender precisa para
// renderizar igual:
//   - assets/blender/vitrine.json: a montagem 3D das três vitrines da página inicial;
//   - assets/blender/ingredientes.json: o modelo, o jeito de posicionar e a cor de cada
//     ingrediente do cardápio, para as miniaturas dos personalizadores.
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

const browser = await openBrowser(join(tmpdir(), 'acai-doce-sabor-conferencia', 'edge-profile-vitrine'), 9343)
try {
  await browser.goto(baseUrl + '/', { width: 800, height: 600 })
  const json = await browser.evaluate(`(async () => {
    const { layoutScene } = await import('/src/features/configurator-3d/layout.ts')
    const { showcaseOf } = await import('/src/features/catalog/showcase.ts')
    const { MODEL_SPECS } = await import('/src/features/configurator-3d/models.ts')
    const { TOPPINGS } = await import('/src/features/catalog/menu.ts')
    const { TOPPING_LOOKS } = await import('/src/features/catalog/illustration/looks.ts')
    const vitrine = {}
    for (const slug of ['acai-oca', 'acai-tradicional', 'milk-shake']) {
      const showcase = showcaseOf(slug)
      vitrine[slug] = { title: showcase.title, layout: layoutScene(showcase) }
    }
    const ingredientes = {}
    for (const topping of TOPPINGS) {
      const spec = MODEL_SPECS[topping.id]
      const look = TOPPING_LOOKS[topping.id]
      ingredientes[topping.id] = {
        name: topping.name,
        group: topping.group,
        placement: spec.placement,
        file: typeof spec.file === 'string' ? spec.file : spec.file.acai,
        color: spec.color ?? (look && 'color' in look ? look.color : null),
      }
    }
    return JSON.stringify({ vitrine, ingredientes })
  })()`)
  const { vitrine, ingredientes } = JSON.parse(json)
  for (const [name, data] of [
    ['vitrine.json', vitrine],
    ['ingredientes.json', ingredientes],
  ]) {
    const out = join(here, '..', name)
    writeFileSync(out, JSON.stringify(data, null, 2) + '\n')
    console.log('gravado:', out)
  }
} finally {
  browser.close()
}
