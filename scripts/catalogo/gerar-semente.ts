// Escreve a semente do cardápio (o cardápio do código em registros do banco) na migração
// 20261121120000_catalogo_dinamico.sql, entre os marcadores. Uso: node scripts/catalogo/gerar-semente.ts
// O teste src/features/catalog/seedSql.test.ts confere que a migração está igual ao que sai daqui.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { baseCatalogRecords } from '../../src/features/catalog/baseRecords.ts'
import { replaceSeed, seedSql } from '../../src/features/catalog/seedSql.ts'

const file = fileURLToPath(new URL('../../supabase/migrations/20261121120000_catalogo_dinamico.sql', import.meta.url))
const before = readFileSync(file, 'utf8').replaceAll('\r\n', '\n')
const after = replaceSeed(before, seedSql(baseCatalogRecords()))
if (after === before) console.log('A semente já estava em dia.')
else {
  writeFileSync(file, after)
  console.log('Semente escrita na migração.')
}
