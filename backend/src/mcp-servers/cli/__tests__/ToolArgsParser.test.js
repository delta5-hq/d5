import {ToolArgsParser} from '../ToolArgsParser'

describe('ToolArgsParser', () => {
  let parser

  beforeEach(() => {
    parser = new ToolArgsParser()
  })

  describe('boolean flags', () => {
    it('parses flag without value as true', () => {
      const result = parser.parse(['--citations'])
      expect(result).toEqual({citations: true})
    })

    it('parses explicit true value', () => {
      const result = parser.parse(['--citations=true'])
      expect(result).toEqual({citations: true})
    })

    it('parses explicit false value', () => {
      const result = parser.parse(['--citations=false'])
      expect(result).toEqual({citations: false})
    })
  })

  describe('string values', () => {
    it('parses simple string value', () => {
      const result = parser.parse(['--lang=en'])
      expect(result).toEqual({lang: 'en'})
    })

    it('preserves spaces in double-quoted strings', () => {
      const result = parser.parse(['--query="AI safety research"'])
      expect(result).toEqual({query: 'AI safety research'})
    })

    it('preserves spaces in single-quoted strings', () => {
      const result = parser.parse(["--query='AI safety research'"])
      expect(result).toEqual({query: 'AI safety research'})
    })

    it('preserves equals signs within quoted URLs', () => {
      const result = parser.parse(['--url="https://x.com?a=1&b=2"'])
      expect(result).toEqual({url: 'https://x.com?a=1&b=2'})
    })

    it('splits on first equals only', () => {
      const result = parser.parse(['--url=https://x.com?a=1&b=2'])
      expect(result).toEqual({url: 'https://x.com?a=1&b=2'})
    })

    it('handles empty string value', () => {
      const result = parser.parse(['--text='])
      expect(result).toEqual({text: ''})
    })

    it('handles value with quotes that do not match', () => {
      const result = parser.parse(['--text="hello'])
      expect(result).toEqual({text: '"hello'})
    })
  })

  describe('numeric values', () => {
    it('coerces integer strings to numbers', () => {
      const result = parser.parse(['--minYear=2020'])
      expect(result).toEqual({minYear: 2020})
    })

    it('coerces decimal strings to numbers', () => {
      const result = parser.parse(['--threshold=0.75'])
      expect(result).toEqual({threshold: 0.75})
    })

    it('coerces negative integers', () => {
      const result = parser.parse(['--offset=-5'])
      expect(result).toEqual({offset: -5})
    })

    it('does not coerce non-numeric strings', () => {
      const result = parser.parse(['--version=v1.2.3'])
      expect(result).toEqual({version: 'v1.2.3'})
    })
  })

  describe('JSON values', () => {
    it('parses JSON array', () => {
      const result = parser.parse(['--urls=["http://a.com","http://b.com"]'])
      expect(result).toEqual({urls: ['http://a.com', 'http://b.com']})
    })

    it('parses JSON object', () => {
      const result = parser.parse(['--meta={"lang":"en","mode":"fast"}'])
      expect(result).toEqual({meta: {lang: 'en', mode: 'fast'}})
    })

    it('handles malformed JSON as string', () => {
      const result = parser.parse(['--data=[invalid'])
      expect(result).toEqual({data: '[invalid'})
    })

    it('does not parse JSON primitives', () => {
      const result = parser.parse(['--value=123'])
      expect(result).toEqual({value: 123})
    })
  })

  describe('multiple arguments', () => {
    it('combines all flags and values', () => {
      const result = parser.parse([
        '--query=test',
        '--web=m',
        '--citations',
        '--minYear=2020',
        '--urls=["http://a.com"]',
      ])

      expect(result).toEqual({
        query: 'test',
        web: 'm',
        citations: true,
        minYear: 2020,
        urls: ['http://a.com'],
      })
    })

    it('later values override earlier for same key', () => {
      const result = parser.parse(['--lang=en', '--lang=ru'])
      expect(result).toEqual({lang: 'ru'})
    })
  })

  describe('edge cases', () => {
    it('ignores non-flag arguments', () => {
      const result = parser.parse(['positional', '--flag=value', 'another'])
      expect(result).toEqual({flag: 'value'})
    })

    it('handles empty input', () => {
      const result = parser.parse([])
      expect(result).toEqual({})
    })

    it('handles single dash prefix as non-flag', () => {
      const result = parser.parse(['-flag=value'])
      expect(result).toEqual({})
    })

    it('preserves camelCase keys', () => {
      const result = parser.parse(['--maxSize=10mb'])
      expect(result).toEqual({maxSize: '10mb'})
    })

    it('preserves snake_case keys', () => {
      const result = parser.parse(['--max_size=10mb'])
      expect(result).toEqual({max_size: '10mb'})
    })
  })

  describe('boundary values', () => {
    it('handles zero as numeric value', () => {
      const result = parser.parse(['--count=0'])
      expect(result).toEqual({count: 0})
    })

    it('handles negative decimal values', () => {
      const result = parser.parse(['--offset=-0.5'])
      expect(result).toEqual({offset: -0.5})
    })

    it('handles very large integers', () => {
      const result = parser.parse(['--bigInt=9007199254740991'])
      expect(result).toEqual({bigInt: 9007199254740991})
    })

    it('preserves scientific notation as string', () => {
      const result = parser.parse(['--value=1e10'])
      expect(result).toEqual({value: '1e10'})
    })
  })

  describe('special characters', () => {
    it('preserves unicode characters', () => {
      const result = parser.parse(['--emoji=🚀'])
      expect(result).toEqual({emoji: '🚀'})
    })

    it('preserves non-ASCII characters', () => {
      const result = parser.parse(['--text=привет'])
      expect(result).toEqual({text: 'привет'})
    })

    it('handles whitespace-only values', () => {
      const result = parser.parse(['--text="   "'])
      expect(result).toEqual({text: '   '})
    })

    it('handles tab characters in values', () => {
      const result = parser.parse(['--text="a\tb"'])
      expect(result).toEqual({text: 'a\tb'})
    })

    it('handles newline in quoted values', () => {
      const result = parser.parse(['--text="line1\nline2"'])
      expect(result).toEqual({text: 'line1\nline2'})
    })
  })

  describe('JSON edge cases', () => {
    it('parses nested JSON structures', () => {
      const result = parser.parse(['--data=[{"a":1},{"b":2}]'])
      expect(result).toEqual({data: [{a: 1}, {b: 2}]})
    })

    it('parses empty JSON array', () => {
      const result = parser.parse(['--items=[]'])
      expect(result).toEqual({items: []})
    })

    it('parses empty JSON object', () => {
      const result = parser.parse(['--meta={}'])
      expect(result).toEqual({meta: {}})
    })

    it('handles JSON with null values', () => {
      const result = parser.parse(['--data={"key":null}'])
      expect(result).toEqual({data: {key: null}})
    })

    it('handles JSON with boolean values', () => {
      const result = parser.parse(['--config={"enabled":true,"debug":false}'])
      expect(result).toEqual({config: {enabled: true, debug: false}})
    })
  })

  describe('boolean case variations', () => {
    it('handles uppercase TRUE', () => {
      const result = parser.parse(['--flag=TRUE'])
      expect(result).toEqual({flag: 'TRUE'})
    })

    it('handles uppercase FALSE', () => {
      const result = parser.parse(['--flag=FALSE'])
      expect(result).toEqual({flag: 'FALSE'})
    })

    it('handles mixed case True', () => {
      const result = parser.parse(['--flag=True'])
      expect(result).toEqual({flag: 'True'})
    })

    it('only coerces exact lowercase true/false', () => {
      const result = parser.parse(['--a=true', '--b=false', '--c=TRUE', '--d=False'])
      expect(result).toEqual({a: true, b: false, c: 'TRUE', d: 'False'})
    })
  })

  describe('type preservation', () => {
    it('preserves number type after coercion', () => {
      const result = parser.parse(['--port=3000'])
      expect(typeof result.port).toBe('number')
      expect(result.port).toBe(3000)
    })

    it('preserves boolean type', () => {
      const result = parser.parse(['--enabled=true'])
      expect(typeof result.enabled).toBe('boolean')
      expect(result.enabled).toBe(true)
    })

    it('preserves string type for non-coercible values', () => {
      const result = parser.parse(['--version=1.0.0'])
      expect(typeof result.version).toBe('string')
      expect(result.version).toBe('1.0.0')
    })

    it('preserves array type from JSON parse', () => {
      const result = parser.parse(['--items=["a","b"]'])
      expect(Array.isArray(result.items)).toBe(true)
    })

    it('preserves object type from JSON parse', () => {
      const result = parser.parse(['--config={"a":1}'])
      expect(typeof result.config).toBe('object')
      expect(result.config.constructor).toBe(Object)
    })
  })
})
