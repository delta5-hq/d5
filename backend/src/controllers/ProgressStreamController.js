import {progressEventEmitter} from '../services/progress-event-emitter'

const ProgressStreamController = {
  stream: async ctx => {
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

    const stream = ctx.res

    const sendEvent = data => {
      if (!stream.destroyed) {
        stream.write(`data: ${JSON.stringify(data)}\n\n`)
      }
    }

    sendEvent({type: 'connected', timestamp: Date.now()})

    const progressHandler = data => sendEvent({type: 'progress', ...data})
    progressEventEmitter.on('progress', progressHandler)

    ctx.req.on('close', () => {
      progressEventEmitter.off('progress', progressHandler)
    })

    await new Promise(() => {})
  },
}

export default ProgressStreamController
