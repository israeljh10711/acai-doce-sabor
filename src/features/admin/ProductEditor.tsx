import { useMemo, useState } from 'react'
import { formatBRL } from '../../utils/money.ts'
import { nowIso } from '../../services/catalogWriter.ts'
import { type Problem, validateProduct } from '../catalog/catalogValidation.ts'
import { type ChoiceDraft, type ProductDraft, settleDraft } from '../catalog/productDraft.ts'
import { type CatalogRecords, type GroupRecord, type ProductKind, type VariantRecord, byPosition } from '../catalog/records.ts'
import { SellerDialog } from '../seller/SellerDialog.tsx'
import { useWrite } from './adminData.ts'
import { dangerButton, describe, inputClass, KIND_LABELS, labelClass, moved, parseWords, quietButton } from './adminKit.ts'
import { CountInput, Field, MoneyInput, MoveButtons, PhotoPicker, SaveBar, Switch } from './adminUi.tsx'

const CONTAINERS = [
  { id: 'pote', label: 'Pote' },
  { id: 'copo', label: 'Copo' },
  { id: 'isopor', label: 'Isopor' },
  { id: 'barca', label: 'Barca' },
] as const

const RULE_TEXT: Readonly<Record<GroupRecord['rule'], string>> = {
  limited: 'conta no limite grátis do tamanho',
  included: 'um de cada',
  paid: 'cobrado por unidade',
}

let rowCounter = 0
const rowKey = () => `linha-${++rowCounter}`

type Row<T> = T & { key: string }

/**
 * Editor de um produto inteiro (novo, existente ou cópia): tipo, dados, foto, preço, tamanhos,
 * escolhas e sabores, grupos de complementos e o Completo. Salva tudo de uma vez.
 */
export function ProductEditor({ draft: initial, records, isNew, onClose }: { draft: ProductDraft; records: CatalogRecords; isNew: boolean; onClose: () => void }) {
  const [product, setProduct] = useState(initial.product)
  const [variants, setVariants] = useState<Row<VariantRecord>[]>(() => initial.variants.map((variant) => ({ ...variant, key: rowKey() })))
  const [choices, setChoices] = useState<Row<ChoiceDraft & { optionKeys: string[] }>[]>(() =>
    initial.choices.map((choice) => ({ ...choice, key: rowKey(), optionKeys: choice.options.map(() => rowKey()) })),
  )
  const [groups, setGroups] = useState(initial.groups)
  const [problems, setProblems] = useState<Problem[]>([])
  const [save, run, setSave] = useWrite()
  const [saved, setSaved] = useState(() => JSON.stringify(initial))
  const [uploading, setUploading] = useState(false)

  const current: ProductDraft = useMemo(
    () => ({
      product,
      variants: variants.map(({ key: _key, ...variant }) => (void _key, variant)),
      choices: choices.map(({ key: _key, optionKeys: _keys, ...choice }) => (void _key, void _keys, choice)),
      groups,
    }),
    [product, variants, choices, groups],
  )
  const dirty = JSON.stringify(current) !== saved
  const error = (field: string) => problems.find((problem) => problem.field === field)?.message ?? null
  const touched = () => {
    if (save.state === 'saved' || save.state === 'error') setSave({ state: 'idle' })
  }
  const setP = (patch: Partial<typeof product>) => {
    setProduct((value) => ({ ...value, ...patch }))
    touched()
  }
  const setDetails = (patch: Partial<typeof product.details>) => setP({ details: Object.fromEntries(Object.entries({ ...product.details, ...patch }).filter(([, value]) => value !== undefined && value !== '')) })

  const categories = byPosition(records.categories.filter((category) => category.archivedAt === null || category.id === product.categoryId))
  const category = records.categories.find((entry) => entry.id === product.categoryId)
  const inVitrine = category?.layout === 'vitrine'
  const allGroups = byPosition(records.groups)
  const montavel = product.kind === 'montavel'
  const flavorMode: 'nenhum' | 'proprios' | 'grupo' = product.flavorsFrom ? 'grupo' : montavel && choices.length > 0 ? 'proprios' : 'nenhum'

  const submit = async () => {
    // Produto direto não tem tamanhos nem escolhas; montável tem no máximo a escolha do sabor.
    const cleaned: ProductDraft = {
      ...current,
      variants: product.kind === 'direto' ? [] : current.variants,
      choices: product.kind === 'direto' || product.flavorsFrom ? [] : montavel ? current.choices.slice(0, 1) : current.choices,
      groups: montavel ? current.groups : [],
      product: { ...product, completo: montavel && product.completo, flavorsFrom: montavel ? product.flavorsFrom : null },
    }
    const taken = new Set(records.products.filter((entry) => entry.id !== initial.product.id).map((entry) => entry.id))
    const settled = settleDraft(cleaned, taken)
    // O preço "a partir de" do montável e do produto com tamanhos é o menor tamanho.
    if (settled.variants.length > 0) settled.product.priceCents = Math.min(...settled.variants.map((variant) => variant.priceCents))
    const found = validateProduct(settled, records)
    setProblems(found)
    if (found.length > 0) {
      setSave({ state: 'error', message: found[0].message })
      return
    }
    if (await run((writer) => writer.saveProduct(settled))) {
      setSaved(JSON.stringify(current))
      if (isNew) onClose()
    }
  }

  const archive = async () => {
    if (await run((writer) => writer.patch('catalog_products', { id: product.id }, { archivedAt: nowIso() }))) onClose()
  }

  const addVariant = () => {
    setVariants((list) => [
      ...list,
      { key: rowKey(), productId: product.id, id: '', name: '', container: montavel ? (list.at(-1)?.container ?? 'copo') : null, priceCents: list.at(-1)?.priceCents ?? 0, freeCount: list.at(-1)?.freeCount ?? 0, available: true, position: list.length },
    ])
    touched()
  }
  const setVariant = (index: number, patch: Partial<VariantRecord>) => {
    setVariants((list) => list.map((variant, at) => (at === index ? { ...variant, ...patch } : variant)))
    touched()
  }
  const setChoice = (index: number, patch: Partial<ChoiceDraft & { optionKeys: string[] }>) => {
    setChoices((list) => list.map((choice, at) => (at === index ? { ...choice, ...patch } : choice)))
    touched()
  }
  const addChoice = (label = '') => {
    setChoices((list) => [...list, { key: rowKey(), productId: product.id, id: '', label, allowOther: false, photoAlt: null, position: list.length, options: [], optionKeys: [] }])
    touched()
  }

  return (
    <SellerDialog title={isNew ? 'Novo produto' : `Editar: ${initial.product.name}`} titleId="titulo-editar-produto" onClose={onClose} extraWide>
      <div className="flex flex-col gap-6" data-product-editor>
        <fieldset className="flex flex-col gap-2">
          <legend className={labelClass}>Tipo de produto</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {(Object.keys(KIND_LABELS) as ProductKind[]).map((kind) => (
              <label key={kind} className={`flex cursor-pointer flex-col gap-1 rounded-2xl p-3 ring-1 transition ${product.kind === kind ? 'bg-acai-50 ring-2 ring-acai-700' : 'ring-line hover:bg-acai-50'}`}>
                <span className="flex items-center gap-2 text-sm font-bold text-acai-900">
                  <input type="radio" name="tipo-produto" value={kind} data-kind={kind} checked={product.kind === kind} onChange={() => setP({ kind })} className="size-4 accent-acai-800" />
                  {KIND_LABELS[kind].title}
                </span>
                <span className="text-xs text-ink-soft">{KIND_LABELS[kind].text}</span>
              </label>
            ))}
          </div>
          {error('kind') && (
            <p role="alert" className="text-sm font-semibold text-red-700">
              {error('kind')}
            </p>
          )}
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="produto-nome" label="Nome" error={error('name')}>
            <input id="produto-nome" value={product.name} maxLength={120} onChange={(event) => setP({ name: event.target.value })} className={inputClass} {...describe('produto-nome', undefined, error('name'))} />
          </Field>
          <Field id="produto-categoria" label="Categoria" error={error('categoryId')}>
            <select id="produto-categoria" value={product.categoryId} onChange={(event) => setP({ categoryId: event.target.value })} className={inputClass}>
              {categories.map((entry) => (
                <option key={entry.id} value={entry.id} disabled={entry.layout === 'vitrine' && !montavel}>
                  {entry.name}
                  {entry.layout === 'vitrine' ? ' (vitrine, só montável)' : ''}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {!inVitrine && (
          <Field id="produto-descricao" label="Descrição" error={error('description')}>
            <textarea id="produto-descricao" value={product.description} maxLength={600} rows={2} onChange={(event) => setP({ description: event.target.value })} className={`${inputClass} py-3`} />
          </Field>
        )}
        {inVitrine && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="produto-resumo" label="Resumo do cartão" hint='Ex.: "Em pote, copo ou isopor, a partir de 200 ml."'>
              <input id="produto-resumo" value={product.details.summary ?? ''} maxLength={200} onChange={(event) => setDetails({ summary: event.target.value })} className={inputClass} />
            </Field>
            <Field id="produto-frase" label="Frase da vitrine">
              <input id="produto-frase" value={product.details.tagline ?? ''} maxLength={300} onChange={(event) => setDetails({ tagline: event.target.value })} className={inputClass} />
            </Field>
            <Field id="produto-selos" label="Selos" hint="Separados por vírgula. Ex.: Especialidade da casa">
              <input id="produto-selos" defaultValue={(product.details.badges ?? []).join(', ')} onChange={(event) => setDetails({ badges: parseWords(event.target.value).slice(0, 3) })} className={inputClass} />
            </Field>
          </div>
        )}
        {montavel && (
          <Field id="produto-botao" label="Texto do botão" hint='Ex.: "Montar açaí Oca".'>
            <input id="produto-botao" value={product.details.actionLabel ?? ''} maxLength={60} onChange={(event) => setDetails({ actionLabel: event.target.value })} className={inputClass} />
          </Field>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <span className={labelClass}>Foto</span>
            <PhotoPicker value={product.image} alt={product.imageAlt || product.name} onBusy={setUploading} onChange={(image) => setP({ image })} />
            {error('image') && (
              <p role="alert" className="text-sm font-semibold text-red-700">
                {error('image')}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-4">
            <Field id="produto-foto-texto" label="O que a foto mostra" hint="Lido por quem usa leitor de tela.">
              <input id="produto-foto-texto" value={product.imageAlt} maxLength={600} onChange={(event) => setP({ imageAlt: event.target.value })} className={inputClass} />
            </Field>
            {!inVitrine && (
              <Field id="produto-selo" label="Selo do cartão" hint='Ex.: "Oferta". Vazio: sem selo.' error={error('badge')}>
                <input id="produto-selo" value={product.badge ?? ''} maxLength={40} onChange={(event) => setP({ badge: event.target.value || null })} className={inputClass} />
              </Field>
            )}
            <Field id="produto-busca" label="Palavras de busca" hint="Separadas por vírgula (sinônimos: dindin, refri...).">
              <input id="produto-busca" defaultValue={product.keywords.join(', ')} onChange={(event) => setP({ keywords: parseWords(event.target.value) })} className={inputClass} />
            </Field>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {variants.length === 0 && product.kind !== 'montavel' && (
            <Field id="produto-preco" label="Preço" error={error('priceCents')}>
              <MoneyInput id="produto-preco" cents={product.priceCents} onChange={(cents) => setP({ priceCents: cents ?? -1 })} error={error('priceCents')} />
            </Field>
          )}
          <Field id="produto-preco-antigo" label="Preço antigo (riscado)" hint="Vazio: sem preço riscado." error={error('compareAtCents')}>
            <MoneyInput id="produto-preco-antigo" optional cents={product.compareAtCents} onChange={(cents) => setP({ compareAtCents: cents })} error={error('compareAtCents')} />
          </Field>
        </div>

        <div className="flex flex-wrap gap-x-6">
          <Switch checked={product.visible} onChange={(visible) => setP({ visible })} label="Visível na loja" description="Desligado: sai da loja, sem apagar." />
          <Switch checked={product.available} onChange={(available) => setP({ available })} label="Disponível" description="Desligado: aparece como esgotado." />
          {montavel && <Switch checked={product.completo} onChange={(completo) => setP({ completo })} label='Botão "Completo"' description="Marca 1 de cada complemento grátis dos grupos do Completo." />}
        </div>

        {product.kind !== 'direto' && (
          <section aria-labelledby="titulo-tamanhos" data-variants className="flex flex-col gap-3">
            <div>
              <h3 id="titulo-tamanhos" className="font-display text-lg font-extrabold text-acai-800">
                Tamanhos
              </h3>
              <p className="text-sm text-ink-soft">{montavel ? 'Cada tamanho com o preço e os adicionais grátis.' : 'Opcional: com tamanhos, o cliente escolhe um e o preço é o dele.'}</p>
              {error('variants') && (
                <p role="alert" className="mt-1 text-sm font-semibold text-red-700">
                  {error('variants')}
                </p>
              )}
            </div>
            <ol className="flex flex-col gap-2">
              {variants.map((variant, index) => (
                <li key={variant.key} data-variant={index} className="flex flex-col gap-3 rounded-2xl bg-acai-50/60 p-3 ring-1 ring-line">
                  <div className={`grid gap-3 ${montavel ? 'sm:grid-cols-4' : 'sm:grid-cols-2'}`}>
                    <Field id={`tamanho-${index}-nome`} label="Nome" error={error(`variants.${index}.name`)}>
                      <input id={`tamanho-${index}-nome`} value={variant.name} maxLength={120} placeholder="Ex.: Copo 500 ml" onChange={(event) => setVariant(index, { name: event.target.value })} className={inputClass} />
                    </Field>
                    <Field id={`tamanho-${index}-preco`} label="Preço" error={error(`variants.${index}.priceCents`)}>
                      <MoneyInput id={`tamanho-${index}-preco`} cents={variant.priceCents} onChange={(cents) => setVariant(index, { priceCents: cents ?? -1 })} />
                    </Field>
                    {montavel && (
                      <>
                        <Field id={`tamanho-${index}-gratis`} label="Adicionais grátis" error={error(`variants.${index}.freeCount`)}>
                          <CountInput id={`tamanho-${index}-gratis`} value={variant.freeCount} onChange={(value) => setVariant(index, { freeCount: value ?? 0 })} />
                        </Field>
                        <Field id={`tamanho-${index}-recipiente`} label="Recipiente">
                          <select id={`tamanho-${index}-recipiente`} value={variant.container ?? 'copo'} onChange={(event) => setVariant(index, { container: event.target.value })} className={inputClass}>
                            {CONTAINERS.map((container) => (
                              <option key={container.id} value={container.id}>
                                {container.label}
                              </option>
                            ))}
                          </select>
                        </Field>
                      </>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Switch checked={variant.available} onChange={(available) => setVariant(index, { available })} label="Disponível" />
                    <MoveButtons label={variant.name || `tamanho ${index + 1}`} first={index === 0} last={index === variants.length - 1} onMove={(step) => (setVariants(moved(variants, index, step)), touched())} />
                    <button type="button" onClick={() => (setVariants(variants.filter((_, at) => at !== index)), touched())} className={dangerButton}>
                      Remover tamanho
                    </button>
                  </div>
                </li>
              ))}
            </ol>
            <button type="button" data-add-variant onClick={addVariant} className={`${quietButton} self-start`}>
              + Adicionar tamanho
            </button>
          </section>
        )}

        {montavel && (
          <section aria-labelledby="titulo-sabores" className="flex flex-col gap-3">
            <h3 id="titulo-sabores" className="font-display text-lg font-extrabold text-acai-800">
              Sabor
            </h3>
            <Field id="produto-sabor-modo" label="O cliente escolhe um sabor?">
              <select
                id="produto-sabor-modo"
                value={flavorMode === 'grupo' ? `grupo:${product.flavorsFrom}` : flavorMode}
                onChange={(event) => {
                  const value = event.target.value
                  if (value === 'nenhum') {
                    setP({ flavorsFrom: null })
                    setChoices([])
                  } else if (value === 'proprios') {
                    setP({ flavorsFrom: null })
                    if (choices.length === 0) addChoice(product.details.flavorTerm?.label ?? 'Sabor')
                  } else setP({ flavorsFrom: value.slice('grupo:'.length) })
                }}
                className={inputClass}
              >
                <option value="nenhum">Não, sem escolha de sabor</option>
                <option value="proprios">Sim, com a lista de sabores deste produto</option>
                {allGroups.map((group) => (
                  <option key={group.id} value={`grupo:${group.id}`}>
                    Sim, os complementos grátis do grupo "{group.name}"
                  </option>
                ))}
              </select>
            </Field>
            {flavorMode !== 'nenhum' && (
              <div className="grid gap-3 sm:grid-cols-3">
                <Field id="produto-sabor-nome" label="Nome da escolha" hint='Ex.: "Sabor" ou "Cobertura".'>
                  <input
                    id="produto-sabor-nome"
                    value={product.details.flavorTerm?.label ?? 'Sabor'}
                    maxLength={40}
                    onChange={(event) => {
                      const label = event.target.value
                      setDetails({ flavorTerm: label && label !== 'Sabor' ? { label, missing: `${/a$/i.test(label) ? 'a' : 'o'} ${label.toLocaleLowerCase('pt-BR')}` } : undefined })
                      if (choices[0]) setChoice(0, { label: label || 'Sabor' })
                    }}
                    className={inputClass}
                  />
                </Field>
                <Field id="produto-sabor-dica" label="Dica ao lado" hint='Ex.: "1 inclusa no preço".'>
                  <input id="produto-sabor-dica" value={product.details.flavorHint ?? ''} maxLength={60} onChange={(event) => setDetails({ flavorHint: event.target.value })} className={inputClass} />
                </Field>
                <Field id="produto-sabor-aviso" label="Aviso dos sabores">
                  <input id="produto-sabor-aviso" value={product.details.flavorNotice ?? ''} maxLength={200} onChange={(event) => setDetails({ flavorNotice: event.target.value })} className={inputClass} />
                </Field>
              </div>
            )}
            {flavorMode === 'proprios' && choices[0] && <ChoiceOptions index={0} choice={choices[0]} onChange={(patch) => setChoice(0, patch)} error={error} />}
          </section>
        )}

        {product.kind === 'variacoes' && (
          <section aria-labelledby="titulo-escolhas" data-choices className="flex flex-col gap-3">
            <div>
              <h3 id="titulo-escolhas" className="font-display text-lg font-extrabold text-acai-800">
                Escolhas
              </h3>
              <p className="text-sm text-ink-soft">Cada escolha é obrigatória (ex.: "Sabor", "Sabor da cobertura").</p>
              {error('choices') && (
                <p role="alert" className="mt-1 text-sm font-semibold text-red-700">
                  {error('choices')}
                </p>
              )}
            </div>
            {choices.map((choice, index) => (
              <div key={choice.key} data-choice={index} className="flex flex-col gap-3 rounded-2xl bg-acai-50/60 p-3 ring-1 ring-line">
                <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                  <Field id={`escolha-${index}-nome`} label="Nome da escolha" error={error(`choices.${index}.label`)}>
                    <input id={`escolha-${index}-nome`} value={choice.label} maxLength={120} onChange={(event) => setChoice(index, { label: event.target.value })} className={inputClass} />
                  </Field>
                  <Switch checked={choice.allowOther} onChange={(allowOther) => setChoice(index, { allowOther })} label='Aceita "Outro sabor"' />
                </div>
                <ChoiceOptions index={index} choice={choice} onChange={(patch) => setChoice(index, patch)} error={error} />
                <div className="flex flex-wrap gap-2">
                  <MoveButtons label={choice.label || `escolha ${index + 1}`} first={index === 0} last={index === choices.length - 1} onMove={(step) => (setChoices(moved(choices, index, step)), touched())} />
                  <button type="button" onClick={() => (setChoices(choices.filter((_, at) => at !== index)), touched())} className={dangerButton}>
                    Remover escolha
                  </button>
                </div>
              </div>
            ))}
            <button type="button" data-add-choice onClick={() => addChoice(choices.length === 0 ? 'Sabor' : '')} className={`${quietButton} self-start`}>
              + Adicionar escolha
            </button>
          </section>
        )}

        {montavel && (
          <section aria-labelledby="titulo-grupos" data-product-groups className="flex flex-col gap-3">
            <div>
              <h3 id="titulo-grupos" className="font-display text-lg font-extrabold text-acai-800">
                Complementos do produto
              </h3>
              <p className="text-sm text-ink-soft">Marque os grupos que o produto aceita, na ordem em que aparecem. As regras de cada grupo ficam em "Complementos".</p>
            </div>
            <ul className="flex flex-col gap-2">
              {[...groups.map((link) => allGroups.find((group) => group.id === link.groupId)!).filter(Boolean), ...allGroups.filter((group) => !groups.some((link) => link.groupId === group.id))].map((group) => {
                const index = groups.findIndex((link) => link.groupId === group.id)
                const link = groups[index]
                return (
                  <li key={group.id} data-product-group={group.id} className="flex flex-col gap-2 rounded-2xl p-3 ring-1 ring-line sm:flex-row sm:items-center">
                    <div className="flex-1">
                      <Switch
                        checked={index >= 0}
                        onChange={(on) => {
                          setGroups(on ? [...groups, { productId: product.id, groupId: group.id, position: groups.length, maxSelect: null }] : groups.filter((entry) => entry.groupId !== group.id))
                          touched()
                        }}
                        label={group.name}
                        description={`${RULE_TEXT[group.rule]}${group.inCompleto ? ' · entra no Completo' : ''}`}
                      />
                    </div>
                    {link && (
                      <div className="flex flex-wrap items-end gap-2">
                        <div className="w-36">
                          <Field id={`grupo-${group.id}-max`} label="Máximo aqui" error={error(`groups.${index}.maxSelect`)}>
                            <CountInput id={`grupo-${group.id}-max`} optional value={link.maxSelect} onChange={(maxSelect) => (setGroups(groups.map((entry) => (entry.groupId === group.id ? { ...entry, maxSelect } : entry))), touched())} />
                          </Field>
                        </div>
                        <MoveButtons label={group.name} first={index === 0} last={index === groups.length - 1} onMove={(step) => (setGroups(moved(groups, index, step)), touched())} />
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {variants.length > 0 && (
          <p className="text-sm text-ink-soft">
            Preço no cartão: a partir de {formatBRL(Math.min(...variants.map((variant) => Math.max(0, variant.priceCents))))}.
          </p>
        )}

        {!isNew && (
          <div className="rounded-2xl bg-acai-50 p-4 ring-1 ring-line">
            <p className="text-sm font-bold text-acai-900">Arquivar produto</p>
            <p className="mt-1 text-sm text-ink-soft">Sai da loja e das listas. Pedidos antigos continuam com o nome e o preço de quando foram feitos.</p>
            <button type="button" data-archive-product disabled={save.state === 'saving'} onClick={() => void archive()} className={`${dangerButton} mt-3`}>
              Arquivar produto
            </button>
          </div>
        )}

        <SaveBar dirty={dirty} busy={uploading} save={save} onSave={() => void submit()} onCancel={onClose} />
      </div>
    </SellerDialog>
  )
}

/** As opções de uma escolha (os sabores): nome, disponível, ordem, remover e adicionar. */
function ChoiceOptions({
  index,
  choice,
  onChange,
  error,
}: {
  index: number
  choice: ChoiceDraft & { optionKeys: string[] }
  onChange: (patch: Partial<ChoiceDraft & { optionKeys: string[] }>) => void
  error: (field: string) => string | null
}) {
  const update = (options: ChoiceDraft['options'], optionKeys: string[]) => onChange({ options, optionKeys })
  return (
    <div className="flex flex-col gap-2" data-choice-options={index}>
      {error(`choices.${index}.options`) && (
        <p role="alert" className="text-sm font-semibold text-red-700">
          {error(`choices.${index}.options`)}
        </p>
      )}
      <ol className="flex flex-col gap-2">
        {choice.options.map((option, at) => (
          <li key={choice.optionKeys[at]} className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex-1">
              <label htmlFor={`opcao-${index}-${at}`} className="sr-only">
                Nome da opção {at + 1}
              </label>
              <input
                id={`opcao-${index}-${at}`}
                value={option.name}
                maxLength={120}
                placeholder="Ex.: Chocolate"
                onChange={(event) => update(choice.options.map((entry, n) => (n === at ? { ...entry, name: event.target.value } : entry)), choice.optionKeys)}
                className={inputClass}
                {...describe(`opcao-${index}-${at}`, undefined, error(`choices.${index}.options.${at}`))}
              />
              {error(`choices.${index}.options.${at}`) && (
                <p id={`opcao-${index}-${at}-erro`} role="alert" className="mt-1 text-sm font-semibold text-red-700">
                  {error(`choices.${index}.options.${at}`)}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Switch checked={option.available} onChange={(available) => update(choice.options.map((entry, n) => (n === at ? { ...entry, available } : entry)), choice.optionKeys)} label="Disponível" />
              <MoveButtons label={option.name || `opção ${at + 1}`} first={at === 0} last={at === choice.options.length - 1} onMove={(step) => update(moved(choice.options, at, step), moved(choice.optionKeys, at, step))} />
              <button type="button" onClick={() => update(choice.options.filter((_, n) => n !== at), choice.optionKeys.filter((_, n) => n !== at))} className={`${dangerButton} min-h-10 px-2.5`}>
                Remover<span className="sr-only">: {option.name}</span>
              </button>
            </div>
          </li>
        ))}
      </ol>
      <button
        type="button"
        data-add-option
        onClick={() =>
          update(
            [...choice.options, { productId: choice.productId, choiceId: choice.id, id: '', name: '', photo: null, available: true, position: choice.options.length }],
            [...choice.optionKeys, rowKey()],
          )
        }
        className={`${quietButton} self-start`}
      >
        + Adicionar opção
      </button>
    </div>
  )
}
