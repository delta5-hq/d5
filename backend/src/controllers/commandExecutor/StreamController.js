import StreamBridge from './streaming/StreamBridge'

const StreamController = {
  stream: async ctx => {
    const {sessionId} = ctx.query

    if (!sessionId) {
      ctx.throw(400, 'sessionId is required')
    }

    const session = StreamBridge.createSession(sessionId)

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
    ctx.body = session.getReadableStream()

    ctx.req.on('close', () => {
      StreamBridge.closeSession(sessionId)
    })

    ctx.req.on('error', () => {
      StreamBridge.closeSession(sessionId)
    })
  },
}

export default StreamController
