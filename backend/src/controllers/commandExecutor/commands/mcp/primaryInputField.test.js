import {primaryInputField} from './primaryInputField'

const stringProps = (...names) => Object.fromEntries(names.map(k => [k, {type: 'string'}]))

const makeSchema = (propertyMap, required) => ({
  properties: propertyMap,
  ...(required !== undefined && {required}),
})

describe('primaryInputField', () => {
  describe('fallback — no selectable properties', () => {
    it.each([
      ['null schema', null],
      ['undefined schema', undefined],
      ['schema without properties key', {type: 'object'}],
      ['empty properties, no required', makeSchema({})],
      ['empty properties, empty required', makeSchema({}, [])],
    ])('returns "input" — %s', (_label, s) => {
      expect(primaryInputField(s)).toBe('input')
    })
  })

  describe('priority 1 — exactly one required field', () => {
    it.each([
      ['sole required among sole property', ['q'], ['q'], 'q'],
      ['sole required among multiple properties', ['prompt'], ['prompt', 'ctx', 'meta'], 'prompt'],
      ['sole required field returned verbatim', ['my_field'], ['my_field', 'other'], 'my_field'],
    ])('%s', (_label, required, propertyNames, expected) => {
      expect(primaryInputField(makeSchema(stringProps(...propertyNames), required))).toBe(expected)
    })
  })

  describe('priority 2 — exactly one property, regardless of required array', () => {
    it.each([
      ['required absent', undefined, 'sole', 'sole'],
      ['required is empty', [], 'q', 'q'],
      ['multiple names in required but only one property defined', ['a', 'b'], 'url', 'url'],
    ])('%s', (_label, required, propertyName, expected) => {
      expect(primaryInputField(makeSchema(stringProps(propertyName), required))).toBe(expected)
    })
  })

  describe('priority 3 — first required field when multiple required and multiple properties', () => {
    it.each([
      [['a', 'b'], 'a'],
      [['query', 'maxResults'], 'query'],
      [['first', 'second', 'third'], 'first'],
    ])('required %p → first required field "%s"', (required, expected) => {
      expect(primaryInputField(makeSchema(stringProps(...required), required))).toBe(expected)
    })
  })

  describe('priority 4 — no required fields: first string-typed property, else first property', () => {
    it.each([
      ['all string-typed — returns first', {a: {type: 'string'}, b: {type: 'string'}}, 'a'],
      ['string after non-string — string wins', {arr: {type: 'array'}, q: {type: 'string'}}, 'q'],
      ['string before non-string — string returned', {q: {type: 'string'}, n: {type: 'number'}}, 'q'],
      [
        'string last among non-strings — string still wins',
        {n: {type: 'number'}, arr: {type: 'array'}, q: {type: 'string'}},
        'q',
      ],
      ['no string-typed properties — first key returned', {urls: {type: 'array'}, limit: {type: 'integer'}}, 'urls'],
      [
        'property with no type field — not selected as string, first key returned',
        {untyped: {}, other: {type: 'number'}},
        'untyped',
      ],
      ['untyped property before string — string wins', {untyped: {}, q: {type: 'string'}}, 'q'],
    ])('%s', (_label, propertyMap, expected) => {
      expect(primaryInputField(makeSchema(propertyMap))).toBe(expected)
    })
  })
})
