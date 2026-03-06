import StreamableProgressReporter from './StreamableProgressReporter'
import StreamBridge from './StreamBridge'
import {EVENT_TYPE} from './StreamEvent'

jest.mock('./StreamBridge', () => ({
  emit: jest.fn(),
}))

describe('StreamableProgressReporter', () => {
  let reporters = []

  beforeEach(() => {
    jest.clearAllMocks()
    reporters = []
  })

  afterEach(() => {
    reporters.forEach(r => r.dispose())
    reporters = []
  })

  describe('constructor', () => {
    it('should accept streamSessionId directly', () => {
      const reporter = new StreamableProgressReporter({title: 'test'}, null, 'session-1')
      reporters.push(reporter)

      expect(reporter.streamSessionId).toBe('session-1')
    })

    it('should inherit streamSessionId from parent', () => {
      const parent = new StreamableProgressReporter({title: 'parent'}, null, 'session-1')
      const child = new StreamableProgressReporter({title: 'child'}, parent)
      reporters.push(parent, child)

      expect(child.streamSessionId).toBe('session-1')
    })

    it('should work without streamSessionId', () => {
      const reporter = new StreamableProgressReporter({title: 'test'}, null)
      reporters.push(reporter)

      expect(reporter.streamSessionId).toBeUndefined()
    })

    it('should prefer explicit streamSessionId over parent', () => {
      const parent = new StreamableProgressReporter({title: 'parent'}, null, 'parent-session')
      const child = new StreamableProgressReporter({title: 'child'}, parent, 'child-session')
      reporters.push(parent, child)

      expect(child.streamSessionId).toBe('child-session')
    })

    it('should inherit all ProgressReporter properties', () => {
      const reporter = new StreamableProgressReporter({title: 'test', log: jest.fn()}, null, 'session-1')
      reporters.push(reporter)

      expect(reporter.title).toBe('test')
      expect(reporter.children).toBeInstanceOf(Map)
      expect(reporter.counts).toBeInstanceOf(Map)
    })
  })

  describe('add', () => {
    it('should emit progress event when streamSessionId exists', async () => {
      const reporter = new StreamableProgressReporter({title: 'test'}, null, 'session-1')
      reporters.push(reporter)

      await reporter.add('test-operation')

      expect(StreamBridge.emit).toHaveBeenCalledWith('session-1', expect.objectContaining({type: EVENT_TYPE.PROGRESS}))
      const call = StreamBridge.emit.mock.calls[0]
      expect(call[1].data.message).toContain('Started: test-operation')
    })

    it('should not emit when no streamSessionId', async () => {
      const reporter = new StreamableProgressReporter({title: 'test'}, null)
      reporters.push(reporter)

      await reporter.add('test-operation')

      expect(StreamBridge.emit).not.toHaveBeenCalled()
    })

    it('should still call parent add method', async () => {
      const reporter = new StreamableProgressReporter({title: 'test'}, null, 'session-1')
      reporters.push(reporter)

      const result = await reporter.add('operation')

      expect(result).toBe('operation')
      expect(reporter.counts.get('operation')).toBe(1)
    })

    it('should handle multiple operations', async () => {
      const reporter = new StreamableProgressReporter({title: 'test'}, null, 'session-1')
      reporters.push(reporter)

      await reporter.add('op1')
      await reporter.add('op2')
      await reporter.add('op3')

      expect(StreamBridge.emit).toHaveBeenCalledTimes(3)
    })

    it('should track operation counts correctly', async () => {
      const reporter = new StreamableProgressReporter({title: 'test'}, null, 'session-1')
      reporters.push(reporter)

      await reporter.add('operation')
      await reporter.add('operation')

      expect(reporter.counts.get('operation')).toBe(2)
    })
  })

  describe('remove', () => {
    it('should emit progress event when streamSessionId exists', () => {
      const reporter = new StreamableProgressReporter({title: 'test'}, null, 'session-1')
      reporters.push(reporter)

      reporter.remove('test-operation')

      expect(StreamBridge.emit).toHaveBeenCalledWith('session-1', expect.objectContaining({type: EVENT_TYPE.PROGRESS}))
      const call = StreamBridge.emit.mock.calls[0]
      expect(call[1].data.message).toContain('Completed: test-operation')
    })

    it('should not emit when no streamSessionId', () => {
      const reporter = new StreamableProgressReporter({title: 'test'}, null)
      reporters.push(reporter)

      reporter.remove('test-operation')

      expect(StreamBridge.emit).not.toHaveBeenCalled()
    })

    it('should still call parent remove method', async () => {
      const reporter = new StreamableProgressReporter({title: 'test'}, null, 'session-1')
      reporters.push(reporter)

      await reporter.add('operation')
      reporter.remove('operation')

      expect(reporter.counts.has('operation')).toBe(false)
    })

    it('should handle multiple removes', async () => {
      const reporter = new StreamableProgressReporter({title: 'test'}, null, 'session-1')
      reporters.push(reporter)

      await reporter.add('op')
      await reporter.add('op')
      reporter.remove('op')
      reporter.remove('op')

      expect(StreamBridge.emit).toHaveBeenCalledTimes(4)
      expect(reporter.counts.has('op')).toBe(false)
    })
  })

  describe('emitUpdate', () => {
    it('should emit update event with data', () => {
      const reporter = new StreamableProgressReporter({title: 'test'}, null, 'session-1')
      reporters.push(reporter)
      const update = {status: 'running', progress: 50}

      reporter.emitUpdate(update)

      expect(StreamBridge.emit).toHaveBeenCalledWith(
        'session-1',
        expect.objectContaining({
          type: EVENT_TYPE.UPDATE,
          data: update,
        }),
      )
    })

    it('should not emit when no streamSessionId', () => {
      const reporter = new StreamableProgressReporter({title: 'test'}, null)
      reporters.push(reporter)

      reporter.emitUpdate({status: 'running'})

      expect(StreamBridge.emit).not.toHaveBeenCalled()
    })

    it('should handle complex update objects', () => {
      const reporter = new StreamableProgressReporter({title: 'test'}, null, 'session-1')
      reporters.push(reporter)
      const complexUpdate = {
        nested: {
          data: {
            array: [1, 2, 3],
            object: {key: 'value'},
          },
        },
      }

      reporter.emitUpdate(complexUpdate)

      const call = StreamBridge.emit.mock.calls[0]
      expect(call[1].data).toEqual(complexUpdate)
    })

    it('should handle multiple consecutive updates', () => {
      const reporter = new StreamableProgressReporter({title: 'test'}, null, 'session-1')
      reporters.push(reporter)

      reporter.emitUpdate({stage: 1})
      reporter.emitUpdate({stage: 2})
      reporter.emitUpdate({stage: 3})

      expect(StreamBridge.emit).toHaveBeenCalledTimes(3)
    })

    it('should handle null and undefined updates', () => {
      const reporter = new StreamableProgressReporter({title: 'test'}, null, 'session-1')
      reporters.push(reporter)

      reporter.emitUpdate(null)
      reporter.emitUpdate(undefined)

      expect(StreamBridge.emit).toHaveBeenCalledTimes(2)
    })
  })

  describe('emitError', () => {
    it('should emit error event with error details', () => {
      const reporter = new StreamableProgressReporter({title: 'test'}, null, 'session-1')
      reporters.push(reporter)
      const error = new Error('test error')

      reporter.emitError(error)

      expect(StreamBridge.emit).toHaveBeenCalledWith('session-1', expect.objectContaining({type: EVENT_TYPE.ERROR}))
      const call = StreamBridge.emit.mock.calls[0]
      expect(call[1].data.message).toBe('test error')
      expect(call[1].data.stack).toBeDefined()
    })

    it('should not emit when no streamSessionId', () => {
      const reporter = new StreamableProgressReporter({title: 'test'}, null)
      reporters.push(reporter)

      reporter.emitError(new Error('test'))

      expect(StreamBridge.emit).not.toHaveBeenCalled()
    })

    it('should handle errors with custom properties', () => {
      const reporter = new StreamableProgressReporter({title: 'test'}, null, 'session-1')
      reporters.push(reporter)
      const error = new Error('custom error')
      error.code = 'ERR_CUSTOM'

      reporter.emitError(error)

      const call = StreamBridge.emit.mock.calls[0]
      expect(call[1].data.message).toBe('custom error')
    })

    it('should handle multiple errors', () => {
      const reporter = new StreamableProgressReporter({title: 'test'}, null, 'session-1')
      reporters.push(reporter)

      reporter.emitError(new Error('error 1'))
      reporter.emitError(new Error('error 2'))

      expect(StreamBridge.emit).toHaveBeenCalledTimes(2)
    })
  })

  describe('inheritance chain', () => {
    it('should propagate streamSessionId through nested reporters', () => {
      const root = new StreamableProgressReporter({title: 'root'}, null, 'session-1')
      const child1 = new StreamableProgressReporter({title: 'child1'}, root)
      const child2 = new StreamableProgressReporter({title: 'child2'}, child1)
      reporters.push(root, child1, child2)

      expect(child1.streamSessionId).toBe('session-1')
      expect(child2.streamSessionId).toBe('session-1')
    })

    it('should emit events from all levels of hierarchy', async () => {
      const root = new StreamableProgressReporter({title: 'root'}, null, 'session-1')
      const child = new StreamableProgressReporter({title: 'child'}, root)
      reporters.push(root, child)

      await root.add('root-op')
      await child.add('child-op')

      expect(StreamBridge.emit).toHaveBeenCalledTimes(2)
    })

    it('should maintain independent operation counts per reporter', async () => {
      const root = new StreamableProgressReporter({title: 'root'}, null, 'session-1')
      const child = new StreamableProgressReporter({title: 'child'}, root)
      reporters.push(root, child)

      await root.add('op')
      await child.add('op')

      expect(root.counts.get('op')).toBe(1)
      expect(child.counts.get('op')).toBe(1)
    })
  })

  describe('edge cases', () => {
    it('should not emit for empty session ID', () => {
      const reporter = new StreamableProgressReporter({title: 'test'}, null, '')
      reporters.push(reporter)

      reporter.emitUpdate({data: 1})

      expect(StreamBridge.emit).not.toHaveBeenCalled()
    })

    it('should not fail if StreamBridge.emit returns false', () => {
      StreamBridge.emit.mockReturnValue(false)
      const reporter = new StreamableProgressReporter({title: 'test'}, null, 'session-1')
      reporters.push(reporter)

      expect(() => {
        reporter.emitUpdate({data: 1})
      }).not.toThrow()
    })

    it('should handle rapid add/remove cycles', async () => {
      const reporter = new StreamableProgressReporter({title: 'test'}, null, 'session-1')
      reporters.push(reporter)

      for (let i = 0; i < 100; i++) {
        await reporter.add('rapid-op')
        reporter.remove('rapid-op')
      }

      expect(StreamBridge.emit).toHaveBeenCalledTimes(200)
    })

    it('should preserve functionality when used without streaming', async () => {
      const reporter = new StreamableProgressReporter({title: 'test'}, null)
      reporters.push(reporter)

      await reporter.add('op1')
      await reporter.add('op2')
      reporter.remove('op1')

      expect(reporter.counts.get('op1')).toBeUndefined()
      expect(reporter.counts.get('op2')).toBe(1)
      expect(StreamBridge.emit).not.toHaveBeenCalled()
    })
  })
})
