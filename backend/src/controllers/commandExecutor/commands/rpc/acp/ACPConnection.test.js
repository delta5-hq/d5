import {ACPConnection} from './ACPConnection'

describe('ACPConnection', () => {
  describe('constructor', () => {
    it('stores configuration', () => {
      const connection = new ACPConnection({
        command: 'test',
        args: ['--acp'],
        env: {TEST: 'value'},
        timeoutMs: 5000,
        cwd: '/test',
      })

      expect(connection.command).toBe('test')
      expect(connection.args).toEqual(['--acp'])
      expect(connection.env).toEqual({TEST: 'value'})
      expect(connection.timeoutMs).toBe(5000)
      expect(connection.cwd).toBe('/test')
    })

    it('uses defaults for optional parameters', () => {
      const connection = new ACPConnection({command: 'test'})

      expect(connection.args).toEqual([])
      expect(connection.env).toEqual({})
      expect(connection.timeoutMs).toBe(300_000)
      expect(connection.cwd).toBe(process.cwd())
    })
  })

  describe('getSessionId', () => {
    it('returns null before session creation', () => {
      const connection = new ACPConnection({command: 'test'})

      expect(connection.getSessionId()).toBeNull()
    })
  })
})
