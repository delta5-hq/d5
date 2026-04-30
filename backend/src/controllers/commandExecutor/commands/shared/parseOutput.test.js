import {parseOutput} from './parseOutput'

describe('parseOutput', () => {
  describe('text format', () => {
    it('returns raw output as-is', () => {
      expect(parseOutput('hello world', {outputFormat: 'text'})).toBe('hello world')
    })

    it('handles empty string', () => {
      expect(parseOutput('', {outputFormat: 'text'})).toBe('')
    })
  })

  describe('json format without field extraction', () => {
    it('returns stringified JSON when no outputField specified', () => {
      const json = JSON.stringify({foo: 'bar'})
      const result = parseOutput(json, {outputFormat: 'json'})
      expect(JSON.parse(result)).toEqual({foo: 'bar'})
    })

    it('returns raw output for invalid JSON', () => {
      expect(parseOutput('not json', {outputFormat: 'json'})).toBe('not json')
    })
  })

  describe('json format with field extraction', () => {
    it('extracts top-level string field', () => {
      const json = JSON.stringify({result: 'success', data: 'ignored'})
      expect(parseOutput(json, {outputFormat: 'json', outputField: 'result'})).toBe('success')
    })

    it('extracts nested field', () => {
      const json = JSON.stringify({response: {message: 'hello'}})
      expect(parseOutput(json, {outputFormat: 'json', outputField: 'response.message'})).toBe('hello')
    })

    it('stringifies non-string extracted values', () => {
      const json = JSON.stringify({data: {count: 42, active: true}})
      const result = parseOutput(json, {outputFormat: 'json', outputField: 'data'})
      expect(JSON.parse(result)).toEqual({count: 42, active: true})
    })

    it('returns stringified JSON when field does not exist', () => {
      const json = JSON.stringify({foo: 'bar'})
      const result = parseOutput(json, {outputFormat: 'json', outputField: 'missing'})
      expect(JSON.parse(result)).toEqual({foo: 'bar'})
    })

    it('returns stringified JSON when nested field does not exist', () => {
      const json = JSON.stringify({foo: {bar: 'baz'}})
      const result = parseOutput(json, {outputFormat: 'json', outputField: 'foo.missing.deep'})
      expect(JSON.parse(result)).toEqual({foo: {bar: 'baz'}})
    })

    it('handles extraction from array', () => {
      const json = JSON.stringify([{name: 'first'}, {name: 'second'}])
      expect(parseOutput(json, {outputFormat: 'json', outputField: '0.name'})).toBe('first')
    })
  })

  describe('defaults', () => {
    it('uses text format by default', () => {
      expect(parseOutput('hello')).toBe('hello')
    })

    it('stringifies JSON when no field specified', () => {
      const json = JSON.stringify({foo: 'bar'})
      const result = parseOutput(json, {outputFormat: 'json'})
      expect(JSON.parse(result)).toEqual({foo: 'bar'})
    })
  })
})
