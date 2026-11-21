/**
 * Conferência do que o vendedor quer salvar (cardápio dinâmico, 2026-11-21): as mesmas regras do
 * banco (`20261121120000_catalogo_dinamico.sql`), em português, campo a campo. O formulário mostra
 * os avisos antes de enviar; o modo de demonstração (sem banco) usa as mesmas regras para gravar.
 * O banco confere tudo de novo: esta conferência é para ajudar, não para proteger.
 */
import type { ProductDraft } from './productDraft.ts'
import { type CatalogRecords, type CategoryRecord, type GroupRecord, ID_PATTERN, LIMITS, type OfferRecord, type OptionRecord } from './records.ts'

export type Problem = { field: string; message: string }

const PHOTO = /^(images\/|https:\/\/)/
const SVG = /\.svg($|[?#])/i

const text = (problems: Problem[], field: string, value: string, label: string, options: { required?: boolean; max?: number } = {}) => {
  const { required = false, max = LIMITS.nameLength } = options
  if (required && value.trim() === '') problems.push({ field, message: `Preencha ${label}.` })
  else if (value.length > max) problems.push({ field, message: `${capital(label)} pode ter até ${max} letras.` })
}
const capital = (label: string) => label.charAt(0).toUpperCase() + label.slice(1)
const money = (problems: Problem[], field: string, value: number | null, label: string) => {
  if (value === null) return
  if (!Number.isSafeInteger(value) || value < 0) problems.push({ field, message: `${capital(label)} precisa ser um valor em reais, sem números negativos.` })
  else if (value > LIMITS.maxPriceCents) problems.push({ field, message: `${capital(label)} pode ser no máximo R$ 10.000,00.` })
}
const photo = (problems: Problem[], field: string, value: string | null) => {
  if (!value) return
  if (value.startsWith('idb:')) return
  if (!PHOTO.test(value) || SVG.test(value)) problems.push({ field, message: 'Foto inválida. Envie uma foto JPEG, PNG ou WebP.' })
}
const units = (problems: Problem[], field: string, value: number | null, label: string, min = 0) => {
  if (value === null) return
  if (!Number.isSafeInteger(value) || value < min || value > LIMITS.maxUnits) problems.push({ field, message: `${capital(label)} precisa ser um número de ${min} a ${LIMITS.maxUnits}.` })
}
const duplicates = (names: readonly string[]) => {
  const seen = new Set<string>()
  const repeated = new Set<string>()
  for (const name of names.map((entry) => entry.trim().toLocaleLowerCase('pt-BR'))) {
    if (seen.has(name)) repeated.add(name)
    seen.add(name)
  }
  return repeated
}

/** Conferência de um produto inteiro (já com ids e posições, de `settleDraft`). */
export function validateProduct(draft: ProductDraft, records: CatalogRecords): Problem[] {
  const problems: Problem[] = []
  const { product } = draft
  if (!ID_PATTERN.test(product.id) || product.id.length > LIMITS.idLength) problems.push({ field: 'name', message: 'Dê um nome com letras ou números ao produto.' })
  text(problems, 'name', product.name, 'o nome', { required: true })
  text(problems, 'description', product.description, 'a descrição', { max: LIMITS.textLength })
  text(problems, 'imageAlt', product.imageAlt, 'a descrição da foto', { max: LIMITS.textLength })
  text(problems, 'badge', product.badge ?? '', 'o selo', { max: 40 })
  photo(problems, 'image', product.image)
  money(problems, 'priceCents', product.priceCents, 'o preço')
  money(problems, 'compareAtCents', product.compareAtCents, 'o preço antigo')
  if (product.keywords.length > LIMITS.keywords) problems.push({ field: 'keywords', message: `Use até ${LIMITS.keywords} palavras de busca.` })

  const category = records.categories.find((candidate) => candidate.id === product.categoryId)
  if (!category || category.archivedAt !== null) problems.push({ field: 'categoryId', message: 'Escolha uma categoria.' })
  else if (category.layout === 'vitrine' && product.kind !== 'montavel') problems.push({ field: 'kind', message: 'Na vitrine "Monte do seu jeito" só entram produtos montáveis.' })
  if (product.kind !== 'montavel' && (product.completo || product.flavorsFrom)) problems.push({ field: 'kind', message: '"Completo" e sabores do grupo são só de produto montável.' })

  if (product.kind === 'montavel' && draft.variants.length === 0) problems.push({ field: 'variants', message: 'Produto montável precisa de pelo menos um tamanho.' })
  if (product.kind === 'variacoes' && draft.variants.length === 0 && draft.choices.length === 0) {
    problems.push({ field: 'choices', message: 'Produto com sabores ou variações precisa de tamanhos ou de uma escolha.' })
  }
  const repeatedSizes = duplicates(draft.variants.map((variant) => variant.name))
  draft.variants.forEach((variant, index) => {
    text(problems, `variants.${index}.name`, variant.name, 'o nome do tamanho', { required: true })
    if (repeatedSizes.has(variant.name.trim().toLocaleLowerCase('pt-BR'))) problems.push({ field: `variants.${index}.name`, message: 'Dois tamanhos com o mesmo nome.' })
    money(problems, `variants.${index}.priceCents`, variant.priceCents, 'o preço do tamanho')
    units(problems, `variants.${index}.freeCount`, variant.freeCount, 'os adicionais grátis')
  })
  draft.choices.forEach((choice, index) => {
    text(problems, `choices.${index}.label`, choice.label, 'o nome da escolha', { required: true })
    if (choice.options.length === 0) problems.push({ field: `choices.${index}.options`, message: 'A escolha precisa de pelo menos uma opção.' })
    const repeated = duplicates(choice.options.map((option) => option.name))
    choice.options.forEach((option, optionIndex) => {
      text(problems, `choices.${index}.options.${optionIndex}`, option.name, 'o nome da opção', { required: true })
      if (repeated.has(option.name.trim().toLocaleLowerCase('pt-BR'))) problems.push({ field: `choices.${index}.options.${optionIndex}`, message: 'Duas opções com o mesmo nome.' })
      photo(problems, `choices.${index}.options.${optionIndex}`, option.photo)
    })
  })
  const groups = new Set(records.groups.map((group) => group.id))
  for (const [index, link] of draft.groups.entries()) {
    if (!groups.has(link.groupId)) problems.push({ field: 'groups', message: 'Um grupo de complementos não existe mais.' })
    units(problems, `groups.${index}.maxSelect`, link.maxSelect, 'o máximo do grupo', 1)
  }
  if (product.flavorsFrom && !groups.has(product.flavorsFrom)) problems.push({ field: 'flavorsFrom', message: 'O grupo dos sabores não existe mais.' })
  // Tamanho numa oferta não pode sair (o banco também impede).
  const kept = new Set(draft.variants.map((variant) => variant.id))
  if (records.offers.some((offer) => offer.productId === product.id && offer.variantId !== null && !kept.has(offer.variantId))) {
    problems.push({ field: 'variants', message: 'Esse tamanho está numa oferta. Tire o tamanho da oferta (ou apague a oferta) antes.' })
  }
  return problems
}

export function validateCategory(record: CategoryRecord, records: CatalogRecords): Problem[] {
  const problems: Problem[] = []
  if (!ID_PATTERN.test(record.id) || record.id.length > LIMITS.idLength) problems.push({ field: 'name', message: 'Dê um nome com letras ou números à categoria.' })
  text(problems, 'name', record.name, 'o nome', { required: true })
  text(problems, 'subtitle', record.subtitle, 'o subtítulo', { max: LIMITS.textLength })
  text(problems, 'navLabel', record.navLabel, 'o nome no menu')
  text(problems, 'pillLabel', record.pillLabel, 'o nome curto')
  if (record.layout === 'vitrine' && records.categories.some((other) => other.id !== record.id && other.layout === 'vitrine' && other.archivedAt === null)) {
    problems.push({ field: 'layout', message: 'Já existe a vitrine "Monte do seu jeito".' })
  }
  if (record.archivedAt !== null && records.products.some((product) => product.categoryId === record.id && product.archivedAt === null)) {
    problems.push({ field: 'archivedAt', message: 'A categoria ainda tem produtos. Mova ou arquive os produtos antes.' })
  }
  return problems
}

export function validateGroup(record: GroupRecord): Problem[] {
  const problems: Problem[] = []
  if (!ID_PATTERN.test(record.id) || record.id.length > LIMITS.idLength) problems.push({ field: 'name', message: 'Dê um nome com letras ou números ao grupo.' })
  text(problems, 'name', record.name, 'o nome', { required: true })
  units(problems, 'minSelect', record.minSelect, 'o mínimo')
  units(problems, 'maxSelect', record.maxSelect, 'o máximo', 1)
  units(problems, 'freeCount', record.freeCount, 'as unidades grátis')
  money(problems, 'extraPriceCents', record.extraPriceCents, 'o preço extra')
  if (record.maxSelect !== null && record.maxSelect < record.minSelect) problems.push({ field: 'maxSelect', message: 'O máximo não pode ser menor que o mínimo.' })
  return problems
}

export function validateOption(record: OptionRecord, records: CatalogRecords): Problem[] {
  const problems: Problem[] = []
  if (!ID_PATTERN.test(record.id) || record.id.length > LIMITS.idLength) problems.push({ field: 'name', message: 'Dê um nome com letras ou números ao complemento.' })
  text(problems, 'name', record.name, 'o nome', { required: true })
  money(problems, 'priceCents', record.priceCents, 'o preço')
  photo(problems, 'image', record.image)
  if (!records.groups.some((group) => group.id === record.groupId)) problems.push({ field: 'groupId', message: 'Escolha o grupo do complemento.' })
  if (record.productId !== null && !records.products.some((product) => product.id === record.productId)) problems.push({ field: 'productId', message: 'O produto escolhido não existe mais.' })
  return problems
}

export function validateOffer(record: OfferRecord, records: CatalogRecords): Problem[] {
  const problems: Problem[] = []
  if (!ID_PATTERN.test(record.id) || record.id.length > LIMITS.idLength) problems.push({ field: 'title', message: 'Dê um título com letras ou números à oferta.' })
  text(problems, 'title', record.title, 'o título', { required: true })
  text(problems, 'subtitle', record.subtitle, 'a frase', { max: LIMITS.textLength })
  text(problems, 'badgeText', record.badgeText, 'o selo', { max: 60 })
  if (record.badgeEmoji.length > 16) problems.push({ field: 'badgeEmoji', message: 'Use só um emoji no selo.' })
  money(problems, 'promoPriceCents', record.promoPriceCents, 'o preço promocional')
  const product = records.products.find((candidate) => candidate.id === record.productId)
  if (!product) problems.push({ field: 'productId', message: 'Escolha o produto da oferta.' })
  if (record.variantId !== null && !records.variants.some((variant) => variant.productId === record.productId && variant.id === record.variantId)) {
    problems.push({ field: 'variantId', message: 'Escolha um tamanho deste produto.' })
  }
  const starts = record.startsAt ? Date.parse(record.startsAt) : null
  const ends = record.endsAt ? Date.parse(record.endsAt) : null
  if ((record.startsAt && Number.isNaN(starts)) || (record.endsAt && Number.isNaN(ends))) problems.push({ field: 'endsAt', message: 'Data inválida.' })
  else if (starts !== null && ends !== null && ends <= starts) problems.push({ field: 'endsAt', message: 'O fim precisa ser depois do início.' })
  return problems
}
