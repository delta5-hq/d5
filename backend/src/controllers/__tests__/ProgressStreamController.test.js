import {jest} from '@jest/globals'
import ProgressStreamController from '../ProgressStreamController'
import {progressEventEmitter} from '../../services/progress-event-emitter'

describe('ProgressStreamController', () => {
  let mockCtx
  let mockStream

  beforeEach(() => {
    mockStream = {
      write: jest.fn(),
      destroyed: false,
    }

    mockCtx = {
      request: {
        socket: {
          setTimeout: jest.fn(),
          setNoDelay: jest.fn(),
          setKeepAlive: jest.fn(),
        },
      },
      req: {
        socket: {
          setTimeout: jest.fn(),
          setNoDelay: jest.fn(),
          setKeepAlive: jest.fn(),
        },
        on: jest.fn(),
      },
      set: jest.fn(),
      res: mockStream,
    }
  })

  afterEach(() => {
    progressEventEmitter.removeAllListeners('progress')
  })

  describe('connection setup', () => {
    it('should configure socket timeouts and keep-alive', async () => {
      const streamPromise = ProgressStreamController.stream(mockCtx)

      expect(mockCtx.request.socket.setTimeout).toHaveBeenCalledWith(0)
      expect(mockCtx.req.socket.setNoDelay).toHaveBeenCalledWith(true)
      expect(mockCtx.req.socket.setKeepAlive).toHaveBeenCalledWith(true)

      await Promise.race([streamPromise, new Promise(resolve => setTimeout(resolve, 10))])
    })

    it('should set SSE response headers', async () => {
      const streamPromise = ProgressStreamController.stream(mockCtx)

      expect(mockCtx.set).toHaveBeenCalledWith({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      })

      await Promise.race([streamPromise, new Promise(resolve => setTimeout(resolve, 10))])
    })

    it('should set status to 200', async () => {
      const streamPromise = ProgressStreamController.stream(mockCtx)

      expect(mockCtx.status).toBe(200)

      await Promise.race([streamPromise, new Promise(resolve => setTimeout(resolve, 10))])
    })

    it('should send initial connected event', async () => {
      const streamPromise = ProgressStreamController.stream(mockCtx)

      await new Promise(resolve => setTimeout(resolve, 10))

      expect(mockStream.write).toHaveBeenCalled()
      const firstCall = mockStream.write.mock.calls[0][0]
      expect(firstCall).toContain('data: ')
      const data = JSON.parse(firstCall.replace('data: ', '').replace('\n\n', ''))
      expect(data.type).toBe('connected')
      expect(data.timestamp).toBeDefined()

      await Promise.race([streamPromise, new Promise(resolve => setTimeout(resolve, 10))])
    })
  })

  describe('progress event streaming', () => {
    it('should stream progress events to client', async () => {
      const streamPromise = ProgressStreamController.stream(mockCtx)

      await new Promise(resolve => setTimeout(resolve, 10))

      progressEventEmitter.emitProgress('node-123', 'running', {queryType: 'prompt'})

      await new Promise(resolve => setTimeout(resolve, 10))

      expect(mockStream.write.mock.calls.length).toBeGreaterThan(1)
      const progressCall = mockStream.write.mock.calls[1][0]
      expect(progressCall).toContain('data: ')
      const data = JSON.parse(progressCall.replace('data: ', '').replace('\n\n', ''))
      expect(data.type).toBe('progress')
      expect(data.nodeId).toBe('node-123')
      expect(data.state).toBe('running')
      expect(data.queryType).toBe('prompt')

      await Promise.race([streamPromise, new Promise(resolve => setTimeout(resolve, 10))])
    })

    it('should stream multiple progress events in sequence', async () => {
      const streamPromise = ProgressStreamController.stream(mockCtx)

      await new Promise(resolve => setTimeout(resolve, 10))

      progressEventEmitter.emitStart('node-1', {queryType: 'chat'})
      progressEventEmitter.emitRunning('node-1')
      progressEventEmitter.emitComplete('node-1')

      await new Promise(resolve => setTimeout(resolve, 10))

      expect(mockStream.write.mock.calls.length).toBe(4)

      const event1 = JSON.parse(mockStream.write.mock.calls[1][0].replace('data: ', '').replace('\n\n', ''))
      const event2 = JSON.parse(mockStream.write.mock.calls[2][0].replace('data: ', '').replace('\n\n', ''))
      const event3 = JSON.parse(mockStream.write.mock.calls[3][0].replace('data: ', '').replace('\n\n', ''))

      expect(event1.state).toBe('preparing')
      expect(event2.state).toBe('running')
      expect(event3.state).toBe('idle')

      await Promise.race([streamPromise, new Promise(resolve => setTimeout(resolve, 10))])
    })

    it('should not write to destroyed stream', async () => {
      const streamPromise = ProgressStreamController.stream(mockCtx)

      await new Promise(resolve => setTimeout(resolve, 10))

      mockStream.destroyed = true

      progressEventEmitter.emitProgress('node-123', 'running')

      await new Promise(resolve => setTimeout(resolve, 10))

      expect(mockStream.write).toHaveBeenCalledTimes(1)

      await Promise.race([streamPromise, new Promise(resolve => setTimeout(resolve, 10))])
    })
  })

  describe('connection cleanup', () => {
    it('should register close event listener', async () => {
      const streamPromise = ProgressStreamController.stream(mockCtx)

      await new Promise(resolve => setTimeout(resolve, 10))

      expect(mockCtx.req.on).toHaveBeenCalledWith('close', expect.any(Function))

      await Promise.race([streamPromise, new Promise(resolve => setTimeout(resolve, 10))])
    })

    it('should remove progress listener on connection close', async () => {
      const streamPromise = ProgressStreamController.stream(mockCtx)

      await new Promise(resolve => setTimeout(resolve, 10))

      const closeCallback = mockCtx.req.on.mock.calls.find(call => call[0] === 'close')?.[1]
      expect(closeCallback).toBeDefined()

      const listenersBefore = progressEventEmitter.listenerCount('progress')
      closeCallback()
      const listenersAfter = progressEventEmitter.listenerCount('progress')

      expect(listenersAfter).toBe(listenersBefore - 1)

      await Promise.race([streamPromise, new Promise(resolve => setTimeout(resolve, 10))])
    })
  })

  describe('event formatting', () => {
    it('should format events as SSE protocol', async () => {
      const streamPromise = ProgressStreamController.stream(mockCtx)

      await new Promise(resolve => setTimeout(resolve, 10))

      progressEventEmitter.emitProgress('test-node', 'busy')

      await new Promise(resolve => setTimeout(resolve, 10))

      const eventData = mockStream.write.mock.calls[1][0]
      expect(eventData).toMatch(/^data: \{.*\}\n\n$/)

      await Promise.race([streamPromise, new Promise(resolve => setTimeout(resolve, 10))])
    })

    it('should include all event properties in JSON', async () => {
      const streamPromise = ProgressStreamController.stream(mockCtx)

      await new Promise(resolve => setTimeout(resolve, 10))

      progressEventEmitter.emitProgress('node-123', 'running', {
        queryType: 'completion',
        userId: 'user-456',
        custom: 'value',
      })

      await new Promise(resolve => setTimeout(resolve, 10))

      const eventData = mockStream.write.mock.calls[1][0]
      const parsed = JSON.parse(eventData.replace('data: ', '').replace('\n\n', ''))

      expect(parsed.type).toBe('progress')
      expect(parsed.nodeId).toBe('node-123')
      expect(parsed.state).toBe('running')
      expect(parsed.queryType).toBe('completion')
      expect(parsed.userId).toBe('user-456')
      expect(parsed.custom).toBe('value')
      expect(parsed.timestamp).toBeDefined()

      await Promise.race([streamPromise, new Promise(resolve => setTimeout(resolve, 10))])
    })
  })

  describe('concurrent connections', () => {
    it('should support multiple simultaneous connections', async () => {
      const mockCtx2 = {
        ...mockCtx,
        res: {write: jest.fn(), destroyed: false},
      }

      const stream1Promise = ProgressStreamController.stream(mockCtx)
      const stream2Promise = ProgressStreamController.stream(mockCtx2)

      await new Promise(resolve => setTimeout(resolve, 10))

      progressEventEmitter.emitProgress('node-concurrent', 'running')

      await new Promise(resolve => setTimeout(resolve, 10))

      expect(mockStream.write).toHaveBeenCalled()
      expect(mockCtx2.res.write).toHaveBeenCalled()

      await Promise.race([stream1Promise, stream2Promise, new Promise(resolve => setTimeout(resolve, 10))])
    })
  })
})
