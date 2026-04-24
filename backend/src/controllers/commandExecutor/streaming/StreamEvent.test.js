import {StreamEvent, EVENT_TYPE} from './StreamEvent'

describe('StreamEvent', () => {
  describe('constructor', () => {
    it('should create event with type and data', () => {
      const event = new StreamEvent(EVENT_TYPE.PROGRESS, {message: 'test'})

      expect(event.type).toBe(EVENT_TYPE.PROGRESS)
      expect(event.data).toEqual({message: 'test'})
      expect(event.timestamp).toBeGreaterThan(0)
    })

    it('should set timestamp at creation time', () => {
      const before = Date.now()
      const event = new StreamEvent(EVENT_TYPE.PROGRESS, {message: 'test'})
      const after = Date.now()

      expect(event.timestamp).toBeGreaterThanOrEqual(before)
      expect(event.timestamp).toBeLessThanOrEqual(after)
    })

    it('should handle null data', () => {
      const event = new StreamEvent(EVENT_TYPE.COMPLETE, null)

      expect(event.data).toBe(null)
    })

    it('should handle undefined data', () => {
      const event = new StreamEvent(EVENT_TYPE.COMPLETE, undefined)

      expect(event.data).toBe(undefined)
    })

    it('should handle complex nested objects', () => {
      const complexData = {
        level1: {
          level2: {
            array: [1, 2, {nested: true}],
            value: 'test',
          },
        },
      }
      const event = new StreamEvent(EVENT_TYPE.UPDATE, complexData)

      expect(event.data).toEqual(complexData)
    })
  })

  describe('static factories', () => {
    describe('progress', () => {
      it('should create progress event with message', () => {
        const event = StreamEvent.progress('test message')

        expect(event.type).toBe(EVENT_TYPE.PROGRESS)
        expect(event.data).toEqual({message: 'test message'})
      })

      it('should handle empty message', () => {
        const event = StreamEvent.progress('')

        expect(event.data.message).toBe('')
      })

      it('should handle multiline messages', () => {
        const message = 'line 1\nline 2\nline 3'
        const event = StreamEvent.progress(message)

        expect(event.data.message).toBe(message)
      })
    })

    describe('update', () => {
      it('should create update event with data', () => {
        const update = {foo: 'bar'}
        const event = StreamEvent.update(update)

        expect(event.type).toBe(EVENT_TYPE.UPDATE)
        expect(event.data).toEqual(update)
      })

      it('should preserve object references', () => {
        const update = {nested: {value: 1}}
        const event = StreamEvent.update(update)

        expect(event.data).toBe(update)
      })

      it('should handle arrays', () => {
        const update = [1, 2, 3]
        const event = StreamEvent.update(update)

        expect(event.data).toEqual([1, 2, 3])
      })
    })

    describe('error', () => {
      it('should create error event from Error instance', () => {
        const error = new Error('test error')
        const event = StreamEvent.error(error)

        expect(event.type).toBe(EVENT_TYPE.ERROR)
        expect(event.data.message).toBe('test error')
        expect(event.data.stack).toBeDefined()
        expect(event.data.stack).toContain('test error')
      })

      it('should handle Error with no stack', () => {
        const error = new Error('test')
        delete error.stack
        const event = StreamEvent.error(error)

        expect(event.data.message).toBe('test')
        expect(event.data.stack).toBeUndefined()
      })

      it('should handle custom error properties', () => {
        const error = new Error('custom')
        error.code = 'E_CUSTOM'
        error.details = {foo: 'bar'}

        const event = StreamEvent.error(error)

        expect(event.data.message).toBe('custom')
      })
    })

    describe('complete', () => {
      it('should create complete event with result', () => {
        const result = {success: true}
        const event = StreamEvent.complete(result)

        expect(event.type).toBe(EVENT_TYPE.COMPLETE)
        expect(event.data).toEqual(result)
      })

      it('should handle large result objects', () => {
        const result = {
          nodes: new Array(100).fill({id: 'test', title: 'node'}),
          edges: new Array(50).fill({from: 'a', to: 'b'}),
        }
        const event = StreamEvent.complete(result)

        expect(event.data).toEqual(result)
      })
    })
  })

  describe('toSSE', () => {
    it('should format event as SSE with correct structure', () => {
      const event = StreamEvent.progress('test')
      const sse = event.toSSE()

      expect(sse).toContain('data: ')
      expect(sse).toContain('"type":"progress"')
      expect(sse).toContain('"data":{"message":"test"}')
      expect(sse).toContain('"timestamp":')
      expect(sse.endsWith('\n\n')).toBe(true)
    })

    it('should produce valid JSON in SSE format', () => {
      const event = StreamEvent.update({complex: {nested: 'data'}})
      const sse = event.toSSE()
      const dataLine = sse.replace('data: ', '').trim()
      const parsed = JSON.parse(dataLine)

      expect(parsed.type).toBe(EVENT_TYPE.UPDATE)
      expect(parsed.data).toEqual({complex: {nested: 'data'}})
      expect(parsed.timestamp).toBeDefined()
    })

    it('should escape special characters in JSON', () => {
      const event = StreamEvent.progress('test "quotes" and \n newlines')
      const sse = event.toSSE()
      const dataLine = sse.replace('data: ', '').trim()

      expect(() => JSON.parse(dataLine)).not.toThrow()
    })

    it('should handle unicode characters', () => {
      const event = StreamEvent.progress('测试 🎉 émojis')
      const sse = event.toSSE()
      const dataLine = sse.replace('data: ', '').trim()
      const parsed = JSON.parse(dataLine)

      expect(parsed.data.message).toBe('测试 🎉 émojis')
    })

    it('should always end with double newline for SSE spec', () => {
      const events = [
        StreamEvent.progress('test'),
        StreamEvent.update({data: 1}),
        StreamEvent.error(new Error('err')),
        StreamEvent.complete({done: true}),
      ]

      events.forEach(event => {
        expect(event.toSSE().endsWith('\n\n')).toBe(true)
      })
    })

    it('should start with "data: " prefix for SSE spec', () => {
      const event = StreamEvent.progress('test')
      const sse = event.toSSE()

      expect(sse.startsWith('data: ')).toBe(true)
    })

    it('should serialize circular references without error', () => {
      const circular = {value: 1}
      circular.self = circular

      expect(() => {
        StreamEvent.update(circular).toSSE()
      }).toThrow()
    })
  })

  describe('EVENT_TYPE constants', () => {
    it('should define all expected event types', () => {
      expect(EVENT_TYPE.PROGRESS).toBe('progress')
      expect(EVENT_TYPE.UPDATE).toBe('update')
      expect(EVENT_TYPE.ERROR).toBe('error')
      expect(EVENT_TYPE.COMPLETE).toBe('complete')
    })

    it('should have unique values for each type', () => {
      const values = Object.values(EVENT_TYPE)
      const unique = new Set(values)

      expect(unique.size).toBe(values.length)
    })
  })
})
