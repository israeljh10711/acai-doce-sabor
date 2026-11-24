import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'vite'
import { PUBLIC_KEY, startFakeSupabase } from './fake-supabase.mjs'
import { openBrowser, sleep } from './lib.mjs'

// Respostas do serviço de conta exclusivas deste teste de interface.
function accountResponses() {
  const realFetch = window.fetch
  const json = data => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } })
  window.fetch = async (input, init) => {
    const path = new URL(input, location.origin).pathname
    if (path === '/functions/v1/conta') {
      const { identifier, action, password } = JSON.parse(init.body)
      if (identifier !== 'cliente.teste' || password !== 'senhaTeste123') throw new Error('Entrada inesperada')
      localStorage.setItem('teste-acao-conta', action)
      return json({
        access_token: 'jwt-cliente-teste', refresh_token: 'refresh-cliente-teste', expires_in: 3600,
        user: { id: 'cliente-teste', app_metadata: { customer_account: true, customer_identifier: identifier } },
      })
    }
    if (path === '/rest/v1/customer_addresses' || path === '/rest/v1/rpc/historico_cliente') {
      if (new Headers(init.headers).get('Authorization') !== 'Bearer jwt-cliente-teste') throw new Error('Token ausente')
      if (path.endsWith('customer_addresses')) {
        if (init.method === 'POST') {
          localStorage.setItem('teste-endereco', init.body)
          return new Response(null, { status: 204 })
        }
        const address = JSON.parse(localStorage.getItem('teste-endereco'))
        return json(address ? [address] : [])
      }
      return json([{
        id: 'pedido-1', code: 'ADS-0123', created_at: '2026-11-22T15:00:00Z', status: 'concluido',
        fulfillment: 'entrega', total_cents: 400, items: [{ name: 'Água mineral', quantity: 2 }],
        carts: [{ v: 2, items: [{ kind: 'extra', id: 'antigo', itemId: 'agua-mineral-500-ml', choices: [], quantity: 2, note: 'Gelada' }] }],
      }])
    }
    return realFetch(input, init)
  }
}

const fake = await startFakeSupabase()
process.env.VITE_SUPABASE_URL = fake.url
process.env.VITE_SUPABASE_ANON_KEY = PUBLIC_KEY
process.env.VITE_SELLER_EMAIL = 'vendedor@teste.local'
const site = await createServer({ cacheDir: join(tmpdir(), 'acai-vite-conta'), server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' })
let browser
try {
  await site.listen()
  const base = site.resolvedUrls.local[0]
  browser = await openBrowser(mkdtempSync(join(tmpdir(), 'acai-conta-')), 9395)
  await browser.send('Page.addScriptToEvaluateOnNewDocument', { source: `(${accountResponses.toString()})()` })
  const viewport = { width: 390, height: 844 }
  const visit = path => browser.goto(new URL(path, base).href, viewport)
  const run = expression => browser.evaluate(expression)
  const wait = async condition => {
    for (let i = 0; i < 150; i++) {
      if (await run(condition)) return
      await sleep(100)
    }
    throw new Error(`Condição pendente: ${condition}. Tela: ${await run('document.body.innerText.slice(0, 1400)')}`)
  }
  const click = async (selector, label) => {
    const expression = label
      ? `[...document.querySelectorAll(${JSON.stringify(selector)})].find(el => el.textContent.trim() === ${JSON.stringify(label)})`
      : `document.querySelector(${JSON.stringify(selector)})`
    await wait(`Boolean(${expression})`)
    await run(`${expression}.click()`)
  }
  const fill = (selector, value) => run(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)})
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(value)})
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })()`)
  const credentials = async () => {
    await wait("Boolean(document.querySelector('input[name=identifier]'))")
    await fill('input[name=identifier]', 'cliente.teste')
    await fill('input[name=password]', 'senhaTeste123')
    await click('form button')
  }

  await visit('/carrinho')
  await run(`localStorage.setItem('acai-doce-sabor:carrinho', JSON.stringify({v:2,items:[{kind:'extra',id:'atual',itemId:'jujuba',quantity:1,choices:[]}]}))`)
  await visit('/carrinho')
  await click('a', 'Entrar ou criar conta')
  await click('button', 'Criar uma conta')
  await credentials()
  await wait("location.pathname === '/carrinho' && localStorage.getItem('teste-acao-conta') === 'signup'")
  await click('input[value=entrega]')
  await wait("Boolean(document.querySelector('[data-field=street]'))")
  await fill('[data-field=street]', 'Rua da Praça')
  await fill('[data-field=number]', '12A')
  if (await run("Boolean(document.querySelector('[data-field=zone]'))")) {
    await run("const zone = document.querySelector('[data-field=zone]'); zone.value='outro'; zone.dispatchEvent(new Event('change',{bubbles:true}))")
  }
  await fill('[data-field=district]', 'Centro')
  await click('button', 'Salvar endereço na minha conta')
  await wait("document.body.innerText.includes('Endereço salvo na sua conta')")
  await visit('/carrinho')
  await click('input[value=entrega]')
  await wait("document.querySelector('[data-field=street]')?.value === 'Rua da Praça'")
  await click('a', 'Minha conta e últimos pedidos')
  await wait("document.querySelector('main h2')?.textContent === 'Últimos Pedidos'")
  await click('button', 'Refazer pedido anterior')
  await wait("location.pathname === '/carrinho' && document.body.innerText.includes('Itens do pedido adicionados')")
  const items = await run("JSON.parse(localStorage.getItem('acai-doce-sabor:carrinho')).items")
  assert.deepEqual(items.map(item => [item.itemId, item.quantity, item.note]), [['jujuba', 1, undefined], ['agua-mineral-500-ml', 2, 'Gelada']])
  assert.notEqual(items[1].id, 'antigo')
  assert.equal(await run('document.documentElement.scrollWidth <= innerWidth'), true)
  await click('a', 'Minha conta e últimos pedidos')
  await click('button', 'Sair da conta')
  await click('a', 'Voltar ao carrinho')
  await click('input[value=entrega]')
  await wait("document.querySelector('[data-field=street]')?.value === ''")
  await visit('/acompanhar')
  await click('a', 'Entrar ou criar conta')
  await credentials()
  await wait("localStorage.getItem('teste-acao-conta') === 'signin' && document.body.innerText.includes('ADS-0123')")
  console.log('Conta, endereço, recompra e logout conferidos na interface móvel.')
} finally {
  browser?.close()
  await site.close()
  await fake.close()
}
