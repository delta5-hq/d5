import {HTTPExecutor} from './HTTPExecutor'

/* global fetch */
global.fetch = jest.fn()

describe('HTTPExecutor', () => {
  let executor

  beforeEach(() => {
    executor = new HTTPExecutor()
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('makes POST request with body', async () => {
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: jest.fn().mockResolvedValue('{"result":"success"}'),
    })

    const promise = executor.execute({
      url: 'http://example.com/api',
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: '{"prompt":"test"}',
    })

    jest.runAllTimers()
    const result = await promise

    expect(fetch).toHaveBeenCalledWith('http://example.com/api', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: '{"prompt":"test"}',
      signal: expect.any(AbortSignal),
    })
    expect(result).toEqual({
      status: 200,
      body: '{"result":"success"}',
      isError: false,
    })
  })

  it('makes GET request without body', async () => {
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: jest.fn().mockResolvedValue('response'),
    })

    const promise = executor.execute({
      url: 'http://example.com/api',
      method: 'GET',
    })

    jest.runAllTimers()
    const result = await promise

    expect(fetch).toHaveBeenCalledWith('http://example.com/api', {
      method: 'GET',
      headers: {},
      signal: expect.any(AbortSignal),
    })
    expect(result.body).toBe('response')
  })

  it('marks non-ok responses as errors', async () => {
    fetch.mockResolvedValue({
      ok: false,
      status: 404,
      text: jest.fn().mockResolvedValue('Not Found'),
    })

    const promise = executor.execute({
      url: 'http://example.com/api',
    })

    jest.runAllTimers()
    const result = await promise

    expect(result).toEqual({
      status: 404,
      body: 'Not Found',
      isError: true,
    })
  })

  it('throws on timeout', async () => {
    const abortError = new Error('Aborted')
    abortError.name = 'AbortError'
    fetch.mockRejectedValue(abortError)

    const promise = executor.execute({
      url: 'http://example.com/api',
      timeoutMs: 50,
    })

    jest.advanceTimersByTime(50)

    await expect(promise).rejects.toThrow('HTTP request timeout after 50ms')
  })

  it('throws on network error', async () => {
    fetch.mockRejectedValue(new Error('Network failure'))

    const promise = executor.execute({
      url: 'http://example.com/api',
    })

    jest.runAllTimers()

    await expect(promise).rejects.toThrow('HTTP request failed: Network failure')
  })
})
