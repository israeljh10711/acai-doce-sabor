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

/**
 * @param {string} profileDir pasta de perfil descartável do navegador
 * @param {number} port porta de depuração
 */
export async function openBrowser(profileDir, port = 9333) {
  mkdirSync(profileDir, { recursive: true })

  const browser = spawn(
    EDGE,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      `--user-data-dir=${profileDir}`,
      `--remote-debugging-port=${port}`,
      'about:blank',
    ],
    { stdio: 'ignore' },
  )

  let targets = null
  for (let attempt = 0; attempt < 75 && !targets; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`)
      if (response.ok) targets = await response.json()
    } catch {
      // navegador ainda subindo
    }
    if (!targets) await sleep(200)
  }
  if (!targets) {
    browser.kill()
    throw new Error(`O Edge não respondeu. Caminho usado: ${EDGE}`)
  }

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

  /** Abre um endereço em um tamanho de tela e espera as fontes e a animação de entrada. */
  const goto = async (url, { width, height, dpr = 1, mobile = width < 900 }) => {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: dpr,
      mobile,
    })
    events.length = 0
    await send('Page.navigate', { url })
    for (let attempt = 0; attempt < 100; attempt++) {
      await sleep(100)
      if (events.some((event) => event.method === 'Page.loadEventFired')) break
    }
    await evaluate('document.fonts.ready.then(() => true)')
    await sleep(1200)
  }

  /** Erros e avisos do console desde a última navegação. */
  const consoleProblems = () =>
    events
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
