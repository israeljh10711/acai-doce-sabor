import { Ban, Check, Plus, Trash } from '../../components/ui/icons.tsx'
import { type GroupRow, MAX_GROUPS, type OptionRow, rowKey } from './flavorsForm.ts'

const inputClass =
  'min-h-12 w-full rounded-xl bg-acai-50 px-3 text-base text-acai-950 ring-1 ring-line outline-none focus:bg-white focus:ring-2 focus:ring-acai-700'
const quietButton =
  'inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-xl px-3 text-sm font-bold ring-1 transition focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800'

/**
 * Lista de sabores (ou opções) com nome, "Disponível / Esgotado" e excluir, mais "+ Adicionar sabor"
 * (gerenciador de sabores, pedido de 2026-11-17). `prefix` diferencia as listas na mesma janela.
 */
function OptionList({ rows, onChange, groupLabel, prefix }: { rows: OptionRow[]; onChange: (rows: OptionRow[]) => void; groupLabel: string; prefix: string }) {
  const update = (key: string, patch: Partial<OptionRow>) => onChange(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-2">
        {rows.map((row, index) => (
          <li key={row.key} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2">
            <input
              data-option-name={`${prefix}-${index}`}
              aria-label={`Sabor ${index + 1} de ${groupLabel || 'esta escolha'}`}
              className={`${inputClass} ${row.available ? '' : 'text-ink-soft line-through'}`}
              value={row.name}
              maxLength={60}
              placeholder="Ex.: Morango"
              onChange={(event) => update(row.key, { name: event.target.value })}
            />
            <button
              type="button"
              data-option-stock={`${prefix}-${index}`}
              aria-pressed={!row.available}
              aria-label={`${row.name || `Sabor ${index + 1}`}: ${row.available ? 'disponível' : 'esgotado'}. Toque para marcar como ${row.available ? 'esgotado' : 'disponível'}.`}
              onClick={() => update(row.key, { available: !row.available })}
              className={`inline-flex min-h-11 cursor-pointer items-center gap-1 rounded-full px-3 text-xs font-bold text-white transition focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800 ${
                row.available ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {row.available ? <Check className="size-3.5" /> : <Ban className="size-3.5" />}
              {row.available ? 'Disponível' : 'Esgotado'}
            </button>
            <button
              type="button"
              aria-label={`Excluir ${row.name || `o sabor ${index + 1}`}`}
              onClick={() => onChange(rows.filter((candidate) => candidate.key !== row.key))}
              className="grid size-11 cursor-pointer place-items-center rounded-xl text-red-700 ring-1 ring-red-200 transition hover:bg-red-50 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-acai-800"
            >
              <Trash className="size-5" />
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        data-add-option={prefix}
        onClick={() => onChange([...rows, { key: rowKey(), name: '', available: true }])}
        className={`${quietButton} self-start text-acai-800 ring-line hover:bg-acai-100`}
      >
        <Plus className="size-4" />
        Adicionar sabor
      </button>
    </div>
  )
}

/**
 * Escolhas de um item das seções (ex.: "Sabor"; no Kit Completo, "Sabor do sorvete" e "Sabor da
 * cobertura"), cada uma com a lista de sabores. Até 3 escolhas.
 */
export function ChoiceGroupsEditor({ groups, onChange, error }: { groups: GroupRow[]; onChange: (groups: GroupRow[]) => void; error?: string }) {
  const update = (key: string, patch: Partial<GroupRow>) => onChange(groups.map((group) => (group.key === key ? { ...group, ...patch } : group)))
  return (
    <fieldset className="flex flex-col gap-3" data-flavors-editor="">
      <legend className="mb-1.5 text-sm font-bold text-acai-950">Sabores e escolhas (opcional)</legend>
      <p className="text-xs text-ink-soft">O cliente escolhe uma opção de cada escolha ao pedir. Marque "Esgotado" no sabor que acabou.</p>
      {groups.map((group, index) => (
        <div key={group.key} data-choice-group={index} className="flex flex-col gap-2 rounded-2xl p-3 ring-1 ring-line">
          <label className="flex flex-col gap-1 text-xs font-semibold text-ink-soft">
            Nome da escolha
            <input
              data-group-label={index}
              className={inputClass}
              value={group.label}
              maxLength={40}
              placeholder="Ex.: Sabor"
              onChange={(event) => update(group.key, { label: event.target.value })}
            />
          </label>
          <OptionList rows={group.options} onChange={(options) => update(group.key, { options })} groupLabel={group.label} prefix={String(index)} />
          <button
            type="button"
            data-remove-group={index}
            onClick={() => onChange(groups.filter((candidate) => candidate.key !== group.key))}
            className={`${quietButton} self-end text-red-700 ring-red-200 hover:bg-red-50`}
          >
            <Trash className="size-4" />
            Excluir a escolha{group.label ? ` "${group.label}"` : ''}
          </button>
        </div>
      ))}
      {groups.length < MAX_GROUPS && (
        <button
          type="button"
          data-add-group=""
          onClick={() => onChange([...groups, { key: rowKey(), label: groups.length === 0 ? 'Sabor' : '', options: [{ key: rowKey(), name: '', available: true }] }])}
          className={`${quietButton} self-start text-acai-800 ring-line hover:bg-acai-100`}
        >
          <Plus className="size-4" />
          {groups.length === 0 ? 'Adicionar escolha de sabor' : 'Adicionar outra escolha'}
        </button>
      )}
      {error && (
        <p role="alert" className="text-sm font-semibold text-red-700">
          {error}
        </p>
      )}
    </fieldset>
  )
}

/** Sabores de um produto do personalizador (Açaí Batido, Milk-shake). */
export function FlavorListEditor({ rows, onChange, title, error }: { rows: OptionRow[]; onChange: (rows: OptionRow[]) => void; title: string; error?: string }) {
  return (
    <fieldset className="flex flex-col gap-2" data-flavors-editor="">
      <legend className="mb-1.5 text-sm font-bold text-acai-950">{title}</legend>
      <p className="text-xs text-ink-soft">Marque "Esgotado" no sabor que acabou: ele aparece desligado para o cliente.</p>
      <OptionList rows={rows} onChange={onChange} groupLabel={title} prefix="0" />
      {error && (
        <p role="alert" className="text-sm font-semibold text-red-700">
          {error}
        </p>
      )}
    </fieldset>
  )
}
