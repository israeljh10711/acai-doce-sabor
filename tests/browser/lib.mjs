// Abre o Microsoft Edge sem janela e conversa com ele pelo protocolo de depuração (CDP).
// Sem dependências: usa o fetch e o WebSocket do próprio Node.
//
// O Edge sem janela ignora larguras menores que cerca de 500 px quando recebe só o
// tamanho da janela. Por isso a largura da tela é definida pela emulação do CDP.
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'

const EDGE =
  process.env.EDGE_PATH ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const REAL_SUPABASE_TEXT =
  'PARADO: este site usa o Supabase de verdade (.env.local). Rode a conferência num site sem o Supabase (as variáveis vazias valem mais que o .env.local), por exemplo: VITE_SUPABASE_URL= VITE_SUPABASE_ANON_KEY= VITE_SELLER_EMAIL= npx vite --port 5178 --strictPort, e passe http://127.0.0.1:5178 para a conferência.'
const REAL_SUPABASE_HOST = /^https:\/\/[a-z0-9-]+\.supabase\.co\//
/** O site conferido falou com um Supabase de verdade (a conferência para e não grava nada). */
let realSupabase = false

/**
 * @param {string} profileDir pasta de perfil descartável do navegador
 * @param {number} port porta de depuração
 */
export async function openBrowser(profileDir, port = 9333, extraArgs = []) {
  mkdirSync(profileDir, { recursive: true })

  const launch = () =>
    spawn(
      EDGE,
      [
        '--headless=new',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-extensions',
        `--user-data-dir=${profileDir}`,
        `--remote-debugging-port=${port}`,
        ...extraArgs,
        'about:blank',
      ],
      { stdio: 'ignore' },
    )

  // Logo depois de outra conferência, o Edge anterior pode ainda estar soltando a pasta de
  // perfil; o novo então não abre a porta de depuração. Nesse caso, espera e tenta de novo.
  let browser = null
  let targets = null
  for (let launchAttempt = 0; launchAttempt < 2 && !targets; launchAttempt++) {
    if (launchAttempt > 0) await sleep(3000)
    browser = launch()
    for (let attempt = 0; attempt < 75 && !targets; attempt++) {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/json/list`)
        if (response.ok) targets = await response.json()
      } catch {
        // navegador ainda subindo
      }
      if (!targets) await sleep(200)
    }
    if (!targets) browser.kill()
  }
  if (!targets) throw new Error(`O Edge não respondeu. Caminho usado: ${EDGE}`)

  const page = targets.find((target) => target.type === 'page')
  const socket = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    socket.onopen = resolve
    socket.onerror = reject
  })

  let lastId = 0
  const pending = new Map()
  /** Eventos recebidos desde a última navegação (console, erros, carregamento). */
  const events = []

  socket.onmessage = (message) => {
    const data = JSON.parse(message.data)
    // Um pedido a um Supabase de verdade, visto assim que começa (antes de a resposta chegar).
    if (data.method === 'Network.requestWillBeSent') {
      if (REAL_SUPABASE_HOST.test(data.params?.request?.url ?? '')) realSupabase = true
      return
    }
    if (data.id) {
      const waiter = pending.get(data.id)
      pending.delete(data.id)
      if (data.error) waiter.reject(new Error(data.error.message))
      else waiter.resolve(data.result)
    } else {
      events.push(data)
    }
  }

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++lastId
      pending.set(id, { resolve, reject })
      socket.send(JSON.stringify({ id, method, params }))
    })

  const evaluate = async (expression) => {
    const { result, exceptionDetails } = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    })
    if (exceptionDetails) {
      throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text)
    }
    return result.value
  }

  await send('Page.enable')
  await send('Runtime.enable')
  await send('Log.enable')
  await send('Network.enable')

  /**
   * Abre um endereço em um tamanho de tela e espera as fontes e a animação de entrada.
   * O Edge sem janela se apresenta com "reduzir movimento" ligado; por padrão a
   * conferência simula um aparelho comum. `reducedMotion: true` simula o contrário.
   */
  const goto = async (url, { width, height, dpr = 1, mobile = width < 900, reducedMotion = false }) => {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: dpr,
      mobile,
    })
    await send('Emulation.setEmulatedMedia', {
      features: [
        { name: 'prefers-reduced-motion', value: reducedMotion ? 'reduce' : 'no-preference' },
      ],
    })
    if (realSupabase) throw new Error(REAL_SUPABASE_TEXT)
    events.length = 0
    await send('Page.navigate', { url })
    for (let attempt = 0; attempt < 100; attempt++) {
      await sleep(100)
      if (events.some((event) => event.method === 'Page.loadEventFired')) break
    }
    await evaluate('document.fonts.ready.then(() => true)')
    await sleep(1200)
    // As conferências daqui gravam (pedidos, produtos, esgotado...) e só podem rodar no site sem o
    // Supabase de verdade. Em 2026-11-22, duas rodaram por engano no site da porta 5173 (com o
    // .env.local) e mudaram a loja real. Se a página falou com um *.supabase.co, a aba vai para
    // uma página em branco antes de qualquer passo, e toda navegação seguinte é recusada.
    if (realSupabase) {
      await send('Page.navigate', { url: 'about:blank' })
      console.error(REAL_SUPABASE_TEXT)
      throw new Error(REAL_SUPABASE_TEXT)
    }
  }

  /**
   * Erros e avisos do console desde a última navegação.
   * Fica de fora um único aviso conhecido: o compilador de sombreadores do Direct3D, usado pelo
   * Edge sem janela deste computador, avisa sobre precisão numérica ("warning X4122") na
   * primeira compilação. Não é erro do site e não aparece em celulares.
   */
  const isKnownDriverNotice = (event) => {
    if (event.method !== 'Runtime.consoleAPICalled' || event.params.type !== 'warning') return false
    // o three manda o título e o texto do aviso em partes separadas
    const text = event.params.args.map((arg) => String(arg.value ?? arg.description ?? '')).join(' ')
    return text.includes('Program Info Log') && /warning X\d+/.test(text) && !/\berror\b/i.test(text)
  }

  const consoleProblems = () =>
    events
      .filter((event) => !isKnownDriverNotice(event))
      .filter(
        (event) =>
          event.method === 'Runtime.exceptionThrown' ||
          (event.method === 'Runtime.consoleAPICalled' &&
            ['error', 'warning', 'assert'].includes(event.params.type)) ||
          (event.method === 'Log.entryAdded' &&
            ['error', 'warning'].includes(event.params.entry.level)),
      )
      .map((event) => {
        if (event.method === 'Runtime.exceptionThrown') {
          const details = event.params.exceptionDetails
          return 'exceção: ' + (details.exception?.description ?? details.text)
        }
        if (event.method === 'Log.entryAdded') {
          const entry = event.params.entry
          return `${entry.level}: ${entry.text} ${entry.url ?? ''}`
        }
        return (
          `${event.params.type}: ` +
          event.params.args.map((arg) => arg.value ?? arg.description).join(' ')
        )
      })

  /** Fotografa a página inteira ou um recorte ({ x, y, width, height }). */
  const screenshot = async (clip) => {
    let area = clip
    if (!area) {
      const metrics = await send('Page.getLayoutMetrics')
      area = {
        x: 0,
        y: 0,
        width: metrics.cssContentSize.width,
        height: Math.ceil(metrics.cssContentSize.height),
      }
    }
    const shot = await send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: true,
      clip: { ...area, scale: 1 },
    })
    return Buffer.from(shot.data, 'base64')
  }

  const close = () => {
    socket.close()
    browser.kill()
  }

  return { send, evaluate, goto, consoleProblems, screenshot, close }
}
