// Auditoria de ponta a ponta num Supabase DE TESTE (2026-11-21): o site de verdade num navegador de
// verdade (Edge sem janela), o banco, as RPCs, o RLS, o Storage, o Realtime e a função "pedido" do
// projeto de teste.
//
// Segurança:
// - as credenciais vêm só do arquivo apontado por E2E_SECRETS (fora do repositório). Nada de chave,
//   senha ou token no código ou nos relatórios;
// - o harness SE RECUSA a rodar se o endereço do Supabase for o da produção (.env.local);
// - tudo o que a auditoria cria tem o prefixo E2E-ACAI-TEST- (ou e2e-acai-test- nos ids), e a limpeza
//   usa só os ids guardados no estado da rodada.
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export const PROJECT = process.cwd()
export const OUT = join(tmpdir(), 'acai-doce-sabor-auditoria-e2e')
mkdirSync(OUT, { recursive: true })
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
export const PREFIX = 'E2E-ACAI-TEST-'

/* ------------------------------------------------------------------------------------------- */
/* Ambiente                                                                                     */
/* ------------------------------------------------------------------------------------------- */

const productionUrl = () => {
  try {
    const line = readFileSync(join(PROJECT, '.env.local'), 'utf8')
      .split(/\r?\n/)
      .find((entry) => entry.startsWith('VITE_SUPABASE_URL='))
    return line ? line.slice('VITE_SUPABASE_URL='.length).trim().replace(/\/+$/, '') : null
  } catch {
    return null
  }
}

/** As credenciais do projeto de TESTE. Para tudo se apontarem para a produção. */
export function loadSecrets() {
  const file = process.env.E2E_SECRETS
  if (!file || !existsSync(file)) throw new Error('Defina E2E_SECRETS com o arquivo de credenciais do projeto de TESTE.')
  const secrets = JSON.parse(readFileSync(file, 'utf8'))
  const url = String(secrets.url ?? '').replace(/\/+$/, '')
  if (!url.startsWith('https://') || !secrets.publicKey || !secrets.serverKey || !secrets.seller?.email) throw new Error('Credenciais de teste incompletas.')
  if (url === productionUrl()) throw new Error('RECUSADO: o endereço é o do Supabase de PRODUÇÃO. A auditoria só roda no projeto de teste.')
  return { ...secrets, url }
}

/* ------------------------------------------------------------------------------------------- */
/* Estado da rodada (ids criados) e relatório                                                   */
/* ------------------------------------------------------------------------------------------- */

const STATE_FILE = join(OUT, 'estado.json')
export function loadState() {
  return existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, 'utf8')) : { run: Date.now().toString(36), created: [], orders: [], uploads: [], results: [] }
}
export function saveState(state) {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
}

/** Um resultado: PASS, FAIL, BLOCKED, NOT RUN ou PARTIAL, com a prova. */
export function recorder(state, area) {
  return (control, status, evidence = '') => {
    state.results = state.results.filter((entry) => !(entry.area === area && entry.control === control))
    state.results.push({ area, control, status, evidence: String(evidence).slice(0, 400) })
    saveState(state)
    console.log(`${status.padEnd(7)} [${area}] ${control}${evidence ? ` — ${String(evidence).slice(0, 220)}` : ''}`)
    return status === 'PASS'
  }
}
/** PASS se a condição vale; senão FAIL. */
export const check = (record) => (control, condition, evidence = '') => record(control, condition ? 'PASS' : 'FAIL', evidence)

/* ------------------------------------------------------------------------------------------- */
/* Banco (chave de servidor, só para CONFERIR o que a tela gravou e para a limpeza final)        */
/* ------------------------------------------------------------------------------------------- */

export function database(secrets) {
  const headers = { apikey: secrets.serverKey, Authorization: `Bearer ${secrets.serverKey}`, 'Content-Type': 'application/json' }
  const call = async (path, init = {}) => {
    const response = await fetch(`${secrets.url}${path}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) } })
    const text = await response.text()
    let body = null
    try {
      body = text ? JSON.parse(text) : null
    } catch {
      body = text
    }
    return { status: response.status, body }
  }
  return {
    call,
    /** Linhas de uma tabela (filtro do PostgREST). */
    async rows(table, query = '') {
      const result = await call(`/rest/v1/${table}?${query}`)
      if (result.status !== 200) throw new Error(`Leitura de ${table} falhou: ${result.status} ${JSON.stringify(result.body).slice(0, 200)}`)
      return result.body
    },
    async one(table, query) {
      const list = await this.rows(table, query)
      return list[0] ?? null
    },
    /** Apaga só pela chave exata (limpeza). */
    async remove(table, filter) {
      const result = await call(`/rest/v1/${table}?${filter}`, { method: 'DELETE', headers: { Prefer: 'return=representation' } })
      return { status: result.status, count: Array.isArray(result.body) ? result.body.length : 0, body: result.body }
    },
  }
}

/** Chamadas como o público (chave publishable), com ou sem o token de uma sessão. */
export function publicApi(secrets, token = null) {
  return async (path, init = {}) => {
    const response = await fetch(`${secrets.url}${path}`, {
      ...init,
      headers: { apikey: secrets.publicKey, ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    })
    const text = await response.text()
    let body = null
    try {
      body = text ? JSON.parse(text) : null
    } catch {
      body = text
    }
    return { status: response.status, body }
  }
}

/** Login por senha (para os testes de RLS com conta que não é vendedor). */
export async function passwordToken(secrets, email, password) {
  const response = await fetch(`${secrets.url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: secrets.publicKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const body = await response.json()
  if (!body.access_token) throw new Error(`Login de teste falhou (${response.status})`)
  return body.access_token
}

/* ------------------------------------------------------------------------------------------- */
/* Site (Vite) ligado ao projeto de teste                                                        */
/* ------------------------------------------------------------------------------------------- */

export async function startSite(secrets, port = 5190) {
  process.env.VITE_SUPABASE_URL = secrets.url
  process.env.VITE_SUPABASE_ANON_KEY = secrets.publicKey
  process.env.VITE_SELLER_EMAIL = secrets.seller.email
  const { createServer } = await import('vite')
  const site = await createServer({
    configFile: join(PROJECT, 'vite.config.ts'),
    root: PROJECT,
    cacheDir: join(tmpdir(), 'acai-doce-sabor-vite-e2e-supabase'),
    server: { port, host: '127.0.0.1', strictPort: true },
    logLevel: 'error',
  })
  await site.listen()
  return { url: `http://127.0.0.1:${port}`, close: () => site.close() }
}

/* ------------------------------------------------------------------------------------------- */
/* Navegador: um perfil por contexto (cliente, vendedor, outro usuário)                          */
/* ------------------------------------------------------------------------------------------- */

const EDGE = process.env.EDGE_PATH ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'

export const HELPERS = `
  window.__q = (selector) => document.querySelector(selector);
  window.__all = (selector) => [...document.querySelectorAll(selector)];
  window.__dialog = () => [...document.querySelectorAll('dialog[open]')].at(-1) ?? null;
  window.__text = (el) => el?.innerText.replace(/\\s+/g, ' ').trim() ?? null;
  window.__set = (el, text) => {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, text);
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
    return true;
  };
  window.__button = (text, root = document) => [...root.querySelectorAll('button')].find((b) => b.textContent.replace(/\\s+/g, ' ').trim().startsWith(text));
  window.__switch = (text, root = document) => [...root.querySelectorAll('label')].find((l) => l.textContent.includes(text))?.querySelector('input[type=checkbox]');
  window.__label = (b) => b.getAttribute('aria-label') ?? b.textContent.trim();
  window.__noOverflow = () => document.documentElement.scrollWidth <= window.innerWidth;
  true;
`

let nextPort = 9420
export async function openPage(name) {
  const profile = join(OUT, `perfil-${name}`)
  mkdirSync(profile, { recursive: true })
  const port = nextPort++
  const child = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--autoplay-policy=no-user-gesture-required', `--user-data-dir=${profile}`, `--remote-debugging-port=${port}`, 'about:blank'], { stdio: 'ignore' })
  let targets = null
  for (let attempt = 0; attempt < 100 && !targets; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`)
      if (response.ok) targets = await response.json()
    } catch {
      // ainda abrindo
    }
    if (!targets) await sleep(200)
  }
  if (!targets) throw new Error('O Edge não abriu.')
  const target = targets.find((entry) => entry.type === 'page')
  const socket = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    socket.onopen = resolve
    socket.onerror = reject
  })
  let lastId = 0
  const pending = new Map()
  const console_ = []
  const network = []
  const requests = new Map()
  let loaded = false
  /** Quem ouve eventos do CDP pelo nome (ex.: Fetch.requestPaused). */
  const listeners = new Map()
  socket.onmessage = (message) => {
    const data = JSON.parse(message.data)
    if (!data.id && listeners.has(data.method)) for (const listener of listeners.get(data.method)) listener(data.params)
    if (data.id) {
      const waiter = pending.get(data.id)
      pending.delete(data.id)
      if (!waiter) return
      if (data.error) waiter.reject(new Error(data.error.message))
      else waiter.resolve(data.result)
      return
    }
    const { method, params } = data
    if (method === 'Page.loadEventFired') loaded = true
    if (method === 'Runtime.exceptionThrown') console_.push({ type: 'exception', text: params.exceptionDetails?.exception?.description ?? params.exceptionDetails?.text })
    if (method === 'Runtime.consoleAPICalled' && (params.type === 'error' || params.type === 'warning')) {
      console_.push({ type: params.type, text: params.args.map((arg) => arg.value ?? arg.description ?? '').join(' ') })
    }
    if (method === 'Log.entryAdded' && (params.entry.level === 'error' || params.entry.level === 'warning')) console_.push({ type: `log-${params.entry.level}`, text: `${params.entry.text} ${params.entry.url ?? ''}` })
    if (method === 'Network.requestWillBeSent') {
      const url = new URL(params.request.url)
      if (url.hostname.endsWith('.supabase.co')) requests.set(params.requestId, { method: params.request.method, path: url.pathname, query: url.search.slice(0, 160), body: (params.request.postData ?? '').slice(0, 2000) })
    }
    if (method === 'Network.responseReceived' && requests.has(params.requestId)) {
      network.push({ ...requests.get(params.requestId), status: params.response.status, at: Date.now() })
    }
    if (method === 'Network.loadingFailed' && requests.has(params.requestId)) network.push({ ...requests.get(params.requestId), status: 'falhou', error: params.errorText, at: Date.now() })
  }
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++lastId
      pending.set(id, { resolve, reject })
      socket.send(JSON.stringify({ id, method, params }))
    })
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Log.enable')
  await send('Network.enable')
  const evaluate = async (expression) => {
    const { result, exceptionDetails } = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text)
    return result.value
  }
  const run = async (expression) => {
    await evaluate(HELPERS)
    return evaluate(expression)
  }
  const page = {
    name,
    network,
    console: console_,
    send,
    run,
    on(method, listener) {
      listeners.set(method, [...(listeners.get(method) ?? []), listener])
    },
    async goto(url, { width = 1280, height = 900, mobile = width < 900 } = {}) {
      await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile })
      // O Edge sem janela diz "menos movimento"; simula um aparelho comum (como tests/browser/lib.mjs).
      await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] })
      loaded = false
      await send('Page.navigate', { url })
      for (let attempt = 0; attempt < 150 && !loaded; attempt++) await sleep(100)
      await evaluate('document.fonts.ready.then(() => true)').catch(() => true)
      await sleep(700)
    },
    async waitFor(condition, timeout = 12000) {
      for (let waited = 0; waited < timeout; waited += 150) {
        if (await run(`(() => { try { return !!(${condition}) } catch { return false } })()`).catch(() => false)) return true
        await sleep(150)
      }
      return false
    },
    async click(expression, pause = 350) {
      const ok = await run(`(() => { const el = ${expression}; if (!el) return false; el.scrollIntoView({ block: 'center' }); el.click(); return true })()`)
      if (!ok) throw new Error(`Elemento não encontrado: ${expression.slice(0, 160)}`)
      await sleep(pause)
    },
    /** Clique de verdade (mouse do CDP): o navegador libera a área de transferência só assim. */
    async realClick(expression, pause = 500) {
      await run(HELPERS)
      const box = await run(`(() => { const el = ${expression}; if (!el) return null; el.scrollIntoView({ block: 'center', behavior: 'instant' }); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
      if (!box) throw new Error(`Elemento não encontrado: ${expression.slice(0, 160)}`)
      await send('Page.bringToFront').catch(() => undefined)
      for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x: box.x, y: box.y, button: 'left', clickCount: 1 })
      await sleep(pause)
    },
    async set(selector, value) {
      const ok = await run(`(() => { const el = __q(${JSON.stringify(selector)}); if (!el) return false; return __set(el, ${JSON.stringify(value)}) })()`)
      if (!ok) throw new Error(`Campo não encontrado: ${selector}`)
      await sleep(120)
    },
    /** Envia um arquivo de verdade para um input[type=file] (DOM.setFileInputFiles). */
    async upload(selector, file) {
      const { root } = await send('DOM.getDocument', { depth: -1, pierce: true })
      const { nodeIds } = await send('DOM.querySelectorAll', { nodeId: root.nodeId, selector })
      if (!nodeIds.length) throw new Error(`Campo de arquivo não encontrado: ${selector}`)
      await send('DOM.setFileInputFiles', { nodeId: nodeIds.at(-1), files: [file] })
    },
    async shot(file) {
      const { data } = await send('Page.captureScreenshot', { format: 'png' })
      writeFileSync(join(OUT, `${file}.png`), Buffer.from(data, 'base64'))
      return join(OUT, `${file}.png`)
    },
    /** Pedidos ao Supabase desde `since` (método, caminho e situação; sem cabeçalhos nem tokens). */
    calls(since = 0, match = '') {
      return network.filter((entry) => entry.at >= since && entry.path.includes(match))
    },
    problems() {
      return console_.filter((entry) => !/warning X4122|Download the React DevTools|\[vite\]/.test(entry.text ?? ''))
    },
    /** Começa uma seção nova: os erros de console das seções anteriores já foram contados lá. */
    clearProblems() {
      console_.length = 0
    },
    close() {
      try {
        socket.close()
      } catch {
        // já fechado
      }
      child.kill()
    },
  }
  return page
}

/** Um PNG pequeno de verdade (foto de teste, sem nada sensível). */
export function testImage(name = 'foto-e2e', color = [106, 22, 80]) {
  // PNG 2x2 sem compressão interessante: cabeçalho, IHDR, IDAT (zlib) e IEND.
  const crc32 = (buffer) => {
    let crc = -1
    for (const byte of buffer) {
      crc ^= byte
      for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
    }
    return (crc ^ -1) >>> 0
  }
  const chunk = (type, data) => {
    const length = Buffer.alloc(4)
    length.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type), data])
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(body))
    return Buffer.concat([length, body, crc])
  }
  const width = 64
  const height = 48
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  const raw = Buffer.alloc((width * 3 + 1) * height)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) raw.set(color, y * (width * 3 + 1) + 1 + x * 3)
  // zlib "stored" (sem compressão), blocos de até 65535 bytes.
  const blocks = []
  for (let offset = 0; offset < raw.length; offset += 65535) {
    const part = raw.subarray(offset, offset + 65535)
    const header = Buffer.alloc(5)
    header[0] = offset + 65535 >= raw.length ? 1 : 0
    header.writeUInt16LE(part.length, 1)
    header.writeUInt16LE(~part.length & 0xffff, 3)
    blocks.push(header, part)
  }
  let a = 1
  let b = 0
  for (const byte of raw) {
    a = (a + byte) % 65521
    b = (b + a) % 65521
  }
  const adler = Buffer.alloc(4)
  adler.writeUInt32BE(((b << 16) | a) >>> 0)
  const idat = Buffer.concat([Buffer.from([0x78, 0x01]), ...blocks, adler])
  const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
  const file = join(OUT, `${name}.png`)
  writeFileSync(file, png)
  return file.replaceAll('\\', '/')
}

export function svgFile() {
  const file = join(OUT, 'nao-aceita.svg')
  writeFileSync(file, '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>')
  return file.replaceAll('\\', '/')
}
