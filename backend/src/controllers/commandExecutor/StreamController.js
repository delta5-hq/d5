import StreamBridge from './streaming/StreamBridge'

const parseLastEventId = headers => {
  const raw = headers['last-event-id']
  if (!raw) return null
  const n = parseInt(raw, 10)
  return Number.isFinite(n) ? n : null
}

const StreamController = {
  stream: async ctx => {
    const {sessionId} = ctx.query

    if (!sessionId) {
      ctx.throw(400, 'sessionId is required')
    }

    const lastEventId = parseLastEventId(ctx.headers)

    ctx.request.socket.setTimeout(0)
    ctx.req.socket.setNoDelay(true)
    ctx.req.socket.setKeepAlive(true)

    ctx.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    })

    ctx.status = 200
    ctx.body = StreamBridge.attachReader(sessionId, lastEventId)

    ctx.req.on('close', () => {
      StreamBridge.closeSession(sessionId)
    })

    ctx.req.on('error', () => {
      StreamBridge.closeSession(sessionId)
    })
  },
}

export default StreamController
