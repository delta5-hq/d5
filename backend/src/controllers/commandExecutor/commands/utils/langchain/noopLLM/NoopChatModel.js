import {AIMessage} from '@langchain/core/messages'

const respectAbort = signal => {
  if (signal?.aborted) {
    const err = new Error('AbortError')
    err.name = 'AbortError'
    throw err
  }
}

export class NoopChatModel {
  constructor({plan}) {
    this.plan = plan
  }

  async invoke(messages, options = undefined) {
    respectAbort(options?.signal)
    await new Promise(resolve => setTimeout(resolve, 60))
    respectAbort(options?.signal)
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

  pipe(outputParser) {
    return {
      invoke: async (messages, options) => outputParser.invoke(await this.invoke(messages, options), options),
    }
  }

  bind() {
    return this
  }

  withStructuredOutput() {
    return this
  }
}
