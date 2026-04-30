import {SessionIdInjector} from './SessionIdInjector'

describe('SessionIdInjector', () => {
  describe('inject with sessionId present', () => {
    it('replaces {{sessionId}} placeholder with actual sessionId', () => {
      const injector = new SessionIdInjector('claude --resume {{sessionId}}', 'abc123')

      expect(injector.inject()).toBe('claude --resume abc123')
    })

    it('replaces multiple {{sessionId}} occurrences', () => {
      const injector = new SessionIdInjector('cmd --session {{sessionId}} --log {{sessionId}}.log', 'test-id')

      expect(injector.inject()).toBe('cmd --session test-id --log test-id.log')
    })

    it('handles sessionId in middle of template', () => {
      const injector = new SessionIdInjector('claude -p "prompt" --resume {{sessionId}} --model opus', 'mid-id')

      expect(injector.inject()).toBe('claude -p "prompt" --resume mid-id --model opus')
    })

    it('preserves template when no {{sessionId}} placeholder exists', () => {
      const injector = new SessionIdInjector('claude -p "test"', 'unused-id')

      expect(injector.inject()).toBe('claude -p "test"')
    })
  })

  describe('inject without sessionId', () => {
    it('removes --resume {{sessionId}} flag when sessionId is null', () => {
      const injector = new SessionIdInjector('claude -p "test" --resume {{sessionId}}', null)

      expect(injector.inject()).toBe('claude -p "test"')
    })

    it('removes --resume {{sessionId}} flag when sessionId is undefined', () => {
      const injector = new SessionIdInjector('claude -p "test" --resume {{sessionId}}', undefined)

      expect(injector.inject()).toBe('claude -p "test"')
    })

    it('removes --resume {{sessionId}} flag when sessionId is empty string', () => {
      const injector = new SessionIdInjector('claude -p "test" --resume {{sessionId}}', '')

      expect(injector.inject()).toBe('claude -p "test"')
    })

    it('removes -r {{sessionId}} short flag', () => {
      const injector = new SessionIdInjector('claude -p "test" -r {{sessionId}}', null)

      expect(injector.inject()).toBe('claude -p "test"')
    })

    it('removes standalone {{sessionId}} placeholder', () => {
      const injector = new SessionIdInjector('cmd --id {{sessionId}}', null)

      expect(injector.inject()).toBe('cmd --id ')
    })

    it('removes multiple --resume {{sessionId}} occurrences', () => {
      const injector = new SessionIdInjector('cmd --resume {{sessionId}} --other --resume {{sessionId}}', null)

      expect(injector.inject()).toBe('cmd --other')
    })

    it('handles template with only --resume {{sessionId}}', () => {
      const injector = new SessionIdInjector('--resume {{sessionId}}', null)

      expect(injector.inject()).toBe('')
    })
  })

  describe('edge cases', () => {
    it('handles null template', () => {
      const injector = new SessionIdInjector(null, 'id123')

      expect(injector.inject()).toBe('')
    })

    it('handles undefined template', () => {
      const injector = new SessionIdInjector(undefined, 'id123')

      expect(injector.inject()).toBe('')
    })

    it('handles empty string template', () => {
      const injector = new SessionIdInjector('', 'id123')

      expect(injector.inject()).toBe('')
    })

    it('preserves spacing when removing --resume flag', () => {
      const injector = new SessionIdInjector('claude -p "test"  --resume {{sessionId}}  --model opus', null)

      expect(injector.inject()).toBe('claude -p "test"  --model opus')
    })

    it('handles sessionId with special characters', () => {
      const injector = new SessionIdInjector('cmd --resume {{sessionId}}', 'id-123_abc.xyz')

      expect(injector.inject()).toBe('cmd --resume id-123_abc.xyz')
    })

    it('does not remove non-matching patterns', () => {
      const injector = new SessionIdInjector('cmd --resume {{session}} --other {{id}}', null)

      expect(injector.inject()).toBe('cmd --resume {{session}} --other {{id}}')
    })

    it('handles mixed presence and absence of sessionId in same template', () => {
      const injector = new SessionIdInjector('claude -p "test" --resume {{sessionId}} --config {{configPath}}', null)

      expect(injector.inject()).toBe('claude -p "test" --config {{configPath}}')
    })
  })

  describe('real-world templates', () => {
    it('handles Claude CLI resume template', () => {
      const injector = new SessionIdInjector(
        'claude -p "{{prompt}}" --output-format json --resume {{sessionId}}',
        'session-abc-123',
      )

      expect(injector.inject()).toBe('claude -p "{{prompt}}" --output-format json --resume session-abc-123')
    })

    it('handles Claude CLI template without prior session', () => {
      const injector = new SessionIdInjector('claude -p "{{prompt}}" --output-format json --resume {{sessionId}}', null)

      expect(injector.inject()).toBe('claude -p "{{prompt}}" --output-format json')
    })

    it('handles custom CLI with session logging', () => {
      const injector = new SessionIdInjector(
        'agent run --prompt "{{prompt}}" --session {{sessionId}} --log /tmp/{{sessionId}}.log',
        'my-session',
      )

      expect(injector.inject()).toBe('agent run --prompt "{{prompt}}" --session my-session --log /tmp/my-session.log')
    })

    it('handles optional session parameter', () => {
      const injector = new SessionIdInjector('api-call --data "{{prompt}}" --session-id {{sessionId}}', '')

      expect(injector.inject()).toBe('api-call --data "{{prompt}}" --session-id ')
    })
  })

  describe('HTTP templates', () => {
    it('injects into JSON body template', () => {
      const injector = new SessionIdInjector('{"query":"{{prompt}}","session":"{{sessionId}}"}', 'abc-123')

      expect(injector.inject()).toBe('{"query":"{{prompt}}","session":"abc-123"}')
    })

    it('removes from JSON body when no session', () => {
      const injector = new SessionIdInjector('{"query":"{{prompt}}","session":"{{sessionId}}"}', null)

      expect(injector.inject()).toBe('{"query":"{{prompt}}","session":""}')
    })

    it('injects into URL query parameters', () => {
      const injector = new SessionIdInjector('https://api.example.com/chat?session={{sessionId}}', 'url-session')

      expect(injector.inject()).toBe('https://api.example.com/chat?session=url-session')
    })

    it('removes from URL when no session', () => {
      const injector = new SessionIdInjector('https://api.example.com/chat?session={{sessionId}}', null)

      expect(injector.inject()).toBe('https://api.example.com/chat?session=')
    })

    it('injects into header values', () => {
      const injector = new SessionIdInjector('Bearer {{sessionId}}', 'token-456')

      expect(injector.inject()).toBe('Bearer token-456')
    })

    it('removes from header when no session', () => {
      const injector = new SessionIdInjector('Bearer {{sessionId}}', '')

      expect(injector.inject()).toBe('Bearer ')
    })

    it('handles multiple occurrences in HTTP context', () => {
      const injector = new SessionIdInjector('{"session":"{{sessionId}}","log_session":"{{sessionId}}"}', 'multi-789')

      expect(injector.inject()).toBe('{"session":"multi-789","log_session":"multi-789"}')
    })
  })
})
