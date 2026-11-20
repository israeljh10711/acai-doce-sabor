// Supabase Realtime de mentira (painel ao vivo, 2026-11-20), para o Supabase de mentira:
// - um servidor WebSocket mínimo, sem pacote (aperto de mão, quadros de texto, ping e fechamento);
// - o protocolo que o @supabase/realtime-js usa (Phoenix, versão 2.0.0: mensagens
//   [join_ref, ref, tópico, evento, conteúdo]): heartbeat, phx_join com postgres_changes,
//   access_token e phx_leave;
// - as mudanças da tabela orders (INSERT e UPDATE) só para quem entrou com o token do vendedor,
//   como o RLS do Supabase.
import { createHash } from 'node:crypto'

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'

function frame(text) {
  const payload = Buffer.from(text)
  const length = payload.length
  let header
  if (length < 126) header = Buffer.from([0x81, length])
  else if (length < 65_536) {
    header = Buffer.alloc(4)
    header[0] = 0x81
    header[1] = 126
    header.writeUInt16BE(length, 2)
  } else {
    header = Buffer.alloc(10)
    header[0] = 0x81
    header[1] = 127
    header.writeBigUInt64BE(BigInt(length), 2)
  }
  return Buffer.concat([header, payload])
}

/**
 * Liga o Realtime de mentira ao servidor HTTP. `isPublicKey(apikey)` confere a chave do endereço;
 * `sellerToken` é o token que o "RLS" aceita.
 */
export function attachFakeRealtime(server, { isPublicKey, sellerToken }) {
  const stats = { connections: 0, joins: 0, leaves: 0, closed: 0, sockets: new Set(), subscriptions: [] }
  let nextId = 1000

  server.on('upgrade', (request, socket) => {
    const url = new URL(request.url, 'http://127.0.0.1')
    if (url.pathname !== '/realtime/v1/websocket' || !isPublicKey(url.searchParams.get('apikey'))) {
      socket.end('HTTP/1.1 401 Unauthorized\r\n\r\n')
      return
    }
    const accept = createHash('sha1').update(`${request.headers['sec-websocket-key']}${GUID}`).digest('base64')
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`)
    stats.connections++
    stats.sockets.add(socket)
    const send = (message) => {
      if (!socket.destroyed) socket.write(frame(JSON.stringify(message)))
    }
    const reply = (joinRef, ref, topic, response = {}) => send([joinRef, ref, topic, 'phx_reply', { status: 'ok', response }])

    const handle = (message) => {
      const [joinRef, ref, topic, event, payload] = message
      if (topic === 'phoenix' && event === 'heartbeat') return reply(null, ref, 'phoenix')
      if (event === 'phx_join') {
        stats.joins++
        const filters = payload?.config?.postgres_changes ?? []
        const ids = filters.map(() => nextId++)
        stats.subscriptions = stats.subscriptions.filter((sub) => !(sub.socket === socket && sub.topic === topic))
        stats.subscriptions.push({ socket, send, topic, joinRef, token: payload?.access_token ?? null, ids, filters })
        return reply(joinRef, ref, topic, { postgres_changes: filters.map((filter, index) => ({ id: ids[index], event: filter.event, schema: filter.schema, table: filter.table })) })
      }
      if (event === 'access_token') {
        for (const sub of stats.subscriptions) if (sub.socket === socket && sub.topic === topic) sub.token = payload?.access_token ?? null
        return reply(joinRef, ref, topic)
      }
      if (event === 'phx_leave') {
        stats.leaves++
        stats.subscriptions = stats.subscriptions.filter((sub) => !(sub.socket === socket && sub.topic === topic))
        return reply(joinRef, ref, topic)
      }
      return reply(joinRef, ref, topic)
    }

    let buffer = Buffer.alloc(0)
    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk])
      for (;;) {
        if (buffer.length < 2) return
        const opcode = buffer[0] & 0x0f
        const masked = (buffer[1] & 0x80) !== 0
        let length = buffer[1] & 0x7f
        let offset = 2
        if (length === 126) {
          if (buffer.length < 4) return
          length = buffer.readUInt16BE(2)
          offset = 4
        } else if (length === 127) {
          if (buffer.length < 10) return
          length = Number(buffer.readBigUInt64BE(2))
          offset = 10
        }
        const maskAt = offset
        if (masked) offset += 4
        if (buffer.length < offset + length) return
        let payload = buffer.subarray(offset, offset + length)
        if (masked) {
          const mask = buffer.subarray(maskAt, maskAt + 4)
          payload = Buffer.from(payload.map((byte, index) => byte ^ mask[index % 4]))
        }
        buffer = buffer.subarray(offset + length)
        if (opcode === 0x1) {
          try {
            handle(JSON.parse(payload.toString('utf8')))
          } catch {
            // mensagem estranha: ignora
          }
        } else if (opcode === 0x8) {
          socket.end(Buffer.from([0x88, 0x00]))
        } else if (opcode === 0x9) {
          socket.write(Buffer.concat([Buffer.from([0x8a, payload.length]), payload]))
        }
      }
    })
    const gone = () => {
      if (!stats.sockets.delete(socket)) return
      stats.closed++
      stats.subscriptions = stats.subscriptions.filter((sub) => sub.socket !== socket)
    }
    socket.on('close', gone)
    socket.on('error', gone)
  })

  /** Uma mudança na tabela orders: vai só para as inscrições com o token do vendedor (RLS). */
  const publish = (type, record) => {
    for (const sub of stats.subscriptions) {
      if (sub.token !== sellerToken) continue
      const ids = sub.ids.filter((_, index) => {
        const filter = sub.filters[index]
        return filter.table === 'orders' && (filter.event === '*' || filter.event === type)
      })
      if (ids.length === 0) continue
      sub.send([
        sub.joinRef,
        null,
        sub.topic,
        'postgres_changes',
        { ids, data: { schema: 'public', table: 'orders', commit_timestamp: new Date().toISOString(), type, columns: [], record, ...(type === 'UPDATE' ? { old_record: { id: record.id } } : {}), errors: null } },
      ])
    }
  }

  return {
    stats,
    publish,
    /** Inscrições ativas em orders com o token do vendedor. */
    sellerSubscriptions: () => stats.subscriptions.filter((sub) => sub.token === sellerToken).length,
    closeAll: () => {
      for (const socket of stats.sockets) socket.destroy()
    },
  }
}
