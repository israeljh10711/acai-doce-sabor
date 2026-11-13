import { Container } from '../../components/layout/Container.tsx'
import type { ComposerInput } from '../../features/photo-composer/layout.ts'
import { ProductPhotoComposer } from '../../features/photo-composer/ProductPhotoComposer.tsx'

/** Só em desenvolvimento: várias montagens lado a lado, para conferir o compositor. */
const SAMPLES: (ComposerInput & { label: string })[] = [
  { label: 'Oca · Isopor GG', slug: 'acai-oca', sizeId: 'isopor-gg', flavorId: null, toppings: { morango: 1, amendoim: 1, banana: 1, chocoball: 1, 'calda-leite-condensado': 1 } },
  { label: 'Tradicional · Copo 500', slug: 'acai-tradicional', sizeId: 'copo-500', flavorId: null, toppings: { granola: 2, banana: 1, morango: 1, 'calda-leite-condensado': 1, 'creme-de-ninho': 1 } },
  { label: 'Oca · Pote 530', slug: 'acai-oca', sizeId: 'pote-530', flavorId: null, toppings: { 'leite-em-po': 1, pacoca: 1, kiwi: 1, 'creme-de-avela': 1, cereja: 1, 'kit-kat': 1 } },
  { label: 'Tradicional · Isopor M', slug: 'acai-tradicional', sizeId: 'isopor-m', flavorId: null, toppings: { 'gotas-de-chocolate': 1, sucrilhos: 1, marshmallow: 1, biscoito: 1, canudinho: 1, 'calda-chocolate': 1, bis: 1 } },
  { label: 'Batido · 500 · Paçoca', slug: 'acai-batido', sizeId: '500-ml', flavorId: 'leite-condensado-pacoca', toppings: { 'batido-creme-de-avela': 1, 'batido-ovomaltine': 1 } },
  { label: 'Milk-shake · Morango', slug: 'milk-shake', sizeId: '500-ml', flavorId: 'morango', toppings: { 'calda-chocolate': 1, cereja: 1 } },
  { label: 'Milk-shake · Chocolate', slug: 'milk-shake', sizeId: '400-ml', flavorId: 'chocolate', toppings: { 'calda-doce-de-leite': 1, 'creme-de-ninho': 1 } },
  { label: 'Oca · vazio', slug: 'acai-oca', sizeId: null, flavorId: null, toppings: {} },
]

export function ComposerGallery() {
  return (
    <Container className="py-8">
      <h1 className="font-display text-2xl font-black uppercase">Compositor</h1>
      <ul className="mt-6 grid grid-cols-2 gap-6 lg:grid-cols-4">
        {SAMPLES.map(({ label, ...input }) => (
          <li key={label} className="rounded-3xl bg-acai-50 p-3 ring-1 ring-line">
            <ProductPhotoComposer {...input} tilt priority />
            <p className="mt-2 text-center text-sm font-semibold">{label}</p>
          </li>
        ))}
      </ul>
    </Container>
  )
}
