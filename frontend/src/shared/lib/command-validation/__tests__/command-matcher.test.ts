import { describe, it, expect } from 'vitest'
import { createCommandMatcher, matchesAnyCommand, matchesAnyCommandWithOrder, extractCommand } from '../command-matcher'
import type { DynamicAlias } from '../../command-querytype-mapper'

describe('command-matcher', () => {
  describe('createCommandMatcher', () => {
    it('creates standard matcher without order prefix', () => {
      const matcher = createCommandMatcher([{ alias: '/chatgpt' }, { alias: '/web' }])
      expect(matcher.standard.test('/chatgpt hello')).toBe(true)
      expect(matcher.standard.test('#1 /chatgpt hello')).toBe(false)
    })

    it('creates withOrder matcher that accepts order prefix', () => {
      const matcher = createCommandMatcher([{ alias: '/chatgpt' }, { alias: '/web' }])
      expect(matcher.withOrder.test('/chatgpt hello')).toBe(true)
      expect(matcher.withOrder.test('#1 /chatgpt hello')).toBe(true)
      expect(matcher.withOrder.test('#42 /web query')).toBe(true)
    })

    it('requires whitespace or EOL after command', () => {
      const matcher = createCommandMatcher([{ alias: '/chatgpt' }])
      expect(matcher.standard.test('/chatgpt')).toBe(true)
      expect(matcher.standard.test('/chatgpt hello')).toBe(true)
      expect(matcher.standard.test('/chatgpt123')).toBe(false)
    })

    it('matches at start of string only', () => {
      const matcher = createCommandMatcher([{ alias: '/chatgpt' }])
      expect(matcher.standard.test('/chatgpt hello')).toBe(true)
      expect(matcher.standard.test('text /chatgpt hello')).toBe(false)
    })

    it('handles negative step numbers', () => {
      const matcher = createCommandMatcher([{ alias: '/chatgpt' }])
      expect(matcher.withOrder.test('#-1 /chatgpt hello')).toBe(true)
    })
  })

  describe('matchesAnyCommand', () => {
    it('matches valid commands without order', () => {
      expect(matchesAnyCommand('/chatgpt hello')).toBe(true)
      expect(matchesAnyCommand('/instruct prompt')).toBe(true)
      expect(matchesAnyCommand('/steps task')).toBe(true)
    })

    it('rejects commands with order prefix', () => {
      expect(matchesAnyCommand('#1 /chatgpt hello')).toBe(false)
    })

    it('rejects invalid commands', () => {
      expect(matchesAnyCommand('/unknown')).toBe(false)
      expect(matchesAnyCommand('no command')).toBe(false)
      expect(matchesAnyCommand('')).toBe(false)
      expect(matchesAnyCommand(undefined)).toBe(false)
    })

    it('handles leading whitespace', () => {
      expect(matchesAnyCommand('  /chatgpt hello')).toBe(true)
    })
  })

  describe('matchesAnyCommandWithOrder', () => {
    it('matches commands with order prefix', () => {
      expect(matchesAnyCommandWithOrder('#1 /chatgpt hello')).toBe(true)
      expect(matchesAnyCommandWithOrder('#42 /steps task')).toBe(true)
    })

    it('matches commands without order prefix', () => {
      expect(matchesAnyCommandWithOrder('/chatgpt hello')).toBe(true)
      expect(matchesAnyCommandWithOrder('/steps task')).toBe(true)
    })

    it('rejects invalid commands', () => {
      expect(matchesAnyCommandWithOrder('#1 /unknown')).toBe(false)
      expect(matchesAnyCommandWithOrder('no command')).toBe(false)
    })
  })

  describe('extractCommand', () => {
    it('extracts command from text without order', () => {
      expect(extractCommand('/chatgpt hello')).toBe('/chatgpt')
      expect(extractCommand('/steps task')).toBe('/steps')
    })

    it('extracts command from text with order prefix', () => {
      expect(extractCommand('#1 /chatgpt hello')).toBe('/chatgpt')
      expect(extractCommand('#42 /steps task')).toBe('/steps')
    })

    it('returns null for invalid input', () => {
      expect(extractCommand('/unknown')).toBe(null)
      expect(extractCommand('no command')).toBe(null)
      expect(extractCommand('')).toBe(null)
      expect(extractCommand(undefined)).toBe(null)
    })

    it('handles leading whitespace', () => {
      expect(extractCommand('  /chatgpt hello')).toBe('/chatgpt')
      expect(extractCommand('  #1 /chatgpt hello')).toBe('/chatgpt')
    })
  })

  describe('dynamic alias support', () => {
    describe('createCommandMatcher with aliases', () => {
      it('creates matcher that recognizes dynamic alias', () => {
        const aliases: DynamicAlias[] = [{ alias: '/code', queryType: 'mcp:code' }]
        const matcher = createCommandMatcher(aliases)
        expect(matcher.standard.test('/code task')).toBe(true)
        expect(matcher.withOrder.test('#1 /code task')).toBe(true)
      })

      it('creates matcher for multiple dynamic aliases', () => {
        const aliases: DynamicAlias[] = [
          { alias: '/code', queryType: 'mcp:code' },
          { alias: '/qa', queryType: 'mcp:qa' },
        ]
        const matcher = createCommandMatcher(aliases)
        expect(matcher.standard.test('/code task')).toBe(true)
        expect(matcher.standard.test('/qa verify')).toBe(true)
      })

      it('creates matcher that recognizes both static and dynamic', () => {
        const aliases: DynamicAlias[] = [{ alias: '/custom', queryType: 'custom' }]
        const matcher = createCommandMatcher(aliases)
        expect(matcher.standard.test('/web search')).toBe(true)
        expect(matcher.standard.test('/custom query')).toBe(true)
      })
    })

    describe('matchesAnyCommand with aliases', () => {
      it('matches dynamic alias without order', () => {
        const aliases: DynamicAlias[] = [{ alias: '/test', queryType: 'test' }]
        expect(matchesAnyCommand('/test query', aliases)).toBe(true)
      })

      it('rejects order prefix in standard mode', () => {
        const aliases: DynamicAlias[] = [{ alias: '/test', queryType: 'test' }]
        expect(matchesAnyCommand('#1 /test query', aliases)).toBe(false)
      })

      it('matches multiple dynamic aliases', () => {
        const aliases: DynamicAlias[] = [
          { alias: '/a', queryType: 'alias_a' },
          { alias: '/b', queryType: 'alias_b' },
        ]
        expect(matchesAnyCommand('/a', aliases)).toBe(true)
        expect(matchesAnyCommand('/b', aliases)).toBe(true)
      })

      it('rejects unknown aliases', () => {
        const aliases: DynamicAlias[] = [{ alias: '/known', queryType: 'known' }]
        expect(matchesAnyCommand('/unknown', aliases)).toBe(false)
      })
    })

    describe('matchesAnyCommandWithOrder with aliases', () => {
      it('matches dynamic alias with order', () => {
        const aliases: DynamicAlias[] = [{ alias: '/code', queryType: 'mcp:code' }]
        expect(matchesAnyCommandWithOrder('#1 /code task', aliases)).toBe(true)
      })

      it('matches dynamic alias without order', () => {
        const aliases: DynamicAlias[] = [{ alias: '/code', queryType: 'mcp:code' }]
        expect(matchesAnyCommandWithOrder('/code task', aliases)).toBe(true)
      })

      it('matches multiple dynamic aliases with mixed orders', () => {
        const aliases: DynamicAlias[] = [
          { alias: '/a', queryType: 'alias_a' },
          { alias: '/b', queryType: 'alias_b' },
        ]
        expect(matchesAnyCommandWithOrder('#1 /a', aliases)).toBe(true)
        expect(matchesAnyCommandWithOrder('/b', aliases)).toBe(true)
      })
    })

    describe('extractCommand with aliases', () => {
      it('extracts dynamic alias command', () => {
        const aliases: DynamicAlias[] = [{ alias: '/code', queryType: 'mcp:code' }]
        expect(extractCommand('/code task', aliases)).toBe('/code')
      })

      it('extracts dynamic alias with order prefix', () => {
        const aliases: DynamicAlias[] = [{ alias: '/qa', queryType: 'mcp:qa' }]
        expect(extractCommand('#5 /qa test', aliases)).toBe('/qa')
      })

      it('extracts from multiple aliases', () => {
        const aliases: DynamicAlias[] = [
          { alias: '/a', queryType: 'alias_a' },
          { alias: '/b', queryType: 'alias_b' },
        ]
        expect(extractCommand('/a task', aliases)).toBe('/a')
        expect(extractCommand('#2 /b task', aliases)).toBe('/b')
      })

      it('returns null for unknown alias', () => {
        const aliases: DynamicAlias[] = [{ alias: '/known', queryType: 'known' }]
        expect(extractCommand('/unknown', aliases)).toBe(null)
      })
    })

    describe('precedence and shadowing', () => {
      it('static command takes precedence over dynamic alias', () => {
        const aliases: DynamicAlias[] = [{ alias: '/web', queryType: 'custom_web' }]
        expect(matchesAnyCommand('/web', aliases)).toBe(true)
      })

      it('does not create duplicate matches', () => {
        const aliases: DynamicAlias[] = [{ alias: '/web', queryType: 'override' }]
        const matcher = createCommandMatcher(aliases)
        const matches = '/web search'.match(matcher.standard)
        expect(matches).not.toBe(null)
        expect(matches?.[0]).toBe('/web ')
      })
    })

    describe('edge cases with dynamic aliases', () => {
      it('handles empty alias array', () => {
        expect(matchesAnyCommand('/web', [])).toBe(true)
        expect(matchesAnyCommandWithOrder('#1 /web', [])).toBe(true)
      })

      it('handles undefined aliases parameter', () => {
        expect(matchesAnyCommand('/web')).toBe(true)
        expect(matchesAnyCommandWithOrder('#1 /web')).toBe(true)
      })

      it('handles alias with special regex characters', () => {
        const aliases: DynamicAlias[] = [{ alias: '/c++', queryType: 'cpp' }]
        expect(matchesAnyCommand('/c++', aliases)).toBe(true)
        expect(matchesAnyCommandWithOrder('#1 /c++', aliases)).toBe(true)
      })

      it('handles alias with unicode', () => {
        const aliases: DynamicAlias[] = [{ alias: '/测试', queryType: 'test:cn' }]
        expect(matchesAnyCommand('/测试', aliases)).toBe(true)
      })

      it('handles very long alias', () => {
        const longAlias = '/' + 'a'.repeat(100)
        const aliases: DynamicAlias[] = [{ alias: longAlias, queryType: 'long' }]
        expect(matchesAnyCommand(longAlias, aliases)).toBe(true)
      })
    })

    describe('integration scenarios', () => {
      it('supports MCP workflow with multiple aliases', () => {
        const aliases: DynamicAlias[] = [
          { alias: '/code', queryType: 'mcp:code' },
          { alias: '/qa', queryType: 'mcp:qa' },
          { alias: '/research', queryType: 'mcp:research' },
        ]
        expect(matchesAnyCommandWithOrder('#1 /web search API', aliases)).toBe(true)
        expect(matchesAnyCommandWithOrder('#2 /code implement', aliases)).toBe(true)
        expect(matchesAnyCommandWithOrder('#3 /qa verify', aliases)).toBe(true)
        expect(matchesAnyCommandWithOrder('#4 /research study', aliases)).toBe(true)
      })

      it('extracts commands in MCP workflow', () => {
        const aliases: DynamicAlias[] = [
          { alias: '/code', queryType: 'mcp:code' },
          { alias: '/qa', queryType: 'mcp:qa' },
        ]
        expect(extractCommand('#1 /web API docs', aliases)).toBe('/web')
        expect(extractCommand('#2 /code feature', aliases)).toBe('/code')
        expect(extractCommand('#3 /qa test', aliases)).toBe('/qa')
      })
    })

    describe('backward compatibility', () => {
      it('maintains behavior without aliases for static commands', () => {
        expect(matchesAnyCommand('/web search')).toBe(true)
        expect(matchesAnyCommandWithOrder('#1 /chatgpt hello')).toBe(true)
        expect(extractCommand('/steps task')).toBe('/steps')
      })

      it('works with all existing static commands', () => {
        const staticCommands = ['/chatgpt', '/instruct', '/web', '/scholar', '/steps', '/foreach', '/claude']
        staticCommands.forEach(cmd => {
          expect(matchesAnyCommand(cmd)).toBe(true)
          expect(matchesAnyCommandWithOrder(`#1 ${cmd}`)).toBe(true)
        })
      })
    })

    describe('alias naming edge cases', () => {
      it('matches alias with dashes', () => {
        const aliases: DynamicAlias[] = [{ alias: '/my-tool', queryType: 'custom' }]
        expect(matchesAnyCommand('/my-tool execute', aliases)).toBe(true)
        expect(extractCommand('/my-tool execute', aliases)).toBe('/my-tool')
      })

      it('matches alias with underscores', () => {
        const aliases: DynamicAlias[] = [{ alias: '/my_tool', queryType: 'custom' }]
        expect(matchesAnyCommand('/my_tool execute', aliases)).toBe(true)
        expect(extractCommand('/my_tool execute', aliases)).toBe('/my_tool')
      })

      it('matches alias with mixed separators', () => {
        const aliases: DynamicAlias[] = [{ alias: '/my-tool_v2', queryType: 'custom' }]
        expect(matchesAnyCommand('/my-tool_v2 run', aliases)).toBe(true)
      })

      it('matches alias with numbers', () => {
        const aliases: DynamicAlias[] = [{ alias: '/tool123', queryType: 'custom' }]
        expect(matchesAnyCommand('/tool123 cmd', aliases)).toBe(true)
      })

      it('is case-sensitive for aliases', () => {
        const aliases: DynamicAlias[] = [
          { alias: '/Tool', queryType: 'upper' },
          { alias: '/tool', queryType: 'lower' },
        ]
        expect(matchesAnyCommand('/Tool run', aliases)).toBe(true)
        expect(matchesAnyCommand('/tool run', aliases)).toBe(true)
        expect(extractCommand('/Tool', aliases)).toBe('/Tool')
        expect(extractCommand('/tool', aliases)).toBe('/tool')
      })
    })

    describe('queryType separator preservation', () => {
      it('matches alias regardless of queryType separator', () => {
        const aliases: DynamicAlias[] = [
          { alias: '/a', queryType: 'ns:tool' },
          { alias: '/b', queryType: 'my_tool' },
          { alias: '/c', queryType: 'my-tool' },
        ]
        expect(matchesAnyCommand('/a cmd', aliases)).toBe(true)
        expect(matchesAnyCommand('/b cmd', aliases)).toBe(true)
        expect(matchesAnyCommand('/c cmd', aliases)).toBe(true)
      })

      it('extracts command independent of queryType format', () => {
        const aliases: DynamicAlias[] = [{ alias: '/tool', queryType: 'mcp:sub:tool' }]
        expect(extractCommand('/tool run', aliases)).toBe('/tool')
      })
    })

    describe('robustness under malformed input', () => {
      it('handles empty alias list gracefully', () => {
        expect(matchesAnyCommand('/unknown', [])).toBe(false)
        expect(extractCommand('/unknown', [])).toBe(null)
      })

      it('handles alias with empty queryType', () => {
        const aliases: DynamicAlias[] = [{ alias: '/tool', queryType: '' }]
        expect(matchesAnyCommand('/tool cmd', aliases)).toBe(true)
      })

      it('handles whitespace in various positions', () => {
        const aliases: DynamicAlias[] = [{ alias: '/tool', queryType: 'custom' }]
        expect(matchesAnyCommand('  /tool  cmd  ', aliases)).toBe(true)
        expect(matchesAnyCommandWithOrder('  #1  /tool  cmd  ', aliases)).toBe(true)
      })

      it('handles order prefix with extra whitespace', () => {
        const aliases: DynamicAlias[] = [{ alias: '/tool', queryType: 'custom' }]
        expect(matchesAnyCommandWithOrder('#1    /tool cmd', aliases)).toBe(true)
        expect(matchesAnyCommandWithOrder('  #1  /tool', aliases)).toBe(true)
      })
    })
  })
})
