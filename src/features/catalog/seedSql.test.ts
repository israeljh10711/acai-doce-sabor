import { describe, expect, it } from 'vitest'
import MIGRATION from '../../../supabase/migrations/20261121120000_catalogo_dinamico.sql?raw'
import { baseCatalogRecords } from './baseRecords.ts'
import { SEED_END, SEED_START, replaceSeed, seedInMigration, seedSql, sqlLiteral } from './seedSql.ts'

describe('semente do cardápio', () => {
  it('a migração tem a semente que o cardápio do código gera (rode node scripts/catalogo/gerar-semente.ts)', () => {
    const migration = MIGRATION.replaceAll('\r\n', '\n')
    expect(seedInMigration(migration)).toBe(seedSql(baseCatalogRecords()))
  })
  it('só roda uma vez e nunca sobrescreve', () => {
    const seed = seedSql(baseCatalogRecords())
    expect(seed).toContain('if (select m.seeded_at from public.catalog_meta m where m.id = 1) is not null then')
    expect(seed.match(/on conflict \([a-z_, ]+\) do nothing;/g)?.length).toBe(9)
    expect(seed).not.toMatch(/on conflict[^;]*do update/)
    expect(seed).not.toMatch(/\bdelete\b|\btruncate\b|\bdrop\b/i)
  })
  it('escreve os valores em SQL com segurança', () => {
    expect(sqlLiteral("Pão d'água")).toBe("'Pão d''água'")
    expect(sqlLiteral(null)).toBe('null')
    expect(sqlLiteral(true)).toBe('true')
    expect(sqlLiteral(300)).toBe('300')
    expect(sqlLiteral([])).toBe("'{}'::text[]")
    expect(sqlLiteral(['a', "b'c"])).toBe("array['a', 'b''c']::text[]")
    expect(sqlLiteral({ label: "d'x" })).toBe(`'{"label":"d''x"}'::jsonb`)
    expect(() => sqlLiteral(1.5)).toThrow()
    expect(() => sqlLiteral('$semente$')).toThrow()
  })
  it('troca só o bloco entre os marcadores', () => {
    const text = `antes\n${SEED_START}\nvelho\n${SEED_END}\ndepois`
    expect(replaceSeed(text, `${SEED_START}\nnovo\n${SEED_END}`)).toBe(`antes\n${SEED_START}\nnovo\n${SEED_END}\ndepois`)
    expect(() => replaceSeed('sem marcadores', 'x')).toThrow()
  })
})
