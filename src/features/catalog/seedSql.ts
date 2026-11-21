/**
 * A semente SQL do cardápio (cardápio dinâmico, 2026-11-21): os registros do cardápio do código em
 * `insert ... on conflict do nothing`, dentro de um bloco que só roda uma vez (enquanto
 * `catalog_meta.seeded_at` está vazio). Assim, rodar a migração de novo nunca traz de volta o que
 * o vendedor apagou nem sobrescreve o que ele mudou.
 *
 * `node scripts/catalogo/gerar-semente.ts` escreve este texto na migração; o teste
 * `seedSql.test.ts` confere que a migração está igual ao que o código gera.
 */
import { type CatalogRecords, RECORD_TABLES, toRow } from './records.ts'

export const SEED_START = '-- >>> semente do cardápio (gerada por `node scripts/catalogo/gerar-semente.ts`; não edite à mão)'
export const SEED_END = '-- <<< fim da semente do cardápio'

/** Um valor em SQL. Listas viram `text[]`; objetos, `jsonb`. */
export function sqlLiteral(value: unknown): string {
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) throw new Error(`Número que não é inteiro na semente: ${value}`)
    return String(value)
  }
  if (typeof value === 'string') {
    if (value.includes('$semente$')) throw new Error('Texto com o marcador da semente')
    return `'${value.replaceAll("'", "''")}'`
  }
  if (Array.isArray(value)) {
    if (!value.every((entry) => typeof entry === 'string')) throw new Error('Lista que não é de textos na semente')
    return value.length === 0 ? `'{}'::text[]` : `array[${value.map(sqlLiteral).join(', ')}]::text[]`
  }
  const json = JSON.stringify(value)
  if (json.includes('$semente$')) throw new Error('Texto com o marcador da semente')
  return `'${json.replaceAll("'", "''")}'::jsonb`
}

/** O bloco da semente, entre os marcadores. */
export function seedSql(records: CatalogRecords): string {
  const lines = [
    SEED_START,
    'do $semente$',
    'begin',
    '  if (select m.seeded_at from public.catalog_meta m where m.id = 1) is not null then',
    "    raise notice 'Cardápio já semeado: a semente não roda de novo.';",
    '    return;',
    '  end if;',
  ]
  for (const [field, table, key] of RECORD_TABLES) {
    const rows = (records[field] as readonly object[]).map(toRow)
    if (rows.length === 0) continue
    const columns = Object.keys(rows[0])
    lines.push('', `  insert into public.${table} (${columns.join(', ')}) values`)
    rows.forEach((row, index) => {
      const keys = Object.keys(row)
      if (keys.length !== columns.length || !columns.every((column) => keys.includes(column))) throw new Error(`Colunas diferentes em ${table}`)
      const values = columns.map((column) => sqlLiteral(row[column]))
      lines.push(`    (${values.join(', ')})${index === rows.length - 1 ? '' : ','}`)
    })
    // Pela chave primária: os nomes únicos são conferidos no fim da transação (deferrable) e não
    // podem ser o alvo do on conflict.
    lines.push(`  on conflict (${key}) do nothing;`)
  }
  lines.push('', '  update public.catalog_meta set seeded_at = now() where id = 1;', 'end', '$semente$;', SEED_END)
  return lines.join('\n')
}

/** Troca o bloco da semente dentro do texto da migração. */
export function replaceSeed(migration: string, seed: string): string {
  const start = migration.indexOf(SEED_START)
  const end = migration.indexOf(SEED_END)
  if (start < 0 || end < start) throw new Error('A migração não tem os marcadores da semente')
  return migration.slice(0, start) + seed + migration.slice(end + SEED_END.length)
}

/** O bloco da semente que está na migração. */
export function seedInMigration(migration: string): string {
  const start = migration.indexOf(SEED_START)
  const end = migration.indexOf(SEED_END)
  if (start < 0 || end < start) throw new Error('A migração não tem os marcadores da semente')
  return migration.slice(start, end + SEED_END.length)
}
