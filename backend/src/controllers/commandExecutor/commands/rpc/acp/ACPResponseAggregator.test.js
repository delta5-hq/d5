import {ACPResponseAggregator} from './ACPResponseAggregator'

const createTextNotification = (text, sessionId = null) => ({
  sessionId,
  update: {
    sessionUpdate: 'agent_message_chunk',
    content: {type: 'text', text},
  },
})

const createToolCallNotification = (toolCallId, name, title, status = 'pending', sessionId = null) => ({
  sessionId,
  update: {
    sessionUpdate: 'tool_call',
    toolCallId,
    name,
    title,
    status,
  },
})

const createToolCallUpdateNotification = (toolCallId, status, sessionId = null) => ({
  sessionId,
  update: {
    sessionUpdate: 'tool_call_update',
    toolCallId,
    status,
  },
})

describe('ACPResponseAggregator', () => {
  let aggregator

  beforeEach(() => {
    aggregator = new ACPResponseAggregator()
  })

  describe('text aggregation', () => {
    it('aggregates multiple text chunks in order', () => {
      aggregator.processUpdate(createTextNotification('Hello '))
      aggregator.processUpdate(createTextNotification('world'))
      aggregator.processUpdate(createTextNotification('!'))

      expect(aggregator.getText()).toBe('Hello world!')
    })

    it('handles empty text chunks', () => {
      aggregator.processUpdate(createTextNotification(''))
      aggregator.processUpdate(createTextNotification('text'))

      expect(aggregator.getText()).toBe('text')
    })

    it('handles chunks with only whitespace', () => {
      aggregator.processUpdate(createTextNotification('   '))
      aggregator.processUpdate(createTextNotification('\n\n'))

      expect(aggregator.getText()).toBe('   \n\n')
    })

    it('handles chunks with special characters', () => {
      aggregator.processUpdate(createTextNotification('<div>'))
      aggregator.processUpdate(createTextNotification('&amp;'))
      aggregator.processUpdate(createTextNotification('\u0000'))

      expect(aggregator.getText()).toBe('<div>&amp;\u0000')
    })

    it('handles chunks with unicode characters', () => {
      aggregator.processUpdate(createTextNotification('你好'))
      aggregator.processUpdate(createTextNotification(' 🚀'))

      expect(aggregator.getText()).toBe('你好 🚀')
    })

    it('returns empty string when no chunks received', () => {
      expect(aggregator.getText()).toBe('')
    })

    it('handles undefined text property', () => {
      aggregator.processUpdate({
        update: {sessionUpdate: 'agent_message_chunk', content: {type: 'text', text: undefined}},
      })

      expect(aggregator.getText()).toBe('')
    })

    it('handles null text property', () => {
      aggregator.processUpdate({
        update: {sessionUpdate: 'agent_message_chunk', content: {type: 'text', text: null}},
      })

      expect(aggregator.getText()).toBe('')
    })
  })

  describe('tool call tracking', () => {
    it('tracks tool call with all properties', () => {
      aggregator.processUpdate(createToolCallNotification('tool-1', 'read_file', 'Read file.txt', 'pending'))

      const summary = aggregator.getToolCallsSummary()
      expect(summary).toContain('[Tool: Read file.txt] pending')
    })

    it('uses name as title when title is missing', () => {
      aggregator.processUpdate(createToolCallNotification('tool-1', 'read_file', null, 'pending'))

      const summary = aggregator.getToolCallsSummary()
      expect(summary).toContain('[Tool: read_file] pending')
    })

    it('updates tool call status', () => {
      aggregator.processUpdate(createToolCallNotification('tool-1', 'read_file', 'Read file.txt', 'pending'))
      aggregator.processUpdate(createToolCallUpdateNotification('tool-1', 'success'))

      const summary = aggregator.getToolCallsSummary()
      expect(summary).toContain('[Tool: Read file.txt] success')
    })

    it('tracks multiple tool calls independently', () => {
      aggregator.processUpdate(createToolCallNotification('tool-1', 'read_file', 'Read file1', 'pending'))
      aggregator.processUpdate(createToolCallNotification('tool-2', 'write_file', 'Write file2', 'pending'))

      const summary = aggregator.getToolCallsSummary()
      expect(summary).toContain('[Tool: Read file1] pending')
      expect(summary).toContain('[Tool: Write file2] pending')
    })

    it('ignores tool_call_update for non-existent tool call', () => {
      aggregator.processUpdate(createToolCallUpdateNotification('nonexistent', 'success'))

      expect(aggregator.getToolCallsSummary()).toBe('')
    })

    it('preserves earlier status when update status is undefined', () => {
      aggregator.processUpdate(createToolCallNotification('tool-1', 'read_file', 'Read file', 'pending'))
      aggregator.processUpdate({update: {sessionUpdate: 'tool_call_update', toolCallId: 'tool-1', status: undefined}})

      const summary = aggregator.getToolCallsSummary()
      expect(summary).toContain('[Tool: Read file] pending')
    })

    it('handles multiple updates to same tool call', () => {
      aggregator.processUpdate(createToolCallNotification('tool-1', 'read_file', 'Read file', 'pending'))
      aggregator.processUpdate(createToolCallUpdateNotification('tool-1', 'running'))
      aggregator.processUpdate(createToolCallUpdateNotification('tool-1', 'success'))

      const summary = aggregator.getToolCallsSummary()
      expect(summary).toContain('[Tool: Read file] success')
    })

    it('returns empty string when no tool calls tracked', () => {
      expect(aggregator.getToolCallsSummary()).toBe('')
    })

    it('formats tool call summary with newlines', () => {
      aggregator.processUpdate(createToolCallNotification('tool-1', 'read_file', 'Read file1', 'success'))
      aggregator.processUpdate(createToolCallNotification('tool-2', 'write_file', 'Write file2', 'pending'))

      const summary = aggregator.getToolCallsSummary()
      expect(summary).toBe('\n\n[Tool: Read file1] success\n[Tool: Write file2] pending')
    })
  })

  describe('session ID extraction', () => {
    it('extracts first sessionId found in updates', () => {
      const notifications = [
        createTextNotification('test', 'session-123'),
        createTextNotification('test', 'session-456'),
      ]

      const sessionId = aggregator.extractSessionId(notifications)
      expect(sessionId).toBe('session-123')
      expect(aggregator.getSessionId()).toBe('session-123')
    })

    it('returns null when no sessionId in updates', () => {
      const notifications = [createTextNotification('test'), createTextNotification('test')]

      expect(aggregator.extractSessionId(notifications)).toBeNull()
    })

    it('returns null for empty updates array', () => {
      expect(aggregator.extractSessionId([])).toBeNull()
    })

    it('stores extracted sessionId internally', () => {
      aggregator.extractSessionId([createTextNotification('test', 'session-789')])

      expect(aggregator.getSessionId()).toBe('session-789')
    })

    it('handles updates with null sessionId', () => {
      const notifications = [{sessionId: null}, createTextNotification('test', 'session-123')]

      expect(aggregator.extractSessionId(notifications)).toBe('session-123')
    })

    it('handles updates with empty string sessionId', () => {
      const notifications = [createTextNotification('test', ''), createTextNotification('test', 'session-123')]

      expect(aggregator.extractSessionId(notifications)).toBe('session-123')
    })

    it('handles special characters in sessionId', () => {
      const sessionId = 'session-with-!@#$%^&*()'
      aggregator.extractSessionId([createTextNotification('test', sessionId)])

      expect(aggregator.getSessionId()).toBe(sessionId)
    })
  })

  describe('full response composition', () => {
    it('combines text and tool summary', () => {
      aggregator.processUpdate(createTextNotification('Response: '))
      aggregator.processUpdate(createToolCallNotification('tool-1', 'read_file', 'Read file', 'success'))

      expect(aggregator.getFullResponse()).toBe('Response: \n\n[Tool: Read file] success')
    })

    it('returns only text when no tool calls', () => {
      aggregator.processUpdate(createTextNotification('Hello world'))

      expect(aggregator.getFullResponse()).toBe('Hello world')
    })

    it('returns only tool summary when no text', () => {
      aggregator.processUpdate(createToolCallNotification('tool-1', 'read_file', 'Read file', 'success'))

      expect(aggregator.getFullResponse()).toBe('\n\n[Tool: Read file] success')
    })

    it('returns empty string when no updates processed', () => {
      expect(aggregator.getFullResponse()).toBe('')
    })
  })

  describe('update processing edge cases', () => {
    it('handles updates without update property', () => {
      aggregator.processUpdate({sessionId: 'test'})

      expect(aggregator.getText()).toBe('')
    })

    it('handles null update', () => {
      aggregator.processUpdate(null)

      expect(aggregator.getText()).toBe('')
    })

    it('handles undefined update', () => {
      aggregator.processUpdate(undefined)

      expect(aggregator.getText()).toBe('')
    })

    it('handles update with null update property', () => {
      aggregator.processUpdate({update: null})

      expect(aggregator.getText()).toBe('')
    })

    it('handles unknown update types', () => {
      aggregator.processUpdate({update: {sessionUpdate: 'unknown_type'}})

      expect(aggregator.getText()).toBe('')
      expect(aggregator.getToolCallsSummary()).toBe('')
    })

    it('handles update with missing type', () => {
      aggregator.processUpdate({update: {}})

      expect(aggregator.getText()).toBe('')
    })

    it('processes mixed update types correctly', () => {
      aggregator.processUpdate(createTextNotification('Start '))
      aggregator.processUpdate(createToolCallNotification('tool-1', 'read_file', 'Read', 'pending'))
      aggregator.processUpdate(createTextNotification('Middle '))
      aggregator.processUpdate(createToolCallUpdateNotification('tool-1', 'success'))
      aggregator.processUpdate(createTextNotification('End'))

      expect(aggregator.getText()).toBe('Start Middle End')
      expect(aggregator.getToolCallsSummary()).toContain('[Tool: Read] success')
    })
  })

  describe('state isolation', () => {
    it('maintains independent state per instance', () => {
      const aggregator2 = new ACPResponseAggregator()

      aggregator.processUpdate(createTextNotification('Text 1'))
      aggregator2.processUpdate(createTextNotification('Text 2'))

      expect(aggregator.getText()).toBe('Text 1')
      expect(aggregator2.getText()).toBe('Text 2')
    })

    it('does not share session ID between instances', () => {
      const aggregator2 = new ACPResponseAggregator()

      aggregator.extractSessionId([createTextNotification('test', 'session-1')])
      aggregator2.extractSessionId([createTextNotification('test', 'session-2')])

      expect(aggregator.getSessionId()).toBe('session-1')
      expect(aggregator2.getSessionId()).toBe('session-2')
    })
  })
})
