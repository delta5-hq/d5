/**
 * HTTPExecutor Integration Tests
 *
 * Tests real HTTP network I/O using echo-http-server stub.
 * Complements HTTPExecutor.test.js (mocked fetch) by proving transport layer works.
 *
 * Focus: Actual network I/O, request/response round-trips, real timeout behavior
 * Unit tests cover: Mocked fetch behavior, parameter passing, error conditions
 */

const {HTTPExecutor} = require('./HTTPExecutor')
const {startEchoServer} = require('../../../../test-stubs/echo-http-server.cjs')
const {RPC_HTTP_METHOD} = require('../../constants/rpc')

describe('HTTPExecutor integration', () => {
  let echoServer
  let serverUrl

  beforeAll(async () => {
    echoServer = await startEchoServer()
    serverUrl = echoServer.url
  })

  afterAll(async () => {
    if (echoServer) {
      await echoServer.close()
    }
  })

  describe('HTTP method variants', () => {
    const testCases = [
      {method: RPC_HTTP_METHOD.POST, hasBody: true, description: 'POST with body'},
      {method: RPC_HTTP_METHOD.PUT, hasBody: true, description: 'PUT with body'},
      {method: RPC_HTTP_METHOD.GET, hasBody: false, description: 'GET without body'},
    ]

    testCases.forEach(({method, hasBody, description}) => {
      it(`executes ${description}`, async () => {
        const executor = new HTTPExecutor()
        const body = hasBody ? JSON.stringify({test: 'data', method}) : null

        const result = await executor.execute({
          url: serverUrl,
          method,
          body,
          timeoutMs: 5000,
        })

        expect(result.isError).toBe(false)
        expect(result.status).toBe(200)

        const responseData = JSON.parse(result.body)
        expect(responseData.method).toBe(method)
        if (hasBody) {
          expect(responseData.echoed).toBe(body)
        }
      })
    })
  })

  describe('request data integrity', () => {
    it('preserves various content types in request body', async () => {
      const executor = new HTTPExecutor()
      const testCases = [
        'simple string',
        '{"json": "object"}',
        '',
        'unicode: 日本語 🎉 Émojis',
        'special chars: <>&"\'',
      ]

      for (const testData of testCases) {
        const result = await executor.execute({
          url: serverUrl,
          method: RPC_HTTP_METHOD.POST,
          body: testData,
          timeoutMs: 5000,
        })

        const responseData = JSON.parse(result.body)
        expect(responseData.echoed).toBe(testData)
      }
    })

    it('handles large payload without truncation', async () => {
      const executor = new HTTPExecutor()
      const largeBody = JSON.stringify({data: 'x'.repeat(50000)})

      const result = await executor.execute({
        url: serverUrl,
        method: RPC_HTTP_METHOD.POST,
        body: largeBody,
        timeoutMs: 5000,
      })

      expect(result.isError).toBe(false)
      const responseData = JSON.parse(result.body)
      expect(responseData.echoed).toBe(largeBody)
      expect(responseData.echoed.length).toBe(largeBody.length)
    })
  })

  describe('URL path handling', () => {
    it('preserves URL path in requests', async () => {
      const executor = new HTTPExecutor()
      const paths = ['/resource', '/api/v1/execute', '/path/with/multiple/segments']

      for (const resourcePath of paths) {
        const result = await executor.execute({
          url: `${serverUrl}${resourcePath}`,
          method: RPC_HTTP_METHOD.POST,
          body: '{"test":true}',
          timeoutMs: 5000,
        })

        const responseData = JSON.parse(result.body)
        expect(responseData.url).toBe(resourcePath)
      }
    })
  })

  describe('header propagation', () => {
    it('sends custom headers to server', async () => {
      const executor = new HTTPExecutor()

      const result = await executor.execute({
        url: serverUrl,
        method: RPC_HTTP_METHOD.POST,
        headers: {
          'X-Custom-Header': 'test-value',
          'Content-Type': 'application/json',
        },
        body: '{"data":"value"}',
        timeoutMs: 5000,
      })

      expect(result.isError).toBe(false)
      expect(result.status).toBe(200)
    })
  })

  describe('response structure', () => {
    it('returns complete response structure with all required fields', async () => {
      const executor = new HTTPExecutor()

      const result = await executor.execute({
        url: serverUrl,
        method: RPC_HTTP_METHOD.GET,
        timeoutMs: 5000,
      })

      expect(result).toHaveProperty('status')
      expect(result).toHaveProperty('body')
      expect(result).toHaveProperty('isError')
      expect(typeof result.status).toBe('number')
      expect(typeof result.body).toBe('string')
      expect(typeof result.isError).toBe('boolean')
      expect(result.status).toBe(200)
      expect(result.isError).toBe(false)
    })
  })

  describe('timeout behavior', () => {
    it('times out on unreachable host', async () => {
      const executor = new HTTPExecutor()

      await expect(
        executor.execute({
          url: 'http://10.255.255.1:9999',
          method: RPC_HTTP_METHOD.GET,
          timeoutMs: 100,
        }),
      ).rejects.toThrow(/timeout/i)
    }, 10000)
  })

  describe('abort signal handling', () => {
    it('aborts request when signal fires immediately after start', async () => {
      const executor = new HTTPExecutor()
      const controller = new AbortController()

      const promise = executor.execute({
        url: 'http://10.255.255.1:9999',
        method: RPC_HTTP_METHOD.GET,
        signal: controller.signal,
        timeoutMs: 5000,
      })

      controller.abort()

      await expect(promise).rejects.toThrow(/abort/i)
    }, 10000)

    it('completes normally when signal is not aborted', async () => {
      const executor = new HTTPExecutor()
      const controller = new AbortController()

      const result = await executor.execute({
        url: serverUrl,
        method: RPC_HTTP_METHOD.GET,
        signal: controller.signal,
        timeoutMs: 5000,
      })

      expect(result.isError).toBe(false)
      expect(result.status).toBe(200)
    })

    it('handles abort signal during in-flight request', async () => {
      const executor = new HTTPExecutor()
      const controller = new AbortController()

      setTimeout(() => controller.abort(), 50)

      await expect(
        executor.execute({
          url: 'http://10.255.255.1:9999',
          method: RPC_HTTP_METHOD.GET,
          signal: controller.signal,
          timeoutMs: 5000,
        }),
      ).rejects.toThrow(/abort/i)
    }, 10000)
  })

  describe('concurrent request handling', () => {
    it('supports concurrent requests from same executor instance', async () => {
      const executor = new HTTPExecutor()

      const promises = [
        executor.execute({url: serverUrl, method: RPC_HTTP_METHOD.POST, body: 'req1', timeoutMs: 5000}),
        executor.execute({url: serverUrl, method: RPC_HTTP_METHOD.POST, body: 'req2', timeoutMs: 5000}),
        executor.execute({url: serverUrl, method: RPC_HTTP_METHOD.POST, body: 'req3', timeoutMs: 5000}),
      ]

      const results = await Promise.all(promises)

      expect(results).toHaveLength(3)
      results.forEach(result => {
        expect(result.isError).toBe(false)
        expect(result.status).toBe(200)
      })

      const bodies = results.map(r => JSON.parse(r.body).echoed)
      expect(bodies).toContain('req1')
      expect(bodies).toContain('req2')
      expect(bodies).toContain('req3')
    })

    it('supports concurrent requests from different executor instances', async () => {
      const executors = [new HTTPExecutor(), new HTTPExecutor(), new HTTPExecutor()]

      const results = await Promise.all(
        executors.map((executor, i) =>
          executor.execute({url: serverUrl, method: RPC_HTTP_METHOD.POST, body: `e${i}`, timeoutMs: 5000}),
        ),
      )

      expect(results).toHaveLength(3)
      results.forEach(result => expect(result.isError).toBe(false))
    })
  })
})
