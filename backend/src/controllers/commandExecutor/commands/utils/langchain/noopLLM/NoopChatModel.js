import {AIMessage} from '@langchain/core/messages'

const respectAbort = signal => {
  if (signal?.aborted) {
    const err = new Error('AbortError')
    err.name = 'AbortError'
    throw err
  }
}

const readMockDelay = () => {
  const ms = Number(process.env.MOCK_FORK_SETTLE_DELAY_MS ?? 0)
  return Number.isFinite(ms) && ms > 0 ? ms : 0
}

const sleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(timer)
      const err = new Error('AbortError')
      err.name = 'AbortError'
      reject(err)
    })
  })

export class NoopChatModel {
  constructor({plan}) {
    this.plan = plan
  }

  async invoke(messages, options = undefined) {
    respectAbort(options?.signal)

    const delayMs = readMockDelay()
    if (delayMs > 0) {
      await sleep(delayMs, options?.signal)
      respectAbort(options?.signal)
    }

    const content = this.plan(messages)
    return new AIMessage({content})
  }

  async call(messages, options) {
    return this.invoke(messages, options)
  }

  async stream(messages, options) {
    const result = await this.invoke(messages, options)
    return (async function* () {
      yield result
    })()
  }

  bind() {
    return this
  }

  withStructuredOutput() {
    return this
  }
}
