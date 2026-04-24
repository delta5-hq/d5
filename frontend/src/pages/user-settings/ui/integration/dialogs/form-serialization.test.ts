import { describe, it, expect } from 'vitest'
import {
  serializeArrayToSpaceSeparated,
  serializeArrayToCommaSeparated,
  serializeObjectToKeyValueLines,
  deserializeSpaceSeparatedToArray,
  deserializeCommaSeparatedToArray,
  deserializeKeyValueLinesToObject,
} from './form-serialization'

describe('Form Serialization', () => {
  describe('array to space-separated string', () => {
    describe('serialization', () => {
      it('converts single-element array', () => {
        expect(serializeArrayToSpaceSeparated(['--acp'])).toBe('--acp')
      })

      it('converts multi-element array', () => {
        expect(serializeArrayToSpaceSeparated(['--acp', '--verbose', '--debug'])).toBe('--acp --verbose --debug')
      })

      it('handles empty array', () => {
        expect(serializeArrayToSpaceSeparated([])).toBe('')
      })

      it('passes through string unchanged', () => {
        expect(serializeArrayToSpaceSeparated('already-string')).toBe('already-string')
      })

      it('passes through undefined unchanged', () => {
        expect(serializeArrayToSpaceSeparated(undefined)).toBeUndefined()
      })

      it('preserves elements with internal spaces', () => {
        expect(serializeArrayToSpaceSeparated(['arg with spaces', 'normal'])).toBe('arg with spaces normal')
      })

      it('handles array with empty strings', () => {
        expect(serializeArrayToSpaceSeparated(['', 'valid', ''])).toBe(' valid ')
      })
    })

    describe('deserialization', () => {
      it('splits single argument', () => {
        expect(deserializeSpaceSeparatedToArray('--acp')).toEqual(['--acp'])
      })

      it('splits multiple arguments', () => {
        expect(deserializeSpaceSeparatedToArray('--acp --verbose --debug')).toEqual(['--acp', '--verbose', '--debug'])
      })

      it('filters empty strings from extra spaces', () => {
        expect(deserializeSpaceSeparatedToArray('  --acp   --verbose  ')).toEqual(['--acp', '--verbose'])
      })

      it('handles empty string', () => {
        expect(deserializeSpaceSeparatedToArray('')).toEqual([])
      })

      it('handles undefined', () => {
        expect(deserializeSpaceSeparatedToArray(undefined)).toEqual([])
      })
    })

    describe('roundtrip consistency', () => {
      it('maintains data through serialize-deserialize cycle', () => {
        const original = ['--acp', '--verbose']
        const serialized = serializeArrayToSpaceSeparated(original)
        const deserialized = deserializeSpaceSeparatedToArray(serialized)
        expect(deserialized).toEqual(original)
      })

      it('handles empty array roundtrip', () => {
        const serialized = serializeArrayToSpaceSeparated([])
        const deserialized = deserializeSpaceSeparatedToArray(serialized)
        expect(deserialized).toEqual([])
      })
    })
  })

  describe('array to comma-separated string', () => {
    describe('serialization', () => {
      it('converts single-element array', () => {
        expect(serializeArrayToCommaSeparated(['read_file'])).toBe('read_file')
      })

      it('converts multi-element array', () => {
        expect(serializeArrayToCommaSeparated(['read_file', 'write_file', 'execute_command'])).toBe(
          'read_file, write_file, execute_command',
        )
      })

      it('handles empty array', () => {
        expect(serializeArrayToCommaSeparated([])).toBe('')
      })

      it('passes through string unchanged', () => {
        expect(serializeArrayToCommaSeparated('already-string')).toBe('already-string')
      })

      it('passes through undefined unchanged', () => {
        expect(serializeArrayToCommaSeparated(undefined)).toBeUndefined()
      })
    })

    describe('deserialization', () => {
      it('splits single tool', () => {
        expect(deserializeCommaSeparatedToArray('read_file')).toEqual(['read_file'])
      })

      it('splits multiple tools', () => {
        expect(deserializeCommaSeparatedToArray('read_file, write_file, execute_command')).toEqual([
          'read_file',
          'write_file',
          'execute_command',
        ])
      })

      it('trims whitespace around items', () => {
        expect(deserializeCommaSeparatedToArray('  read_file  ,  write_file  ')).toEqual(['read_file', 'write_file'])
      })

      it('handles comma without space', () => {
        expect(deserializeCommaSeparatedToArray('read_file,write_file')).toEqual(['read_file', 'write_file'])
      })

      it('filters empty strings', () => {
        expect(deserializeCommaSeparatedToArray('read_file,,write_file')).toEqual(['read_file', 'write_file'])
      })

      it('handles empty string', () => {
        expect(deserializeCommaSeparatedToArray('')).toEqual([])
      })

      it('handles undefined', () => {
        expect(deserializeCommaSeparatedToArray(undefined)).toEqual([])
      })
    })

    describe('roundtrip consistency', () => {
      it('maintains data through serialize-deserialize cycle', () => {
        const original = ['read_file', 'write_file']
        const serialized = serializeArrayToCommaSeparated(original)
        const deserialized = deserializeCommaSeparatedToArray(serialized)
        expect(deserialized).toEqual(original)
      })
    })
  })

  describe('object to key-value lines', () => {
    describe('serialization', () => {
      it('converts single-entry object', () => {
        expect(serializeObjectToKeyValueLines({ PATH: '/usr/bin' })).toBe('PATH=/usr/bin')
      })

      it('converts multi-entry object', () => {
        const result = serializeObjectToKeyValueLines({ PATH: '/usr/bin', NODE_ENV: 'production', PORT: '3000' })
        const lines = result?.split('\n') || []
        expect(lines).toHaveLength(3)
        expect(lines).toContain('PATH=/usr/bin')
        expect(lines).toContain('NODE_ENV=production')
        expect(lines).toContain('PORT=3000')
      })

      it('handles empty object', () => {
        expect(serializeObjectToKeyValueLines({})).toBe('')
      })

      it('passes through string unchanged', () => {
        expect(serializeObjectToKeyValueLines('already-string')).toBe('already-string')
      })

      it('passes through undefined unchanged', () => {
        expect(serializeObjectToKeyValueLines(undefined)).toBeUndefined()
      })

      it('passes through null unchanged', () => {
        expect(serializeObjectToKeyValueLines(null)).toBeNull()
      })

      it('passes through array unchanged', () => {
        expect(serializeObjectToKeyValueLines(['not', 'object'])).toEqual(['not', 'object'])
      })

      it('handles values with equals sign', () => {
        expect(serializeObjectToKeyValueLines({ EQUATION: '1+1=2' })).toBe('EQUATION=1+1=2')
      })

      it('handles empty string values', () => {
        expect(serializeObjectToKeyValueLines({ EMPTY: '' })).toBe('EMPTY=')
      })
    })

    describe('deserialization', () => {
      it('parses single entry', () => {
        expect(deserializeKeyValueLinesToObject('PATH=/usr/bin')).toEqual({ PATH: '/usr/bin' })
      })

      it('parses multiple entries', () => {
        const input = 'PATH=/usr/bin\nNODE_ENV=production\nPORT=3000'
        expect(deserializeKeyValueLinesToObject(input)).toEqual({
          PATH: '/usr/bin',
          NODE_ENV: 'production',
          PORT: '3000',
        })
      })

      it('trims whitespace around keys and values', () => {
        expect(deserializeKeyValueLinesToObject('  PATH  =  /usr/bin  ')).toEqual({ PATH: '/usr/bin' })
      })

      it('handles empty lines', () => {
        const input = 'PATH=/usr/bin\n\nNODE_ENV=production'
        expect(deserializeKeyValueLinesToObject(input)).toEqual({ PATH: '/usr/bin', NODE_ENV: 'production' })
      })

      it('ignores lines without equals sign', () => {
        const input = 'PATH=/usr/bin\nINVALID_LINE\nNODE_ENV=production'
        expect(deserializeKeyValueLinesToObject(input)).toEqual({ PATH: '/usr/bin', NODE_ENV: 'production' })
      })

      it('handles values with multiple equals signs', () => {
        expect(deserializeKeyValueLinesToObject('EQUATION=1+1=2')).toEqual({ EQUATION: '1+1=2' })
      })

      it('handles empty string value', () => {
        expect(deserializeKeyValueLinesToObject('EMPTY=')).toEqual({ EMPTY: '' })
      })

      it('handles empty input', () => {
        expect(deserializeKeyValueLinesToObject('')).toEqual({})
      })

      it('handles undefined input', () => {
        expect(deserializeKeyValueLinesToObject(undefined)).toEqual({})
      })
    })

    describe('roundtrip consistency', () => {
      it('maintains data through serialize-deserialize cycle', () => {
        const original = { PATH: '/usr/bin', NODE_ENV: 'production' }
        const serialized = serializeObjectToKeyValueLines(original)
        const deserialized = deserializeKeyValueLinesToObject(serialized!)
        expect(deserialized).toEqual(original)
      })

      it('handles empty object roundtrip', () => {
        const serialized = serializeObjectToKeyValueLines({})
        const deserialized = deserializeKeyValueLinesToObject(serialized!)
        expect(deserialized).toEqual({})
      })

      it('preserves values with special characters', () => {
        const original = { URL: 'https://example.com', EQUATION: '1+1=2', PATH: '/usr/bin:/usr/local/bin' }
        const serialized = serializeObjectToKeyValueLines(original)
        const deserialized = deserializeKeyValueLinesToObject(serialized!)
        expect(deserialized).toEqual(original)
      })
    })
  })

  describe('edge cases across all formats', () => {
    it('handles undefined consistently', () => {
      expect(serializeArrayToSpaceSeparated(undefined)).toBeUndefined()
      expect(serializeArrayToCommaSeparated(undefined)).toBeUndefined()
      expect(serializeObjectToKeyValueLines(undefined)).toBeUndefined()
      expect(deserializeSpaceSeparatedToArray(undefined)).toEqual([])
      expect(deserializeCommaSeparatedToArray(undefined)).toEqual([])
      expect(deserializeKeyValueLinesToObject(undefined)).toEqual({})
    })

    it('handles empty values consistently', () => {
      expect(serializeArrayToSpaceSeparated([])).toBe('')
      expect(serializeArrayToCommaSeparated([])).toBe('')
      expect(serializeObjectToKeyValueLines({})).toBe('')
      expect(deserializeSpaceSeparatedToArray('')).toEqual([])
      expect(deserializeCommaSeparatedToArray('')).toEqual([])
      expect(deserializeKeyValueLinesToObject('')).toEqual({})
    })
  })

  describe('key-value line case sensitivity', () => {
    it('preserves mixed-case keys through roundtrip', () => {
      const original = {
        'Content-Type': 'application/json',
        'content-type': 'text/plain',
      }
      const serialized = serializeObjectToKeyValueLines(original)
      const deserialized = deserializeKeyValueLinesToObject(serialized!)
      expect(deserialized).toHaveProperty('Content-Type')
      expect(deserialized).toHaveProperty('content-type')
    })
  })
})
