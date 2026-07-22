import {ArgvParser} from '../ArgvParser'

describe('ArgvParser', () => {
  let parser

  beforeEach(() => {
    parser = new ArgvParser()
  })

  describe('validation', () => {
    it('rejects empty argv', () => {
      const result = parser.parse([])
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('Missing required arguments')
    })

    it('rejects argv with only server path', () => {
      const result = parser.parse(['./server.js'])
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('Missing required arguments')
    })

    it('accepts argv with server path and tool name', () => {
      const result = parser.parse(['./server.js', 'tool_name'])
      expect(result.isValid).toBe(true)
    })
  })

  describe('positional extraction', () => {
    it('extracts server path as first positional', () => {
      const result = parser.parse(['./outliner/server.js', 'generate_outline'])
      expect(result.serverPath).toBe('./outliner/server.js')
    })

    it('extracts tool name as second positional', () => {
      const result = parser.parse(['./outliner/server.js', 'generate_outline'])
      expect(result.toolName).toBe('generate_outline')
    })

    it('handles absolute server paths', () => {
      const result = parser.parse(['/home/user/server.js', 'tool'])
      expect(result.serverPath).toBe('/home/user/server.js')
    })
  })

  describe('tool arguments delegation', () => {
    it('delegates flag parsing to ToolArgsParser', () => {
      const result = parser.parse(['./server.js', 'tool', '--query=test', '--citations'])

      expect(result.toolArguments).toEqual({
        query: 'test',
        citations: true,
      })
    })

    it('passes empty object when no tool arguments', () => {
      const result = parser.parse(['./server.js', 'tool'])
      expect(result.toolArguments).toEqual({})
    })

    it('handles complex tool arguments', () => {
      const result = parser.parse([
        './server.js',
        'scrape_web_pages',
        '--urls=["http://a.com","http://b.com"]',
        '--maxSize=10mb',
      ])

      expect(result.toolArguments).toEqual({
        urls: ['http://a.com', 'http://b.com'],
        maxSize: '10mb',
      })
    })
  })

  describe('dependency injection', () => {
    it('accepts custom ToolArgsParser instance', () => {
      const mockToolArgsParser = {
        parse: jest.fn().mockReturnValue({custom: 'value'}),
      }

      const customParser = new ArgvParser(mockToolArgsParser)
      const result = customParser.parse(['./server.js', 'tool', '--flag'])

      expect(mockToolArgsParser.parse).toHaveBeenCalledWith(['--flag'])
      expect(result.toolArguments).toEqual({custom: 'value'})
    })
  })

  describe('special path formats', () => {
    it('handles relative paths with dots', () => {
      const result = parser.parse(['../../server.js', 'tool'])
      expect(result.serverPath).toBe('../../server.js')
    })

    it('handles paths with spaces when quoted in shell', () => {
      const result = parser.parse(['/path with spaces/server.js', 'tool'])
      expect(result.serverPath).toBe('/path with spaces/server.js')
    })

    it('handles Windows-style paths', () => {
      const result = parser.parse(['C:\\path\\to\\server.js', 'tool'])
      expect(result.serverPath).toBe('C:\\path\\to\\server.js')
    })

    it('handles tool names with underscores', () => {
      const result = parser.parse(['./server.js', 'scrape_web_pages'])
      expect(result.toolName).toBe('scrape_web_pages')
    })

    it('handles tool names with hyphens', () => {
      const result = parser.parse(['./server.js', 'list-all-tools'])
      expect(result.toolName).toBe('list-all-tools')
    })
  })

  describe('whitespace handling', () => {
    it('handles server path with trailing slash', () => {
      const result = parser.parse(['./path/to/server.js/', 'tool'])
      expect(result.serverPath).toBe('./path/to/server.js/')
    })

    it('does not trim server path', () => {
      const result = parser.parse([' ./server.js ', 'tool'])
      expect(result.serverPath).toBe(' ./server.js ')
    })

    it('does not trim tool name', () => {
      const result = parser.parse(['./server.js', ' tool '])
      expect(result.toolName).toBe(' tool ')
    })
  })

  describe('error message clarity', () => {
    it('provides clear error for missing both arguments', () => {
      const result = parser.parse([])
      expect(result.error).toContain('server-path')
      expect(result.error).toContain('tool-name')
    })

    it('provides clear error for missing tool name', () => {
      const result = parser.parse(['./server.js'])
      expect(result.error).toContain('server-path')
      expect(result.error).toContain('tool-name')
    })
  })

  describe('timeout integration', () => {
    it('returns null timeoutMs when no timeout provided', () => {
      const result = parser.parse(['./server.js', 'tool', '--query=test'])

      expect(result.timeoutMs).toBeNull()
    })

    it('extracts timeout from argv and excludes from toolArguments', () => {
      const result = parser.parse(['./server.js', 'tool', '--timeout=30000', '--query=test'])

      expect(result.isValid).toBe(true)
      expect(result.timeoutMs).toBe(30000)
      expect(result.toolArguments).toEqual({query: 'test'})
    })

    it('propagates timeout validation errors to parser result', () => {
      const result = parser.parse(['./server.js', 'tool', '--timeout=invalid'])

      expect(result.isValid).toBe(false)
      expect(result.error).toContain('positive integer')
    })
  })

  describe('timeout dependency injection', () => {
    it('accepts custom TimeoutExtractor instance', () => {
      const mockTimeoutExtractor = {
        extract: jest.fn().mockReturnValue({
          hasTimeout: true,
          timeoutMs: 99999,
          remainingArgs: ['--query=test'],
          error: null,
        }),
      }

      const customParser = new ArgvParser(undefined, mockTimeoutExtractor)
      const result = customParser.parse(['./server.js', 'tool', '--timeout=5000', '--query=test'])

      expect(mockTimeoutExtractor.extract).toHaveBeenCalledWith(['--timeout=5000', '--query=test'])
      expect(result.timeoutMs).toBe(99999)
    })

    it('propagates timeout extraction errors', () => {
      const mockTimeoutExtractor = {
        extract: jest.fn().mockReturnValue({
          hasTimeout: true,
          timeoutMs: null,
          remainingArgs: ['--timeout=bad'],
          error: 'mock timeout error',
        }),
      }

      const customParser = new ArgvParser(undefined, mockTimeoutExtractor)
      const result = customParser.parse(['./server.js', 'tool', '--timeout=bad'])

      expect(result.isValid).toBe(false)
      expect(result.error).toBe('mock timeout error')
    })
  })
})
