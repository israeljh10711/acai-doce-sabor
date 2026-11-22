// Auditoria de ponta a ponta no Supabase DE TESTE. Uso:
//   E2E_SECRETS=<arquivo fora do repositório> node tests/e2e-supabase/run.mjs [seções...]
// Seções: vendedor, catalogo, configuracoes, cliente, pedidos, seguranca, limpeza.
// O resultado de cada controle (PASS, FAIL, BLOCKED, PARTIAL) fica em %TEMP%/acai-doce-sabor-auditoria-e2e.
import { OUT, check, database, loadSecrets, loadState, openPage, recorder, saveState, startSite } from './harness.mjs'

const wanted = process.argv.slice(2)
const SECTIONS = ['vendedor', 'catalogo', 'configuracoes', 'cliente', 'pedidos', 'seguranca', 'limpeza']
const secrets = loadSecrets()
const state = loadState()
const db = database(secrets)
const site = await startSite(secrets)
const seller = await openPage('vendedor')
const customer = await openPage('cliente')
const ctx = { secrets, db, site, seller, customer, state, check, recorder }
try {
  for (const name of SECTIONS.filter((section) => wanted.length === 0 || wanted.includes(section))) {
    // Rodar a seção de novo troca os resultados dela (os da rodada anterior saem).
    state.results = state.results.filter((entry) => entry.area !== name)
    seller.clearProblems()
    customer.clearProblems()
    const record = recorder(state, name)
    console.log(`\n=========== ${name} ===========`)
    try {
      const section = await import(`./secao-${name}.mjs`)
      await section.default({ ...ctx, record, ok: check(record) })
    } catch (error) {
      record('seção interrompida por erro inesperado', 'FAIL', error.stack?.split('\n').slice(0, 3).join(' | ') ?? String(error))
      await seller.shot(`erro-${name}-vendedor`).catch(() => undefined)
      await customer.shot(`erro-${name}-cliente`).catch(() => undefined)
    }
  }
} finally {
  saveState(state)
  seller.close()
  customer.close()
  await site.close()
}
const totals = state.results.reduce((acc, entry) => ({ ...acc, [entry.status]: (acc[entry.status] ?? 0) + 1 }), {})
console.log(`\nTotais: ${JSON.stringify(totals)} — detalhes em ${OUT}\\estado.json`)
