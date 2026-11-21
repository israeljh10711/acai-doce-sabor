import { describe, expect, it } from 'vitest'
import { baseCatalogRecords } from '../features/catalog/baseRecords.ts'
import { draftOf, duplicateDraft, newDraft, productPayload, settleDraft } from '../features/catalog/productDraft.ts'
import type { CatalogRecords } from '../features/catalog/records.ts'
import { recordsToCatalog } from '../features/catalog/recordsAdapter.ts'
import { CatalogWriteError, LocalWriteError, createLocalWriter, createSupabaseWriter, writeErrorText } from './catalogWriter.ts'

const NOW = Date.parse('2026-11-21T15:00:00Z')

function localWriter(start: CatalogRecords = baseCatalogRecords()) {
  let records = start
  const writer = createLocalWriter({ load: () => records, save: (next) => void (records = next), now: () => '2026-11-21T15:00:00.000Z' })
  return { writer, records: () => records }
}
const taken = (records: CatalogRecords) => new Set(records.products.map((product) => product.id))

describe('gravação local (demonstração)', () => {
  it('cria um produto montável novo com tamanhos, sabor e grupos, e ele aparece no cardápio', async () => {
    const { writer, records } = localWriter()
    const draft = newDraft(records(), 'montavel', 'barcas-e-potes')
    draft.product.name = 'Açaí Zero'
    draft.product.completo = true
    draft.product.details = { actionLabel: 'Montar açaí Zero' }
    draft.variants = [{ productId: '', id: '', name: 'Copo 300 ml', container: 'copo', priceCents: 1500, freeCount: 2, available: true, position: 0 }]
    draft.choices = [{ productId: '', id: '', label: 'Base', allowOther: false, photoAlt: null, position: 0, options: [{ productId: '', choiceId: '', id: '', name: 'Natural', photo: null, available: true, position: 0 }] }]
    draft.groups = [{ productId: '', groupId: 'dry', position: 0, maxSelect: null }]
    const settled = settleDraft(draft, taken(records()))
    expect(settled.product.id).toBe('acai-zero')
    expect(settled.variants[0].id).toBe('copo-300-ml')
    await writer.saveProduct(settled)
    const data = recordsToCatalog(records(), { now: NOW })
    expect(data.products['acai-zero' as 'acai-oca']).toMatchObject({ name: 'Açaí Zero', groups: ['dry'], flavors: [{ id: 'natural', name: 'Natural' }], completo: true })
    expect(data.items.find((item) => item.id === 'acai-zero')).toMatchObject({ priceCents: 1500, action: { type: 'customizer', label: 'Montar açaí Zero' } })
  })

  it('recusa montável sem tamanho, tamanhos repetidos e produto direto na vitrine', async () => {
    const { writer, records } = localWriter()
    const empty = settleDraft({ ...newDraft(records(), 'montavel', 'bebidas'), product: { ...newDraft(records(), 'montavel', 'bebidas').product, name: 'Sem tamanho' } }, taken(records()))
    await expect(writer.saveProduct(empty)).rejects.toThrow('pelo menos um tamanho')
    const oca = draftOf(records(), 'acai-oca')!
    const repeated = { ...oca, variants: [...oca.variants, { ...oca.variants[0], id: 'outro' }] }
    await expect(writer.saveProduct(repeated)).rejects.toThrow('mesmo nome')
    const jujuba = draftOf(records(), 'jujuba')!
    await expect(writer.saveProduct({ ...jujuba, product: { ...jujuba.product, categoryId: 'monte-do-seu-jeito' } })).rejects.toThrow('só entram produtos montáveis')
    expect(records()).toEqual(baseCatalogRecords())
  })

  it('"Duplicar produto" cria outro id, com tudo copiado, oculto até revisar', async () => {
    const { writer, records } = localWriter()
    const copy = duplicateDraft(records(), 'kit-completo-casquinha')!
    expect(copy.product.id).toBe('kit-completo-casquinha-duo-copia')
    expect(copy.product.visible).toBe(false)
    await writer.saveProduct(copy)
    expect(records().choiceOptions.filter((option) => option.productId === copy.product.id).length).toBe(
      records().choiceOptions.filter((option) => option.productId === 'kit-completo-casquinha').length,
    )
    expect(records().products.find((product) => product.id === 'kit-completo-casquinha')?.visible).toBe(true)
  })

  it('marca esgotado, oculta e arquiva; categoria com produtos não arquiva', async () => {
    const { writer, records } = localWriter()
    await writer.patch('catalog_products', { id: 'jujuba' }, { available: false })
    await writer.patch('catalog_options', { id: 'kiwi' }, { available: false })
    await writer.patch('catalog_choice_options', { product_id: 'cremosinho', choice_id: 'sabor', id: 'coco' }, { available: false })
    const data = recordsToCatalog(records(), { now: NOW })
    expect(data.items.find((item) => item.id === 'jujuba')?.available).toBe(false)
    expect(data.toppings.find((topping) => topping.id === 'kiwi')?.available).toBe(false)
    const cremosinho = data.items.find((item) => item.id === 'cremosinho')!
    expect(cremosinho.action.type === 'flavor_modal' && cremosinho.action.choices[0].unavailable).toEqual(['Coco'])
    await expect(writer.patch('catalog_categories', { id: 'bebidas' }, { archived_at: '2026-11-21T15:00:00Z' })).rejects.toThrow('ainda tem produtos')
    await expect(writer.patch('catalog_products', { id: 'nao-existe' }, { available: false })).rejects.toBeInstanceOf(LocalWriteError)
  })

  it('reordena ("Subir"/"Descer") e cria oferta com preço promocional', async () => {
    const { writer, records } = localWriter()
    await writer.reorder('categorias', ['bebidas', 'monte-do-seu-jeito', 'combos-e-ofertas', 'barcas-e-potes', 'picoles-e-sorvetes', 'doces-e-bomboniere'])
    expect(recordsToCatalog(records(), { now: NOW }).drawers[0].id).toBe('bebidas')
    await writer.saveOffer({ ...records().offers[0], id: 'agua-promo', productId: 'agua-mineral-500-ml', title: 'Água gelada', promoPriceCents: 150, position: 0 })
    expect(recordsToCatalog(records(), { now: NOW }).items.find((item) => item.id === 'agua-mineral-500-ml')?.priceCents).toBe(150)
    await expect(writer.saveOffer({ ...records().offers[0], id: 'ruim', variantId: 'nao-existe' })).rejects.toThrow('tamanho deste produto')
  })

  it('confere grupo e complemento', async () => {
    const { writer, records } = localWriter()
    await expect(writer.saveGroup({ ...records().groups[0], minSelect: 3, maxSelect: 2 })).rejects.toThrow('menor que o mínimo')
    await expect(writer.saveOption({ ...records().options[0], image: 'https://x.co/foto.svg' })).rejects.toThrow('Foto inválida')
    await writer.saveGroup({ ...records().groups[1], freeCount: 1, extraPriceCents: 200 })
    expect(recordsToCatalog(records(), { now: NOW }).groups.fruit).toMatchObject({ freeCount: 1, extraPriceCents: 200 })
  })
})

describe('gravação no Supabase', () => {
  function fakeRest() {
    const calls: { method: string; args: unknown[] }[] = []
    return {
      calls,
      rest: {
        rpc: async (...args: unknown[]) => void calls.push({ method: 'rpc', args }),
        upsertRow: async (...args: unknown[]) => void calls.push({ method: 'upsertRow', args }),
        patchRow: async (...args: unknown[]) => void calls.push({ method: 'patchRow', args }),
      },
    }
  }

  it('salva o produto inteiro numa chamada (catalogo_salvar_produto)', async () => {
    const { rest, calls } = fakeRest()
    const draft = draftOf(baseCatalogRecords(), 'barca-de-acai')!
    await createSupabaseWriter(rest).saveProduct(draft)
    expect(calls).toEqual([{ method: 'rpc', args: ['catalogo_salvar_produto', { produto: productPayload(draft) }] }])
    const payload = productPayload(draft)
    expect(payload).toMatchObject({ id: 'barca-de-acai', kind: 'montavel', flavors_from: 'syrup', category_id: 'barcas-e-potes' })
    expect(payload.groups).toEqual([
      { group_id: 'dry', max_select: null },
      { group_id: 'fruit', max_select: 2 },
      { group_id: 'paid', max_select: null },
    ])
    expect(payload).not.toHaveProperty('archived_at')
  })

  it('muda campos pelos nomes do banco e ordena pela RPC', async () => {
    const { rest, calls } = fakeRest()
    const writer = createSupabaseWriter(rest)
    await writer.patch('catalog_products', { id: 'jujuba' }, { available: false, archivedAt: null })
    await writer.reorder('produtos', ['a', 'b'])
    await writer.saveCategory(baseCatalogRecords().categories[1])
    expect(calls[0]).toEqual({ method: 'patchRow', args: ['catalog_products', { id: 'jujuba' }, { available: false, archived_at: null }] })
    expect(calls[1]).toEqual({ method: 'rpc', args: ['catalogo_ordenar', { lista: 'produtos', ids: ['a', 'b'] }] })
    expect(calls[2].args[0]).toBe('catalog_categories')
    expect(calls[2].args[2]).toBe('id')
    expect(calls[2].args[1]).toMatchObject({ id: 'combos-e-ofertas', nav_label: 'Combos e Ofertas', archived_at: null })
  })

  it('traduz os erros do banco para o vendedor', () => {
    expect(writeErrorText(new CatalogWriteError(400, 'P0001', 'A categoria ainda tem produtos. Mova ou arquive os produtos antes.'))).toBe(
      'A categoria ainda tem produtos. Mova ou arquive os produtos antes.',
    )
    expect(writeErrorText(new CatalogWriteError(401, '42501', ''))).toMatch(/sessão de vendedor acabou/)
    expect(writeErrorText(new CatalogWriteError(409, '23505', ''))).toMatch(/Já existe/)
    expect(writeErrorText(new CatalogWriteError(409, '23503', ''))).toMatch(/em uso/)
    expect(writeErrorText(new Error('rede'))).toBe('Não foi possível salvar. Tente novamente.')
    expect(writeErrorText(new LocalWriteError([{ field: 'name', message: 'Preencha o nome.' }]))).toBe('Preencha o nome.')
  })
})
