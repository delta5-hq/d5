import StreamController from './StreamController'
import StreamBridge from './streaming/StreamBridge'

describe('StreamController', () => {
  let ctx

  beforeEach(() => {
    ctx = {
      query: {},
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

    jest.spyOn(StreamBridge, 'createSession')
    jest.spyOn(StreamBridge, 'closeSession')
  })

  afterEach(() => {
    for (const [id] of StreamBridge.sessions) {
      StreamBridge.closeSession(id)
    }
    jest.restoreAllMocks()
  })

  describe('stream endpoint', () => {
    it('should create SSE session and return stream', async () => {
      ctx.query = {sessionId: 'test-session-1'}

      await StreamController.stream(ctx)

      expect(StreamBridge.createSession).toHaveBeenCalledWith('test-session-1')
      expect(ctx.set).toHaveBeenCalledWith({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      })
      expect(ctx.status).toBe(200)
      expect(ctx.body).toBeDefined()
      expect(ctx.body.readable).toBe(true)
    })

    it('should throw 400 when sessionId is missing', async () => {
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

    it('should accept empty string sessionId', async () => {
      ctx.query = {sessionId: ''}

      await expect(StreamController.stream(ctx)).rejects.toThrow('sessionId is required')
    })

    it('should configure socket timeouts', async () => {
      ctx.query = {sessionId: 'test-session-1'}

      await StreamController.stream(ctx)

      expect(ctx.request.socket.setTimeout).toHaveBeenCalledWith(0)
      expect(ctx.req.socket.setNoDelay).toHaveBeenCalledWith(true)
      expect(ctx.req.socket.setKeepAlive).toHaveBeenCalledWith(true)
    })

    it('should set correct SSE headers', async () => {
      ctx.query = {sessionId: 'test-session-1'}

      await StreamController.stream(ctx)

      expect(ctx.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        }),
      )
    })

    it('should set X-Accel-Buffering header for nginx compatibility', async () => {
      ctx.query = {sessionId: 'test-session-1'}

      await StreamController.stream(ctx)

      expect(ctx.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'X-Accel-Buffering': 'no',
        }),
      )
    })

    it('should register close event handler', async () => {
      ctx.query = {sessionId: 'test-session-1'}

      await StreamController.stream(ctx)

      expect(ctx.req.on).toHaveBeenCalledWith('close', expect.any(Function))
    })

    it('should register error event handler', async () => {
      ctx.query = {sessionId: 'test-session-1'}

      await StreamController.stream(ctx)

      expect(ctx.req.on).toHaveBeenCalledWith('error', expect.any(Function))
    })

    it('should close session on client disconnect', async () => {
      ctx.query = {sessionId: 'test-session-1'}
      let closeHandler

      ctx.req.on.mockImplementation((event, handler) => {
        if (event === 'close') {
          closeHandler = handler
        }
      })

      await StreamController.stream(ctx)

      expect(closeHandler).toBeDefined()

      closeHandler()

      expect(StreamBridge.closeSession).toHaveBeenCalledWith('test-session-1')
    })

    it('should close session on client error', async () => {
      ctx.query = {sessionId: 'test-session-1'}
      let errorHandler

      ctx.req.on.mockImplementation((event, handler) => {
        if (event === 'error') {
          errorHandler = handler
        }
      })

      await StreamController.stream(ctx)

      expect(errorHandler).toBeDefined()

      errorHandler(new Error('Client error'))

      expect(StreamBridge.closeSession).toHaveBeenCalledWith('test-session-1')
    })

    it('should handle rapid reconnections with same sessionId', async () => {
      ctx.query = {sessionId: 'rapid-session'}

      await StreamController.stream(ctx)
      await StreamController.stream(ctx)
      await StreamController.stream(ctx)

      expect(StreamBridge.createSession).toHaveBeenCalledTimes(3)
    })

    it('should support multiple concurrent sessions', async () => {
      const ctx1 = {...ctx, query: {sessionId: 'session-1'}}
      const ctx2 = {...ctx, query: {sessionId: 'session-2'}}
      const ctx3 = {...ctx, query: {sessionId: 'session-3'}}

      await StreamController.stream(ctx1)
      await StreamController.stream(ctx2)
      await StreamController.stream(ctx3)

      expect(StreamBridge.sessions.size).toBe(3)
    })

    it('should return readable stream that can receive events', async () => {
      ctx.query = {sessionId: 'test-session'}

      await StreamController.stream(ctx)

      expect(ctx.body).toBeDefined()
      expect(ctx.body.readable).toBe(true)
      expect(ctx.body.writable).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('should handle session ID with special characters', async () => {
      const specialId = 'session-123_abc@domain.com'
      ctx.query = {sessionId: specialId}

      await StreamController.stream(ctx)

      expect(StreamBridge.createSession).toHaveBeenCalledWith(specialId)
    })

    it('should handle very long session IDs', async () => {
      const longId = 'x'.repeat(1000)
      ctx.query = {sessionId: longId}

      await StreamController.stream(ctx)

      expect(StreamBridge.createSession).toHaveBeenCalledWith(longId)
    })

    it('should handle unicode session IDs', async () => {
      const unicodeId = '会话-🔥-test'
      ctx.query = {sessionId: unicodeId}

      await StreamController.stream(ctx)

      expect(StreamBridge.createSession).toHaveBeenCalledWith(unicodeId)
    })

    it('should not throw if socket methods are undefined', async () => {
      ctx.query = {sessionId: 'test'}
      ctx.request.socket = {}
      ctx.req.socket = {}

      await expect(StreamController.stream(ctx)).rejects.toThrow()
    })

    it('should handle missing req.on gracefully', async () => {
      ctx.query = {sessionId: 'test'}
      delete ctx.req.on

      await expect(StreamController.stream(ctx)).rejects.toThrow()
    })
  })
})
