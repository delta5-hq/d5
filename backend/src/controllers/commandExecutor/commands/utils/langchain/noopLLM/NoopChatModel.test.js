import {NoopChatModel} from './NoopChatModel'

const fixedPlan = () => 'fixed-response'

describe('NoopChatModel', () => {
  it('invoke returns an AIMessage-like object with content from the plan function', async () => {
    const model = new NoopChatModel({plan: fixedPlan})
    const result = await model.invoke([{content: 'anything'}])
    expect(result.content).toBe('fixed-response')
  })

  it('passes messages through to the plan function', async () => {
    const seen = []
    const model = new NoopChatModel({
      plan: msgs => {
        seen.push(msgs)
        return 'ok'
      },
    })
    await model.invoke([{content: 'hello'}])
    expect(seen[0]).toEqual([{content: 'hello'}])
  })

  it('rejects with AbortError when signal is already aborted', async () => {
    const model = new NoopChatModel({plan: fixedPlan})
    const controller = new AbortController()
    controller.abort()
    await expect(model.invoke([{content: 'x'}], {signal: controller.signal})).rejects.toMatchObject({
      name: 'AbortError',
    })
  })

  it('stream yields a single AIMessage', async () => {
    const model = new NoopChatModel({plan: fixedPlan})
    const stream = await model.stream([{content: 'x'}])
    const chunks = []
    for await (const chunk of stream) chunks.push(chunk)
    expect(chunks).toHaveLength(1)
    expect(chunks[0].content).toBe('fixed-response')
  })

  it('bind and withStructuredOutput return the model itself for langchain compatibility', () => {
    const model = new NoopChatModel({plan: fixedPlan})
    expect(model.bind()).toBe(model)
    expect(model.withStructuredOutput()).toBe(model)
  })

  it('call is an alias of invoke (langchain back-compat)', async () => {
    const model = new NoopChatModel({plan: fixedPlan})
    const result = await model.call([{content: 'x'}])
    expect(result.content).toBe('fixed-response')
  })

  it('invoke without an options argument does not throw', async () => {
    const model = new NoopChatModel({plan: fixedPlan})
    await expect(model.invoke([{content: 'x'}])).resolves.toMatchObject({content: 'fixed-response'})
  })

  it('invoke with an empty messages array still resolves via the plan function', async () => {
    const model = new NoopChatModel({plan: msgs => `len:${msgs.length}`})
    const result = await model.invoke([])
    expect(result.content).toBe('len:0')
  })

  it('propagates synchronous errors thrown by the plan function', async () => {
    const model = new NoopChatModel({
      plan: () => {
        throw new Error('plan failed')
      },
    })
    await expect(model.invoke([{content: 'x'}])).rejects.toThrow('plan failed')
  })

  it('does not abort when a fresh (non-aborted) signal is passed', async () => {
    const model = new NoopChatModel({plan: fixedPlan})
    const controller = new AbortController()
    await expect(model.invoke([{content: 'x'}], {signal: controller.signal})).resolves.toMatchObject({
      content: 'fixed-response',
    })
  })
})
