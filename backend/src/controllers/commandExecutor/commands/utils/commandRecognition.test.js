import {
  matchesBuiltInCommand,
  matchesBuiltInCommandWithOrder,
  matchesDynamicAlias,
  isAnyCommand,
  isAnyCommandWithOrder,
  extractBuiltInCommandPrefix,
  extractDynamicAlias,
} from './commandRecognition'

const mkAlias = alias => ({alias})

describe('commandRecognition', () => {
  describe('matchesBuiltInCommand', () => {
    it.each([
      ['/chatgpt hello', true],
      ['/web search', true],
      ['/steps', true],
      ['/scholar query', true],
      ['/foreach', true],
      ['/switch', true],
      ['  /chatgpt with whitespace', true],
    ])('returns %s for built-in: %s', (input, expected) => {
      expect(matchesBuiltInCommand(input)).toBe(expected)
    })

    it.each([
      ['/unknown command', false],
      ['/coder1 fix', false],
      ['', false],
      [null, false],
      [undefined, false],
      ['no prefix', false],
      ['chatgpt without slash', false],
    ])('returns %s for non-built-in: %s', (input, expected) => {
      expect(matchesBuiltInCommand(input)).toBe(expected)
    })
  })

  describe('matchesBuiltInCommandWithOrder', () => {
    it.each([
      ['#1 /chatgpt hello', true],
      ['#5 /web search', true],
      ['#10 /steps', true],
      ['/chatgpt without order', true],
      ['  #2 /web with whitespace', true],
    ])('returns true for: %s', input => {
      expect(matchesBuiltInCommandWithOrder(input)).toBe(true)
    })

    it.each([
      ['#1 /unknown', false],
      ['/coder1 fix', false],
      ['', false],
      [null, false],
    ])('returns false for: %s', input => {
      expect(matchesBuiltInCommandWithOrder(input)).toBe(false)
    })
  })

  describe('matchesDynamicAlias', () => {
    const aliases = [mkAlias('/coder1'), mkAlias('/vm3-shell'), mkAlias('/research')]

    it.each([
      ['/coder1 fix bug', true],
      ['/vm3-shell ls', true],
      ['/research topic', true],
      ['  /coder1 with whitespace', true],
    ])('returns true when text starts with alias: %s', (input, expected) => {
      expect(matchesDynamicAlias(input, aliases)).toBe(expected)
    })

    it.each([
      ['/unknown command', false],
      ['/coder fix', false],
      ['no prefix', false],
      ['', false],
      [null, false],
    ])('returns false when text does not match: %s', (input, expected) => {
      expect(matchesDynamicAlias(input, aliases)).toBe(expected)
    })

    it('returns false for empty aliases array', () => {
      expect(matchesDynamicAlias('/coder1 fix', [])).toBe(false)
    })

    it('handles exact alias match', () => {
      expect(matchesDynamicAlias('/coder1', aliases)).toBe(true)
    })

    it('requires exact prefix match (no partial)', () => {
      expect(matchesDynamicAlias('/code', aliases)).toBe(false)
    })
  })

  describe('isAnyCommand', () => {
    const aliases = [mkAlias('/coder1'), mkAlias('/vm3')]

    it.each([
      ['/chatgpt hello', true, 'built-in command'],
      ['/web search', true, 'built-in command'],
      ['/coder1 fix', true, 'dynamic alias'],
      ['/vm3 ls', true, 'dynamic alias'],
    ])('returns true for %s (%s)', (input, expected) => {
      expect(isAnyCommand(input, aliases)).toBe(expected)
    })

    it.each([
      ['/unknown', false, 'unknown command'],
      ['text', false, 'plain text'],
      ['', false, 'empty string'],
      [null, false, 'null'],
    ])('returns false for %s (%s)', (input, expected) => {
      expect(isAnyCommand(input, aliases)).toBe(expected)
    })

    it('works without aliases parameter', () => {
      expect(isAnyCommand('/chatgpt')).toBe(true)
      expect(isAnyCommand('/coder1')).toBe(false)
    })

    it('prioritizes built-in over dynamic when both exist', () => {
      const conflictAliases = [mkAlias('/chatgpt')]
      expect(isAnyCommand('/chatgpt hello', conflictAliases)).toBe(true)
    })
  })

  describe('isAnyCommandWithOrder', () => {
    const aliases = [mkAlias('/coder1')]

    it.each([
      ['#1 /chatgpt', true],
      ['/chatgpt', true],
      ['/coder1', true],
      ['  #2 /web', true],
    ])('returns true for: %s', input => {
      expect(isAnyCommandWithOrder(input, aliases)).toBe(true)
    })

    it.each([
      ['#1 /unknown', false],
      ['/unknown', false],
      ['text', false],
    ])('returns false for: %s', input => {
      expect(isAnyCommandWithOrder(input, aliases)).toBe(false)
    })

    it('works without aliases parameter', () => {
      expect(isAnyCommandWithOrder('#1 /chatgpt')).toBe(true)
      expect(isAnyCommandWithOrder('#1 /coder1')).toBe(false)
    })
  })

  describe('extractBuiltInCommandPrefix', () => {
    it.each([
      ['/chatgpt hello', '/chatgpt'],
      ['/web search query', '/web'],
      ['  /steps', '/steps'],
      ['/scholar topic', '/scholar'],
      ['/foreach', '/foreach'],
    ])('extracts %s from: %s', (input, expected) => {
      expect(extractBuiltInCommandPrefix(input)).toBe(expected)
    })

    it.each([['/coder1 fix'], ['/unknown'], ['no command'], [''], [null]])('returns null for: %s', input => {
      expect(extractBuiltInCommandPrefix(input)).toBe(null)
    })

    it('returns first matching prefix for ambiguous input', () => {
      // If somehow text could match multiple, returns the first found
      expect(extractBuiltInCommandPrefix('/chatgpt')).toBe('/chatgpt')
    })
  })

  describe('extractDynamicAlias', () => {
    const aliases = [mkAlias('/coder1'), mkAlias('/vm3'), mkAlias('/agent')]

    it.each([
      ['/coder1 fix bug', mkAlias('/coder1')],
      ['/vm3 ls', mkAlias('/vm3')],
      ['  /agent analyze', mkAlias('/agent')],
    ])('extracts alias from: %s', (input, expected) => {
      expect(extractDynamicAlias(input, aliases)).toEqual(expected)
    })

    it.each([['/unknown'], ['/code'], ['text'], [''], [null]])('returns null for: %s', input => {
      expect(extractDynamicAlias(input, aliases)).toBe(null)
    })

    it('returns null for empty aliases array', () => {
      expect(extractDynamicAlias('/coder1', [])).toBe(null)
    })

    it('returns first matching alias when multiple could match', () => {
      const overlapping = [mkAlias('/code'), mkAlias('/coder'), mkAlias('/coder1')]
      const result = extractDynamicAlias('/code something', overlapping)
      expect(result).toEqual(mkAlias('/code'))
    })

    it('handles exact alias match without trailing content', () => {
      expect(extractDynamicAlias('/coder1', aliases)).toEqual(mkAlias('/coder1'))
    })
  })

  describe('edge cases and boundary conditions', () => {
    describe('whitespace handling', () => {
      const aliases = [mkAlias('/tool')]

      it('handles leading whitespace', () => {
        expect(isAnyCommand('   /chatgpt', aliases)).toBe(true)
        expect(matchesDynamicAlias('  /tool', aliases)).toBe(true)
      })

      it('requires word boundary after alias', () => {
        expect(matchesDynamicAlias('/tool something', aliases)).toBe(true)
        expect(matchesDynamicAlias('/toolExtra', aliases)).toBe(false)
      })

      it('handles tab characters', () => {
        expect(isAnyCommand('\t/chatgpt', aliases)).toBe(true)
      })
    })

    describe('case sensitivity', () => {
      const aliases = [mkAlias('/Tool')]

      it('treats aliases as case-sensitive', () => {
        expect(matchesDynamicAlias('/tool', aliases)).toBe(false)
        expect(matchesDynamicAlias('/Tool', aliases)).toBe(true)
      })

      it('treats built-in commands as case-sensitive', () => {
        expect(matchesBuiltInCommand('/ChatGPT')).toBe(false)
      })
    })

    describe('special characters in aliases', () => {
      const aliases = [mkAlias('/my-tool'), mkAlias('/my_tool'), mkAlias('/tool123')]

      it('handles hyphens', () => {
        expect(matchesDynamicAlias('/my-tool cmd', aliases)).toBe(true)
      })

      it('handles underscores', () => {
        expect(matchesDynamicAlias('/my_tool cmd', aliases)).toBe(true)
      })

      it('handles numbers', () => {
        expect(matchesDynamicAlias('/tool123 cmd', aliases)).toBe(true)
      })
    })

    describe('empty and null inputs', () => {
      const aliases = [mkAlias('/tool')]

      it.each([
        ['matchesBuiltInCommand', matchesBuiltInCommand],
        ['matchesDynamicAlias', text => matchesDynamicAlias(text, aliases)],
        ['isAnyCommand', text => isAnyCommand(text, aliases)],
      ])('%s handles empty string', (name, fn) => {
        expect(fn('')).toBe(false)
      })

      it.each([
        ['matchesBuiltInCommand', matchesBuiltInCommand],
        ['matchesDynamicAlias', text => matchesDynamicAlias(text, aliases)],
        ['isAnyCommand', text => isAnyCommand(text, aliases)],
      ])('%s handles null', (name, fn) => {
        expect(fn(null)).toBe(false)
      })

      it.each([
        ['matchesBuiltInCommand', matchesBuiltInCommand],
        ['matchesDynamicAlias', text => matchesDynamicAlias(text, aliases)],
        ['isAnyCommand', text => isAnyCommand(text, aliases)],
      ])('%s handles undefined', (name, fn) => {
        expect(fn(undefined)).toBe(false)
      })
    })

    describe('array parameter defaults', () => {
      it('isAnyCommand defaults to empty aliases', () => {
        expect(isAnyCommand('/chatgpt')).toBe(true)
        expect(isAnyCommand('/nonexistent')).toBe(false)
      })

      it('matchesDynamicAlias requires aliases array', () => {
        expect(matchesDynamicAlias('/nonexistent', [])).toBe(false)
      })
    })

    describe('order prefix handling', () => {
      const aliases = [mkAlias('/coder1'), mkAlias('/vm3')]

      describe('positive integer order prefixes', () => {
        it.each([
          ['#1 /coder1 prompt', '/coder1'],
          ['#5 /vm3 command', '/vm3'],
          ['#10 /coder1 task', '/coder1'],
          ['#999 /vm3 test', '/vm3'],
        ])('strips order prefix from: %s → matches %s', (input, expectedAlias) => {
          expect(matchesDynamicAlias(input, aliases)).toBe(true)
          const extracted = extractDynamicAlias(input, aliases)
          expect(extracted.alias).toBe(expectedAlias)
        })
      })

      describe('negative order prefixes', () => {
        it.each([
          ['#-1 /coder1 prompt', true],
          ['#-5 /vm3 command', true],
        ])('strips negative order prefix: %s', (input, expected) => {
          expect(matchesDynamicAlias(input, aliases)).toBe(expected)
        })
      })

      describe('order prefix with whitespace variations', () => {
        it.each([
          ['#1 /coder1', true],
          ['#1  /coder1', true],
          ['  #2 /vm3', true],
          ['\t#3 /coder1', true],
        ])('handles whitespace: %s', (input, expected) => {
          expect(matchesDynamicAlias(input, aliases)).toBe(expected)
        })
      })

      describe('invalid order prefix formats', () => {
        it.each([
          ['# /coder1', false],
          ['#abc /coder1', false],
          ['1 /coder1', false],
          ['##1 /coder1', false],
        ])('rejects malformed prefix: %s', (input, expected) => {
          expect(matchesDynamicAlias(input, aliases)).toBe(expected)
        })
      })

      describe('order prefix without following command', () => {
        it.each([
          ['#1', false],
          ['#1 ', false],
          ['#1 text', false],
        ])('requires valid command after order: %s', (input, expected) => {
          expect(matchesDynamicAlias(input, aliases)).toBe(expected)
        })
      })

      describe('isAnyCommandWithOrder integration', () => {
        it.each([
          ['#1 /coder1', true],
          ['#2 /vm3 cmd', true],
          ['#3 /chatgpt', true],
          ['/coder1 no order', true],
        ])('recognizes both ordered and unordered: %s', (input, expected) => {
          expect(isAnyCommandWithOrder(input, aliases)).toBe(expected)
        })
      })
    })

    describe('word boundary validation', () => {
      const aliases = [mkAlias('/tool'), mkAlias('/agent'), mkAlias('/my-cmd')]

      describe('exact matches', () => {
        it.each([
          ['/tool', true],
          ['/agent', true],
          ['/my-cmd', true],
        ])('matches exact alias: %s', (input, expected) => {
          expect(matchesDynamicAlias(input, aliases)).toBe(expected)
        })
      })

      describe('matches with space boundary', () => {
        it.each([
          ['/tool prompt', true],
          ['/agent analyze', true],
          ['/my-cmd execute', true],
        ])('matches with space after: %s', (input, expected) => {
          expect(matchesDynamicAlias(input, aliases)).toBe(expected)
        })
      })

      describe('rejects without word boundary', () => {
        it.each([
          ['/toolbox', false],
          ['/agentsmith', false],
          ['/tool123', false],
          ['/tool_extra', false],
          ['/tool-extra', false],
        ])('rejects non-boundary: %s', (input, expected) => {
          expect(matchesDynamicAlias(input, aliases)).toBe(expected)
        })
      })

      describe('boundary with special characters', () => {
        it.each([
          ['/tool\tprompt', true],
          ['/tool\nprompt', true],
        ])('accepts whitespace boundary: %s', (input, expected) => {
          expect(matchesDynamicAlias(input, aliases)).toBe(expected)
        })
      })

      describe('extraction with word boundary', () => {
        it('extracts only when word boundary present', () => {
          expect(extractDynamicAlias('/tool cmd', aliases)).toEqual(mkAlias('/tool'))
          expect(extractDynamicAlias('/toolbox', aliases)).toBe(null)
        })

        it('extracts from exact match', () => {
          expect(extractDynamicAlias('/tool', aliases)).toEqual(mkAlias('/tool'))
        })
      })

      describe('order prefix combined with word boundary', () => {
        it.each([
          ['#1 /tool prompt', true],
          ['#1 /toolbox', false],
          ['#2 /agent task', true],
          ['#2 /agentsmith', false],
        ])('validates both order strip and boundary: %s', (input, expected) => {
          expect(matchesDynamicAlias(input, aliases)).toBe(expected)
        })
      })
    })

    describe('ambiguous prefix resolution', () => {
      describe('overlapping alias names', () => {
        const aliases = [mkAlias('/tool'), mkAlias('/toolbox'), mkAlias('/tools')]

        it('matches exact alias with word boundary', () => {
          expect(matchesDynamicAlias('/tool cmd', aliases)).toBe(true)
          expect(extractDynamicAlias('/tool cmd', aliases)).toEqual(mkAlias('/tool'))
        })

        it('does not match shorter prefix without boundary', () => {
          expect(extractDynamicAlias('/toolbox cmd', aliases)).toEqual(mkAlias('/toolbox'))
          expect(extractDynamicAlias('/tools cmd', aliases)).toEqual(mkAlias('/tools'))
        })

        it('rejects partial prefix', () => {
          expect(matchesDynamicAlias('/too', aliases)).toBe(false)
        })
      })

      describe('alias order independence', () => {
        const aliasesA = [mkAlias('/short'), mkAlias('/shortlong')]
        const aliasesB = [mkAlias('/shortlong'), mkAlias('/short')]

        it('resolves consistently regardless of array order', () => {
          expect(extractDynamicAlias('/short cmd', aliasesA)).toEqual(mkAlias('/short'))
          expect(extractDynamicAlias('/short cmd', aliasesB)).toEqual(mkAlias('/short'))
        })
      })
    })
  })
})
