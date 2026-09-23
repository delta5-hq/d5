import StreamController from './StreamController'
import StreamBridge from './streaming/StreamBridge'

describe('StreamController', () => {
  let ctx

  beforeEach(() => {
    ctx = {
      query: {},
      headers: {},
      set: jest.fn(),
      throw: jest.fn((code, message) => {
        const err = new Error(message)
        err.statusCode = code
        throw err
      }),
      request: {
        socket: {
          setTimeout: jest.fn(),
          setNoDelay: jest.fn(),
          setKeepAlive: jest.fn(),
        },
      },
      req: {
        on: jest.fn(),
        socket: {
          setTimeout: jest.fn(),
          setNoDelay: jest.fn(),
          setKeepAlive: jest.fn(),
        },
      },
    }

    jest.spyOn(StreamBridge, 'attachReader')
    jest.spyOn(StreamBridge, 'closeSession')
  })

  afterEach(() => {
    for (const [id] of StreamBridge.sessions) {
      StreamBridge.closeSession(id)
    }
    jest.restoreAllMocks()
  })

  describe('stream endpoint', () => {
    it('should attach a reader, set SSE headers, set status 200, and return a stream body', async () => {
      ctx.query = {sessionId: 'test-session-1'}

      await StreamController.stream(ctx)

      expect(StreamBridge.attachReader).toHaveBeenCalledWith('test-session-1', null)
      expect(ctx.set).toHaveBeenCalledWith({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      })
      expect(ctx.status).toBe(200)
      expect(typeof ctx.body.pipe).toBe('function')
    })

    it('should pass the parsed Last-Event-ID header to attachReader for replay', async () => {
      ctx.query = {sessionId: 'test-session-1'}
      ctx.headers = {'last-event-id': '7'}

      await StreamController.stream(ctx)

      expect(StreamBridge.attachReader).toHaveBeenCalledWith('test-session-1', 7)
    })

    it('should treat Last-Event-ID 0 as a valid replay point', async () => {
      ctx.query = {sessionId: 'test-session-1'}
      ctx.headers = {'last-event-id': '0'}

      await StreamController.stream(ctx)

      expect(StreamBridge.attachReader).toHaveBeenCalledWith('test-session-1', 0)
    })

    it('should pass null when Last-Event-ID header has a non-numeric value', async () => {
      ctx.query = {sessionId: 'test-session-1'}
      ctx.headers = {'last-event-id': 'not-a-number'}

      await StreamController.stream(ctx)

      expect(StreamBridge.attachReader).toHaveBeenCalledWith('test-session-1', null)
    })

    it('should throw 400 when sessionId is missing from query', async () => {
      ctx.query = {}
      await expect(StreamController.stream(ctx)).rejects.toThrow('sessionId is required')
      expect(ctx.throw).toHaveBeenCalledWith(400, 'sessionId is required')
    })

    it('should throw 400 when sessionId is undefined', async () => {
      ctx.query = {sessionId: undefined}
      await expect(StreamController.stream(ctx)).rejects.toThrow('sessionId is required')
    })

    it('should throw 400 when sessionId is null', async () => {
      ctx.query = {sessionId: null}
      await expect(StreamController.stream(ctx)).rejects.toThrow('sessionId is required')
    })

    it('should throw 400 when sessionId is an empty string', async () => {
      ctx.query = {sessionId: ''}
      await expect(StreamController.stream(ctx)).rejects.toThrow('sessionId is required')
    })

    it('should configure the socket for long-lived connections', async () => {
      ctx.query = {sessionId: 'test-session-1'}

      await StreamController.stream(ctx)

      expect(ctx.request.socket.setTimeout).toHaveBeenCalledWith(0)
      expect(ctx.req.socket.setNoDelay).toHaveBeenCalledWith(true)
      expect(ctx.req.socket.setKeepAlive).toHaveBeenCalledWith(true)
    })

    it('should register both close and error event handlers on the request', async () => {
      ctx.query = {sessionId: 'test-session-1'}
      await StreamController.stream(ctx)
      expect(ctx.req.on).toHaveBeenCalledWith('close', expect.any(Function))
      expect(ctx.req.on).toHaveBeenCalledWith('error', expect.any(Function))
    })

    it('should close the session when the client disconnects', async () => {
      ctx.query = {sessionId: 'test-session-1'}
      let closeHandler
      ctx.req.on.mockImplementation((event, handler) => {
        if (event === 'close') closeHandler = handler
      })

      await StreamController.stream(ctx)
      closeHandler()
      expect(StreamBridge.closeSession).toHaveBeenCalledWith('test-session-1')
    })

    it('should close the session when a client connection error occurs', async () => {
      ctx.query = {sessionId: 'test-session-1'}
      let errorHandler
      ctx.req.on.mockImplementation((event, handler) => {
        if (event === 'error') errorHandler = handler
      })

      await StreamController.stream(ctx)
      errorHandler(new Error('network error'))
      expect(StreamBridge.closeSession).toHaveBeenCalledWith('test-session-1')
    })

    it('should attach a new reader on each call — supporting reconnects', async () => {
      ctx.query = {sessionId: 'rapid-session'}
      await StreamController.stream(ctx)
      await StreamController.stream(ctx)
      await StreamController.stream(ctx)
      expect(StreamBridge.attachReader).toHaveBeenCalledTimes(3)
    })

    it('should support multiple concurrent sessions with different ids', async () => {
      const ctx1 = {...ctx, headers: {}, query: {sessionId: 'session-1'}}
      const ctx2 = {...ctx, headers: {}, query: {sessionId: 'session-2'}}
      const ctx3 = {...ctx, headers: {}, query: {sessionId: 'session-3'}}
      await Promise.all([StreamController.stream(ctx1), StreamController.stream(ctx2), StreamController.stream(ctx3)])
      expect(StreamBridge.sessions.size).toBeGreaterThanOrEqual(3)
    })
  })

  describe('edge cases', () => {
    it('should handle session IDs with special characters', async () => {
      const specialId = 'session-123_abc@domain.com'
      ctx.query = {sessionId: specialId}
      await StreamController.stream(ctx)
      expect(StreamBridge.attachReader).toHaveBeenCalledWith(specialId, null)
    })

    it('should handle very long session IDs', async () => {
      const longId = 'x'.repeat(1000)
      ctx.query = {sessionId: longId}
      await StreamController.stream(ctx)
      expect(StreamBridge.attachReader).toHaveBeenCalledWith(longId, null)
    })

    it('should throw when socket methods are not available', async () => {
      ctx.query = {sessionId: 'test'}
      ctx.request.socket = {}
      ctx.req.socket = {}
      await expect(StreamController.stream(ctx)).rejects.toThrow()
    })

    it('should throw when req.on is not a function', async () => {
      ctx.query = {sessionId: 'test'}
      delete ctx.req.on
      await expect(StreamController.stream(ctx)).rejects.toThrow()
    })
  })
})
