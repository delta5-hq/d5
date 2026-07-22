import {interpolateTemplate} from './interpolateTemplate'

describe('interpolateTemplate', () => {
  describe('shell escape mode (default)', () => {
    describe('placeholder replacement', () => {
      it('replaces single occurrence of {{prompt}}', () => {
        expect(interpolateTemplate('echo "{{prompt}}"', 'hello')).toBe('echo "hello"')
      })

      it('replaces multiple occurrences of {{prompt}}', () => {
        expect(interpolateTemplate('cmd {{prompt}} {{prompt}}', 'test')).toBe('cmd test test')
      })

      it('replaces {{prompt}} at different positions', () => {
        expect(interpolateTemplate('{{prompt}} middle {{prompt}} end', 'x')).toBe('x middle x end')
      })

      it('handles template without {{prompt}} placeholder', () => {
        expect(interpolateTemplate('no placeholder', 'ignored')).toBe('no placeholder')
      })
    })

    describe('edge cases', () => {
      it('handles empty prompt', () => {
        expect(interpolateTemplate('cmd {{prompt}}', '')).toBe('cmd ')
      })

      it('handles empty template', () => {
        expect(interpolateTemplate('', 'prompt')).toBe('')
      })

      it('handles null or undefined template', () => {
        expect(interpolateTemplate(null, 'prompt')).toBe('')
        expect(interpolateTemplate(undefined, 'prompt')).toBe('')
      })

      it('handles very long prompts', () => {
        const longPrompt = 'x '.repeat(1000)
        const result = interpolateTemplate('cmd {{prompt}}', longPrompt)
        const escaped = longPrompt.replace(/ /g, '\\ ')
        expect(result).toBe('cmd ' + escaped)
      })

      it('escapes all shell metacharacters in unquoted context', () => {
        const result = interpolateTemplate('cmd {{prompt}}', '`$"|&;<>()\'\n\t')
        expect(result).toBe('cmd \\`\\$\\"\\|\\&\\;\\<\\>\\(\\)\\\'\\n\\t')
      })
    })

    describe('context-aware escaping', () => {
      describe('double-quoted context ("{{prompt}}")', () => {
        it('maintains string integrity for safe characters', () => {
          expect(interpolateTemplate('cmd "{{prompt}}"', 'hello world')).toBe('cmd "hello world"')
          expect(interpolateTemplate('cmd "{{prompt}}"', "it's fine")).toBe('cmd "it\'s fine"')
          expect(interpolateTemplate('cmd "{{prompt}}"', 'a|b;c&d')).toBe('cmd "a|b;c&d"')
        })

        it('prevents command injection and quote breaking', () => {
          expect(interpolateTemplate('cmd "{{prompt}}"', '`whoami`')).toBe('cmd "\\`whoami\\`"')
          expect(interpolateTemplate('cmd "{{prompt}}"', '$HOME')).toBe('cmd "\\$HOME"')
          expect(interpolateTemplate('cmd "{{prompt}}"', 'say "hi"')).toBe('cmd "say \\"hi\\""')
          expect(interpolateTemplate('cmd "{{prompt}}"', 'path\\file')).toBe('cmd "path\\\\file"')
        })

        it('handles control characters', () => {
          expect(interpolateTemplate('cmd "{{prompt}}"', 'a\nb')).toBe('cmd "a\\nb"')
          expect(interpolateTemplate('cmd "{{prompt}}"', 'a\tb')).toBe('cmd "a\\tb"')
          expect(interpolateTemplate('cmd "{{prompt}}"', 'a\rb')).toBe('cmd "a\\rb"')
        })
      })

      describe("single-quoted context ('{{prompt}}')", () => {
        it('treats all characters as literals except single quotes', () => {
          expect(interpolateTemplate("cmd '{{prompt}}'", 'hello world')).toBe("cmd 'hello world'")
          expect(interpolateTemplate("cmd '{{prompt}}'", '`$"|&;<>\\')).toBe("cmd '`$\"|&;<>\\'")
          expect(interpolateTemplate("cmd '{{prompt}}'", 'line\nwith\ttabs')).toBe("cmd 'line\nwith\ttabs'")
        })

        it('handles embedded single quotes', () => {
          expect(interpolateTemplate("cmd '{{prompt}}'", "it's")).toBe("cmd 'it'\\''s'")
          expect(interpolateTemplate("cmd '{{prompt}}'", "'start")).toBe("cmd ''\\''start'")
          expect(interpolateTemplate("cmd '{{prompt}}'", "end'")).toBe("cmd 'end'\\'''")
        })
      })

      describe('unquoted context ({{prompt}})', () => {
        it('makes all characters shell-safe through escaping', () => {
          expect(interpolateTemplate('cmd {{prompt}}', 'hello world')).toBe('cmd hello\\ world')
          expect(interpolateTemplate('cmd {{prompt}}', "it's")).toBe("cmd it\\'s")
          expect(interpolateTemplate('cmd {{prompt}}', 'a"b')).toBe('cmd a\\"b')
          expect(interpolateTemplate('cmd {{prompt}}', '`$')).toBe('cmd \\`\\$')
          expect(interpolateTemplate('cmd {{prompt}}', 'a|b;c&d')).toBe('cmd a\\|b\\;c\\&d')
          expect(interpolateTemplate('cmd {{prompt}}', 'a<b>c')).toBe('cmd a\\<b\\>c')
          expect(interpolateTemplate('cmd {{prompt}}', '(test)')).toBe('cmd \\(test\\)')
        })
      })

      describe('context detection across multiple placeholders', () => {
        it('applies correct escaping per placeholder based on surrounding quotes', () => {
          expect(interpolateTemplate('cmd "{{prompt}}" \'{{prompt}}\' {{prompt}}', 'test')).toBe(
            'cmd "test" \'test\' test',
          )
        })

        it('handles same input differently per context', () => {
          expect(interpolateTemplate('cmd "{{prompt}}" {{prompt}}', 'a b')).toBe('cmd "a b" a\\ b')
        })

        it('escapes context-specific characters correctly per placeholder', () => {
          expect(interpolateTemplate('cmd \'{{prompt}}\' "{{prompt}}" {{prompt}}', "it's")).toBe(
            "cmd 'it'\\''s' \"it's\" it\\'s",
          )
        })
      })

      describe('boundary detection edge cases', () => {
        it('treats start of template as unquoted context', () => {
          expect(interpolateTemplate('{{prompt}} end', 'a b')).toBe('a\\ b end')
        })

        it('treats end of template as unquoted context', () => {
          expect(interpolateTemplate('start {{prompt}}', 'a b')).toBe('start a\\ b')
        })

        it('requires both surrounding characters to match for quoted context', () => {
          expect(interpolateTemplate('a"{{prompt}}"b', 'test')).toBe('a"test"b')
          expect(interpolateTemplate('"{{prompt}}x', 'test')).toBe('"testx')
          expect(interpolateTemplate('x{{prompt}}"', 'test')).toBe('xtest"')
        })
      })
    })
  })

  describe('json escape mode', () => {
    describe('placeholder replacement', () => {
      it('replaces {{prompt}} placeholder', () => {
        const result = interpolateTemplate('{"text":"{{prompt}}"}', 'hello', {escapeMode: 'json'})
        expect(result).toBe('{"text":"hello"}')
      })

      it('replaces multiple {{prompt}} placeholders', () => {
        const result = interpolateTemplate('{"a":"{{prompt}}","b":"{{prompt}}"}', 'test', {escapeMode: 'json'})
        expect(result).toBe('{"a":"test","b":"test"}')
      })
    })

    describe('JSON validity with special characters', () => {
      it('produces valid JSON round-trip with structural and control characters', () => {
        const inputs = [
          'say "hello"',
          'C:\\path',
          'line1\nline2',
          'line1\r\nline2',
          'col1\tcol2',
          'page\fbreak',
          'back\bspace',
          '"\\\n\r\t\f\b',
        ]

        inputs.forEach(input => {
          const result = interpolateTemplate('{"key":"{{prompt}}"}', input, {escapeMode: 'json'})
          expect(() => JSON.parse(result)).not.toThrow()
          expect(JSON.parse(result).key).toBe(input)
        })
      })

      it('produces valid JSON for complex templates', () => {
        const template = '{"prompt":"{{prompt}}","meta":{"source":"d5"}}'
        const result = interpolateTemplate(template, 'test\nvalue', {escapeMode: 'json'})
        expect(() => JSON.parse(result)).not.toThrow()
        const parsed = JSON.parse(result)
        expect(parsed.prompt).toBe('test\nvalue')
        expect(parsed.meta.source).toBe('d5')
      })
    })

    describe('edge cases', () => {
      it('handles empty prompt', () => {
        const result = interpolateTemplate('{"key":"{{prompt}}"}', '', {escapeMode: 'json'})
        expect(result).toBe('{"key":""}')
        expect(() => JSON.parse(result)).not.toThrow()
      })

      it('preserves unicode', () => {
        const result = interpolateTemplate('{"text":"{{prompt}}"}', 'Hello 世界', {escapeMode: 'json'})
        expect(result).toBe('{"text":"Hello 世界"}')
        expect(() => JSON.parse(result)).not.toThrow()
      })
    })
  })

  describe('escape mode selection', () => {
    it('defaults to shell mode when no escapeMode specified', () => {
      const result = interpolateTemplate('cmd {{prompt}}', 'a b')
      expect(result).toBe('cmd a\\ b')
    })

    it('uses shell mode when explicitly specified', () => {
      const result = interpolateTemplate('cmd {{prompt}}', 'a b', {escapeMode: 'shell'})
      expect(result).toBe('cmd a\\ b')
    })

    it('uses json mode when explicitly specified', () => {
      const result = interpolateTemplate('{"key":"{{prompt}}"}', 'value', {escapeMode: 'json'})
      expect(result).toBe('{"key":"value"}')
    })

    it('applies different escaping for same input in different modes', () => {
      const input = 'test "value"'
      const shellResult = interpolateTemplate('{{prompt}}', input, {escapeMode: 'shell'})
      const jsonResult = interpolateTemplate('{{prompt}}', input, {escapeMode: 'json'})
      expect(shellResult).not.toBe(jsonResult)
      expect(shellResult).toContain('\\')
      expect(jsonResult).toContain('\\"')
    })
  })
})
