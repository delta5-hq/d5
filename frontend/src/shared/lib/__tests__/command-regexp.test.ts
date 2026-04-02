import { describe, it, expect } from 'vitest'
import {
  matchesAnyCommand,
  matchesAnyCommandWithOrder,
  clearStepsPrefix,
  hasStepsPrefix,
  extractStepNumber,
} from '../command-regexp'

describe('command-regexp', () => {
  describe('matchesAnyCommand', () => {
    describe('valid commands', () => {
      it('matches chat-type commands', () => {
        expect(matchesAnyCommand('/chatgpt hello')).toBe(true)
        expect(matchesAnyCommand('/instruct prompt')).toBe(true)
        expect(matchesAnyCommand('/reason analysis')).toBe(true)
        expect(matchesAnyCommand('/chat general')).toBe(true)
      })

      it('matches specialized query commands', () => {
        expect(matchesAnyCommand('/steps task')).toBe(true)
        expect(matchesAnyCommand('/web query')).toBe(true)
        expect(matchesAnyCommand('/scholar research')).toBe(true)
        expect(matchesAnyCommand('/foreach items')).toBe(true)
        expect(matchesAnyCommand('/outline structure')).toBe(true)
        expect(matchesAnyCommand('/summarize text')).toBe(true)
        expect(matchesAnyCommand('/switch context')).toBe(true)
        expect(matchesAnyCommand('/refine improve')).toBe(true)
        expect(matchesAnyCommand('/memorize fact')).toBe(true)
        expect(matchesAnyCommand('/ext external')).toBe(true)
      })

      it('matches LLM provider commands', () => {
        expect(matchesAnyCommand('/claude anthropic')).toBe(true)
        expect(matchesAnyCommand('/qwen alibaba')).toBe(true)
        expect(matchesAnyCommand('/perplexity search')).toBe(true)
        expect(matchesAnyCommand('/deepseek code')).toBe(true)
        expect(matchesAnyCommand('/custom llm')).toBe(true)
        expect(matchesAnyCommand('/yandexgpt russian')).toBe(true)
      })
    })

    describe('order prefix rejection', () => {
      it('rejects positive step numbers', () => {
        expect(matchesAnyCommand('#1 /chatgpt hello')).toBe(false)
        expect(matchesAnyCommand('#42 /web search')).toBe(false)
        expect(matchesAnyCommand('#999 /steps task')).toBe(false)
      })

      it('rejects negative step numbers', () => {
        expect(matchesAnyCommand('#-1 /chatgpt hello')).toBe(false)
        expect(matchesAnyCommand('#-99 /web search')).toBe(false)
      })

      it('rejects zero step number', () => {
        expect(matchesAnyCommand('#0 /chatgpt hello')).toBe(false)
      })
    })

    describe('invalid input rejection', () => {
      it('rejects unknown commands', () => {
        expect(matchesAnyCommand('/unknown')).toBe(false)
        expect(matchesAnyCommand('/newfeature test')).toBe(false)
      })

      it('rejects non-command text', () => {
        expect(matchesAnyCommand('no command')).toBe(false)
        expect(matchesAnyCommand('plain text')).toBe(false)
      })

      it('rejects empty and undefined', () => {
        expect(matchesAnyCommand('')).toBe(false)
        expect(matchesAnyCommand(undefined)).toBe(false)
      })

      it('rejects commands with invalid suffixes', () => {
        expect(matchesAnyCommand('/chatgpt123')).toBe(false)
        expect(matchesAnyCommand('/webextra')).toBe(false)
      })
    })

    describe('whitespace handling', () => {
      it('handles leading whitespace', () => {
        expect(matchesAnyCommand('  /chatgpt hello')).toBe(true)
        expect(matchesAnyCommand('\t/steps task')).toBe(true)
        expect(matchesAnyCommand('\n/web query')).toBe(true)
      })

      it('handles multiple spaces after command', () => {
        expect(matchesAnyCommand('/web     query')).toBe(true)
      })

      it('handles tab characters after command', () => {
        expect(matchesAnyCommand('/web\t\tquery')).toBe(true)
      })

      it('handles newline after command', () => {
        expect(matchesAnyCommand('/web\nquery')).toBe(true)
      })
    })

    describe('boundary conditions', () => {
      it('requires whitespace or EOL after command', () => {
        expect(matchesAnyCommand('/chatgpt')).toBe(true)
        expect(matchesAnyCommand('/chatgpt hello')).toBe(true)
        expect(matchesAnyCommand('/chatgpt123')).toBe(false)
      })

      it('matches only at start of string', () => {
        expect(matchesAnyCommand('/chatgpt hello')).toBe(true)
        expect(matchesAnyCommand('text /chatgpt hello')).toBe(false)
        expect(matchesAnyCommand('prefix /web query')).toBe(false)
      })

      it('handles commands without arguments', () => {
        expect(matchesAnyCommand('/web')).toBe(true)
        expect(matchesAnyCommand('/chatgpt')).toBe(true)
        expect(matchesAnyCommand('/steps')).toBe(true)
      })
    })

    describe('special characters', () => {
      it('handles unicode in arguments', () => {
        expect(matchesAnyCommand('/chatgpt 你好')).toBe(true)
        expect(matchesAnyCommand('/web Ω query')).toBe(true)
      })

      it('handles emoji in arguments', () => {
        expect(matchesAnyCommand('/chatgpt 🎉 celebration')).toBe(true)
      })
    })
  })

  describe('matchesAnyCommandWithOrder', () => {
    describe('with order prefix', () => {
      it('matches positive step numbers', () => {
        expect(matchesAnyCommandWithOrder('#1 /chatgpt hello')).toBe(true)
        expect(matchesAnyCommandWithOrder('#42 /steps task')).toBe(true)
        expect(matchesAnyCommandWithOrder('#999 /web search')).toBe(true)
      })

      it('matches negative step numbers', () => {
        expect(matchesAnyCommandWithOrder('#-1 /chatgpt hello')).toBe(true)
        expect(matchesAnyCommandWithOrder('#-5 /web search')).toBe(true)
        expect(matchesAnyCommandWithOrder('#-99 /steps task')).toBe(true)
      })

      it('matches zero step number', () => {
        expect(matchesAnyCommandWithOrder('#0 /chatgpt hello')).toBe(true)
      })

      it('matches single-digit step numbers', () => {
        expect(matchesAnyCommandWithOrder('#1 /web')).toBe(true)
        expect(matchesAnyCommandWithOrder('#9 /steps')).toBe(true)
      })

      it('matches multi-digit step numbers', () => {
        expect(matchesAnyCommandWithOrder('#12 /chatgpt')).toBe(true)
        expect(matchesAnyCommandWithOrder('#123 /web')).toBe(true)
        expect(matchesAnyCommandWithOrder('#9999 /steps')).toBe(true)
      })

      it('matches with all command types', () => {
        expect(matchesAnyCommandWithOrder('#1 /instruct')).toBe(true)
        expect(matchesAnyCommandWithOrder('#2 /reason')).toBe(true)
        expect(matchesAnyCommandWithOrder('#3 /foreach')).toBe(true)
        expect(matchesAnyCommandWithOrder('#4 /outline')).toBe(true)
        expect(matchesAnyCommandWithOrder('#5 /summarize')).toBe(true)
        expect(matchesAnyCommandWithOrder('#6 /switch')).toBe(true)
        expect(matchesAnyCommandWithOrder('#7 /refine')).toBe(true)
        expect(matchesAnyCommandWithOrder('#8 /memorize')).toBe(true)
        expect(matchesAnyCommandWithOrder('#9 /ext')).toBe(true)
        expect(matchesAnyCommandWithOrder('#10 /yandexgpt')).toBe(true)
      })
    })

    describe('without order prefix', () => {
      it('matches all command categories', () => {
        expect(matchesAnyCommandWithOrder('/chatgpt hello')).toBe(true)
        expect(matchesAnyCommandWithOrder('/steps task')).toBe(true)
        expect(matchesAnyCommandWithOrder('/web query')).toBe(true)
        expect(matchesAnyCommandWithOrder('/claude anthropic')).toBe(true)
        expect(matchesAnyCommandWithOrder('/foreach items')).toBe(true)
      })

      it('matches commands without arguments', () => {
        expect(matchesAnyCommandWithOrder('/chatgpt')).toBe(true)
        expect(matchesAnyCommandWithOrder('/web')).toBe(true)
        expect(matchesAnyCommandWithOrder('/steps')).toBe(true)
      })
    })

    describe('invalid input rejection', () => {
      it('rejects unknown commands with order', () => {
        expect(matchesAnyCommandWithOrder('#1 /unknown')).toBe(false)
        expect(matchesAnyCommandWithOrder('#5 /newcommand')).toBe(false)
      })

      it('rejects unknown commands without order', () => {
        expect(matchesAnyCommandWithOrder('/unknown hello')).toBe(false)
        expect(matchesAnyCommandWithOrder('/notexist')).toBe(false)
      })

      it('rejects non-command text', () => {
        expect(matchesAnyCommandWithOrder('no command')).toBe(false)
        expect(matchesAnyCommandWithOrder('plain text')).toBe(false)
        expect(matchesAnyCommandWithOrder('#1 plain text')).toBe(false)
      })

      it('rejects empty and undefined', () => {
        expect(matchesAnyCommandWithOrder('')).toBe(false)
        expect(matchesAnyCommandWithOrder(undefined)).toBe(false)
      })

      it('rejects invalid step prefix format', () => {
        expect(matchesAnyCommandWithOrder('# /chatgpt')).toBe(false)
        expect(matchesAnyCommandWithOrder('#abc /chatgpt')).toBe(false)
        expect(matchesAnyCommandWithOrder('##1 /chatgpt')).toBe(false)
      })
    })

    describe('whitespace handling', () => {
      it('handles leading whitespace without order', () => {
        expect(matchesAnyCommandWithOrder('  /chatgpt hello')).toBe(true)
        expect(matchesAnyCommandWithOrder('\t/web query')).toBe(true)
        expect(matchesAnyCommandWithOrder('\n/steps task')).toBe(true)
      })

      it('handles leading whitespace with order', () => {
        expect(matchesAnyCommandWithOrder('  #1 /chatgpt hello')).toBe(true)
        expect(matchesAnyCommandWithOrder('\t#5 /web query')).toBe(true)
      })

      it('handles whitespace between order and command', () => {
        expect(matchesAnyCommandWithOrder('#1  /chatgpt')).toBe(true)
        expect(matchesAnyCommandWithOrder('#5\t/web')).toBe(true)
        expect(matchesAnyCommandWithOrder('#10   /steps')).toBe(true)
      })

      it('handles multiple spaces after command', () => {
        expect(matchesAnyCommandWithOrder('#1 /web     query')).toBe(true)
        expect(matchesAnyCommandWithOrder('/chatgpt     hello')).toBe(true)
      })
    })

    describe('boundary conditions', () => {
      it('handles very large step numbers', () => {
        expect(matchesAnyCommandWithOrder('#99999999 /chatgpt')).toBe(true)
        expect(matchesAnyCommandWithOrder('#-99999999 /web')).toBe(true)
      })

      it('matches only at start of string', () => {
        expect(matchesAnyCommandWithOrder('text #1 /chatgpt')).toBe(false)
        expect(matchesAnyCommandWithOrder('prefix /web query')).toBe(false)
      })

      it('requires whitespace or EOL after command', () => {
        expect(matchesAnyCommandWithOrder('#1 /chatgpt')).toBe(true)
        expect(matchesAnyCommandWithOrder('#1 /chatgpt hello')).toBe(true)
        expect(matchesAnyCommandWithOrder('#1 /chatgpt123')).toBe(false)
      })
    })

    describe('special characters', () => {
      it('handles unicode in arguments', () => {
        expect(matchesAnyCommandWithOrder('#1 /chatgpt 你好')).toBe(true)
        expect(matchesAnyCommandWithOrder('/web Ω query')).toBe(true)
      })

      it('handles emoji in arguments', () => {
        expect(matchesAnyCommandWithOrder('#5 /chatgpt 🎉')).toBe(true)
        expect(matchesAnyCommandWithOrder('/web 🔍 search')).toBe(true)
      })
    })
  })

  describe('clearStepsPrefix', () => {
    describe('prefix removal', () => {
      it('removes positive step prefix', () => {
        expect(clearStepsPrefix('#1 /chatgpt hello')).toBe('/chatgpt hello')
        expect(clearStepsPrefix('#42 content here')).toBe('content here')
        expect(clearStepsPrefix('#999 large number')).toBe('large number')
      })

      it('removes negative step prefix', () => {
        expect(clearStepsPrefix('#-1 negative')).toBe('negative')
        expect(clearStepsPrefix('#-42 more negative')).toBe('more negative')
        expect(clearStepsPrefix('#-999 very negative')).toBe('very negative')
      })

      it('removes zero step prefix', () => {
        expect(clearStepsPrefix('#0 zero step')).toBe('zero step')
      })

      it('removes single-digit prefixes', () => {
        expect(clearStepsPrefix('#1 text')).toBe('text')
        expect(clearStepsPrefix('#9 text')).toBe('text')
      })

      it('removes multi-digit prefixes', () => {
        expect(clearStepsPrefix('#12 text')).toBe('text')
        expect(clearStepsPrefix('#123 text')).toBe('text')
        expect(clearStepsPrefix('#9999 text')).toBe('text')
      })
    })

    describe('preservation of non-prefix content', () => {
      it('preserves text without step prefix', () => {
        expect(clearStepsPrefix('/chatgpt hello')).toBe('/chatgpt hello')
        expect(clearStepsPrefix('no prefix here')).toBe('no prefix here')
        expect(clearStepsPrefix('')).toBe('')
      })

      it('preserves hash symbols not followed by numbers', () => {
        expect(clearStepsPrefix('#hashtag text')).toBe('#hashtag text')
        expect(clearStepsPrefix('# not a number')).toBe('# not a number')
        expect(clearStepsPrefix('#abc text')).toBe('#abc text')
      })

      it('preserves hash at end of text', () => {
        expect(clearStepsPrefix('text #')).toBe('text #')
      })

      it('preserves commands and special characters', () => {
        expect(clearStepsPrefix('#1 /web @mention')).toBe('/web @mention')
        expect(clearStepsPrefix('#5 special!chars')).toBe('special!chars')
      })
    })

    describe('multiple prefix handling', () => {
      it('removes all step prefixes in text', () => {
        expect(clearStepsPrefix('#1 text #2 more')).toBe('text  more')
        expect(clearStepsPrefix('#1 #2 #3 multiple')).toBe('multiple')
      })

      it('removes mixed positive and negative prefixes', () => {
        expect(clearStepsPrefix('#1 text #-2 more')).toBe('text  more')
        expect(clearStepsPrefix('#-5 first #10 second')).toBe('first  second')
      })

      it('preserves spacing when removing multiple prefixes', () => {
        expect(clearStepsPrefix('#1 a #2 b #3 c')).toBe('a  b  c')
      })
    })

    describe('whitespace normalization', () => {
      it('trims leading and trailing whitespace', () => {
        expect(clearStepsPrefix('  #1 text  ')).toBe('text')
        expect(clearStepsPrefix('\t#1 text\n')).toBe('text')
        expect(clearStepsPrefix('   #5 content   ')).toBe('content')
      })

      it('trims after removing prefix', () => {
        expect(clearStepsPrefix('#1  text')).toBe('text')
        expect(clearStepsPrefix('#5\ttext')).toBe('text')
      })

      it('preserves internal whitespace', () => {
        expect(clearStepsPrefix('#1 text  with  spaces')).toBe('text  with  spaces')
      })
    })

    describe('boundary conditions', () => {
      it('handles very large numbers', () => {
        expect(clearStepsPrefix('#99999999 text')).toBe('text')
        expect(clearStepsPrefix('#-99999999 text')).toBe('text')
      })

      it('handles prefix at end of text', () => {
        expect(clearStepsPrefix('text #1')).toBe('text')
        expect(clearStepsPrefix('content #-5')).toBe('content')
      })

      it('handles prefix in middle of text', () => {
        expect(clearStepsPrefix('before #1 after')).toBe('before  after')
        expect(clearStepsPrefix('start #-3 end')).toBe('start  end')
      })

      it('handles only prefix with no content', () => {
        expect(clearStepsPrefix('#1')).toBe('')
        expect(clearStepsPrefix('#-5')).toBe('')
        expect(clearStepsPrefix('#0')).toBe('')
      })

      it('handles only prefix with whitespace', () => {
        expect(clearStepsPrefix('#1 ')).toBe('')
        expect(clearStepsPrefix('  #5  ')).toBe('')
      })
    })

    describe('special characters', () => {
      it('handles unicode content', () => {
        expect(clearStepsPrefix('#1 你好')).toBe('你好')
        expect(clearStepsPrefix('#5 Ω text')).toBe('Ω text')
      })

      it('handles emoji content', () => {
        expect(clearStepsPrefix('#1 🎉 celebration')).toBe('🎉 celebration')
        expect(clearStepsPrefix('#3 🔍 search')).toBe('🔍 search')
      })
    })
  })

  describe('hasStepsPrefix', () => {
    describe('positive detection', () => {
      it('detects positive step prefixes', () => {
        expect(hasStepsPrefix('#1 text')).toBe(true)
        expect(hasStepsPrefix('#42 text')).toBe(true)
        expect(hasStepsPrefix('#999 text')).toBe(true)
      })

      it('detects negative step prefixes', () => {
        expect(hasStepsPrefix('#-1 text')).toBe(true)
        expect(hasStepsPrefix('#-42 text')).toBe(true)
        expect(hasStepsPrefix('#-999 text')).toBe(true)
      })

      it('detects zero step prefix', () => {
        expect(hasStepsPrefix('#0 text')).toBe(true)
      })

      it('detects single-digit prefixes', () => {
        expect(hasStepsPrefix('#1 text')).toBe(true)
        expect(hasStepsPrefix('#9 text')).toBe(true)
      })

      it('detects multi-digit prefixes', () => {
        expect(hasStepsPrefix('#12 text')).toBe(true)
        expect(hasStepsPrefix('#123 text')).toBe(true)
        expect(hasStepsPrefix('#9999 text')).toBe(true)
      })

      it('detects very large numbers', () => {
        expect(hasStepsPrefix('#99999999 text')).toBe(true)
        expect(hasStepsPrefix('#-99999999 text')).toBe(true)
      })
    })

    describe('prefix location', () => {
      it('detects prefix at start', () => {
        expect(hasStepsPrefix('#1 text')).toBe(true)
        expect(hasStepsPrefix('#5 content')).toBe(true)
      })

      it('detects prefix anywhere in text', () => {
        expect(hasStepsPrefix('prefix #1 middle')).toBe(true)
        expect(hasStepsPrefix('text #1')).toBe(true)
        expect(hasStepsPrefix('start #5 middle #10 end')).toBe(true)
      })

      it('detects prefix with leading whitespace', () => {
        expect(hasStepsPrefix('  #1 text')).toBe(true)
        expect(hasStepsPrefix('\t#1 text')).toBe(true)
        expect(hasStepsPrefix('\n#5 text')).toBe(true)
      })
    })

    describe('negative detection', () => {
      it('rejects text without prefix', () => {
        expect(hasStepsPrefix('text')).toBe(false)
        expect(hasStepsPrefix('/chatgpt hello')).toBe(false)
        expect(hasStepsPrefix('plain content')).toBe(false)
      })

      it('rejects hash without number', () => {
        expect(hasStepsPrefix('#hashtag')).toBe(false)
        expect(hasStepsPrefix('# text')).toBe(false)
        expect(hasStepsPrefix('#abc')).toBe(false)
        expect(hasStepsPrefix('##text')).toBe(false)
      })

      it('rejects empty and whitespace-only', () => {
        expect(hasStepsPrefix('')).toBe(false)
        expect(hasStepsPrefix('   ')).toBe(false)
        expect(hasStepsPrefix('\t\n')).toBe(false)
      })

      it('rejects number without hash', () => {
        expect(hasStepsPrefix('1 text')).toBe(false)
        expect(hasStepsPrefix('42 content')).toBe(false)
      })

      it('detects pattern anywhere including edge cases', () => {
        expect(hasStepsPrefix('##1 text')).toBe(true)
        expect(hasStepsPrefix('text##5')).toBe(true)
      })

      it('rejects hash with space before number', () => {
        expect(hasStepsPrefix('# 1 text')).toBe(false)
      })
    })

    describe('boundary conditions', () => {
      it('detects prefix without subsequent text', () => {
        expect(hasStepsPrefix('#1')).toBe(true)
        expect(hasStepsPrefix('#-5')).toBe(true)
        expect(hasStepsPrefix('#0')).toBe(true)
      })

      it('detects prefix with only whitespace after', () => {
        expect(hasStepsPrefix('#1 ')).toBe(true)
        expect(hasStepsPrefix('#5  ')).toBe(true)
      })
    })

    describe('special characters', () => {
      it('detects prefix with unicode content', () => {
        expect(hasStepsPrefix('#1 你好')).toBe(true)
        expect(hasStepsPrefix('#5 Ω')).toBe(true)
      })

      it('detects prefix with emoji content', () => {
        expect(hasStepsPrefix('#1 🎉')).toBe(true)
        expect(hasStepsPrefix('#3 🔍')).toBe(true)
      })
    })
  })

  describe('extractStepNumber', () => {
    describe('successful extraction', () => {
      it('extracts positive numbers', () => {
        expect(extractStepNumber('#1 text')).toBe(1)
        expect(extractStepNumber('#42 text')).toBe(42)
        expect(extractStepNumber('#999 text')).toBe(999)
      })

      it('extracts negative numbers', () => {
        expect(extractStepNumber('#-1 text')).toBe(-1)
        expect(extractStepNumber('#-42 text')).toBe(-42)
        expect(extractStepNumber('#-999 text')).toBe(-999)
      })

      it('extracts zero', () => {
        expect(extractStepNumber('#0 text')).toBe(0)
      })

      it('extracts single-digit numbers', () => {
        expect(extractStepNumber('#1 text')).toBe(1)
        expect(extractStepNumber('#9 text')).toBe(9)
      })

      it('extracts multi-digit numbers', () => {
        expect(extractStepNumber('#12 text')).toBe(12)
        expect(extractStepNumber('#123 text')).toBe(123)
        expect(extractStepNumber('#9999 text')).toBe(9999)
      })
    })

    describe('failed extraction returning null', () => {
      it('returns null for text without prefix', () => {
        expect(extractStepNumber('text')).toBe(null)
        expect(extractStepNumber('/chatgpt hello')).toBe(null)
        expect(extractStepNumber('plain content')).toBe(null)
      })

      it('returns null for empty and whitespace', () => {
        expect(extractStepNumber('')).toBe(null)
        expect(extractStepNumber('   ')).toBe(null)
        expect(extractStepNumber('\t\n')).toBe(null)
      })

      it('returns null for hash without number', () => {
        expect(extractStepNumber('#hashtag')).toBe(null)
        expect(extractStepNumber('# text')).toBe(null)
        expect(extractStepNumber('#abc')).toBe(null)
      })

      it('returns null for invalid formats', () => {
        expect(extractStepNumber('##1 text')).toBe(null)
        expect(extractStepNumber('# 1 text')).toBe(null)
        expect(extractStepNumber('1 text')).toBe(null)
      })
    })

    describe('whitespace handling', () => {
      it('handles leading whitespace', () => {
        expect(extractStepNumber('  #5 text')).toBe(5)
        expect(extractStepNumber('\t#5 text')).toBe(5)
        expect(extractStepNumber('\n#10 text')).toBe(10)
      })

      it('handles whitespace after number', () => {
        expect(extractStepNumber('#5  text')).toBe(5)
        expect(extractStepNumber('#10\ttext')).toBe(10)
      })
    })

    describe('multiple prefix handling', () => {
      it('extracts first number when multiple prefixes present', () => {
        expect(extractStepNumber('#1 text #2 more')).toBe(1)
        expect(extractStepNumber('#5 #10 #15')).toBe(5)
        expect(extractStepNumber('#-3 content #7 more')).toBe(-3)
      })

      it('extracts from start position only', () => {
        expect(extractStepNumber('#1 text')).toBe(1)
        expect(extractStepNumber('text #5 more')).toBe(null)
      })
    })

    describe('boundary conditions', () => {
      it('handles very large numbers', () => {
        expect(extractStepNumber('#99999999 text')).toBe(99999999)
        expect(extractStepNumber('#-99999999 text')).toBe(-99999999)
      })

      it('handles prefix without subsequent text', () => {
        expect(extractStepNumber('#1')).toBe(1)
        expect(extractStepNumber('#-5')).toBe(-5)
        expect(extractStepNumber('#0')).toBe(0)
      })

      it('handles prefix with only whitespace after', () => {
        expect(extractStepNumber('#1 ')).toBe(1)
        expect(extractStepNumber('#5  ')).toBe(5)
      })
    })

    describe('special characters', () => {
      it('extracts from text with unicode', () => {
        expect(extractStepNumber('#1 你好')).toBe(1)
        expect(extractStepNumber('#5 Ω text')).toBe(5)
      })

      it('extracts from text with emoji', () => {
        expect(extractStepNumber('#1 🎉')).toBe(1)
        expect(extractStepNumber('#3 🔍 search')).toBe(3)
      })
    })

    describe('numerical precision', () => {
      it('extracts exact integer values', () => {
        expect(extractStepNumber('#1 text')).toBe(1)
        expect(extractStepNumber('#100 text')).toBe(100)
        expect(extractStepNumber('#-50 text')).toBe(-50)
      })

      it('maintains sign information', () => {
        expect(extractStepNumber('#-1 text')).toBe(-1)
        expect(extractStepNumber('#1 text')).toBe(1)
        expect(extractStepNumber('#0 text')).toBe(0)
      })
    })
  })
})
