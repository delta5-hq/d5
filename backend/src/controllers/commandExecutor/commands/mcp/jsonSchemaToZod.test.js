import {jsonSchemaToZod} from './jsonSchemaToZod'

describe('jsonSchemaToZod', () => {
  describe('basic schema conversion', () => {
    it('converts empty schema to empty object', () => {
      const schema = jsonSchemaToZod({type: 'object', properties: {}})
      expect(schema.safeParse({}).success).toBe(true)
      expect(schema.safeParse({extra: 'field'}).success).toBe(true)
    })

    it('converts single string property', () => {
      const schema = jsonSchemaToZod({
        type: 'object',
        properties: {
          name: {type: 'string'},
        },
        required: ['name'],
      })

      expect(schema.safeParse({name: 'test'}).success).toBe(true)
      expect(schema.safeParse({name: 123}).success).toBe(false)
      expect(schema.safeParse({}).success).toBe(false)
    })

    it('converts multiple properties with different types', () => {
      const schema = jsonSchemaToZod({
        type: 'object',
        properties: {
          name: {type: 'string'},
          age: {type: 'number'},
          active: {type: 'boolean'},
        },
        required: ['name', 'age'],
      })

      expect(schema.safeParse({name: 'Alice', age: 30, active: true}).success).toBe(true)
      expect(schema.safeParse({name: 'Alice', age: 30}).success).toBe(true)
      expect(schema.safeParse({name: 'Alice'}).success).toBe(false)
    })
  })

  describe('required vs optional fields', () => {
    it('marks non-required fields as optional', () => {
      const schema = jsonSchemaToZod({
        type: 'object',
        properties: {
          required_field: {type: 'string'},
          optional_field: {type: 'string'},
        },
        required: ['required_field'],
      })

      expect(schema.safeParse({required_field: 'val'}).success).toBe(true)
      expect(schema.safeParse({}).success).toBe(false)
    })

    it('treats all fields as optional when required array is missing', () => {
      const schema = jsonSchemaToZod({
        type: 'object',
        properties: {
          field1: {type: 'string'},
          field2: {type: 'number'},
        },
      })

      expect(schema.safeParse({}).success).toBe(true)
      expect(schema.safeParse({field1: 'val'}).success).toBe(true)
      expect(schema.safeParse({field2: 42}).success).toBe(true)
      expect(schema.safeParse({field1: 'val', field2: 42}).success).toBe(true)
    })

    it('treats all fields as optional when required array is empty', () => {
      const schema = jsonSchemaToZod({
        type: 'object',
        properties: {
          field: {type: 'string'},
        },
        required: [],
      })

      expect(schema.safeParse({}).success).toBe(true)
      expect(schema.safeParse({field: 'val'}).success).toBe(true)
    })
  })

  describe('primitive type conversion', () => {
    it.each([
      ['string', {type: 'string'}, 'hello', 123, true],
      ['number', {type: 'number'}, 42, 'not a number', true],
      ['number', {type: 'number'}, 3.14, 'not a number', true],
      ['boolean', {type: 'boolean'}, true, 'not boolean', true],
      ['boolean', {type: 'boolean'}, false, 1, true],
    ])('converts %s type correctly', (_label, propSchema, validValue, invalidValue, required) => {
      const schema = jsonSchemaToZod({
        type: 'object',
        properties: {value: propSchema},
        required: required ? ['value'] : [],
      })

      expect(schema.safeParse({value: validValue}).success).toBe(true)
      expect(schema.safeParse({value: invalidValue}).success).toBe(false)
    })

    it('distinguishes integer from number', () => {
      const intSchema = jsonSchemaToZod({
        type: 'object',
        properties: {count: {type: 'integer'}},
        required: ['count'],
      })

      expect(intSchema.safeParse({count: 5}).success).toBe(true)
      expect(intSchema.safeParse({count: 0}).success).toBe(true)
      expect(intSchema.safeParse({count: -10}).success).toBe(true)
      expect(intSchema.safeParse({count: 5.5}).success).toBe(false)
      expect(intSchema.safeParse({count: 3.14}).success).toBe(false)
    })
  })

  describe('array type conversion', () => {
    it('converts array with typed items', () => {
      const schema = jsonSchemaToZod({
        type: 'object',
        properties: {
          tags: {type: 'array', items: {type: 'string'}},
        },
        required: ['tags'],
      })

      expect(schema.safeParse({tags: ['a', 'b']}).success).toBe(true)
      expect(schema.safeParse({tags: []}).success).toBe(true)
      expect(schema.safeParse({tags: [1, 2]}).success).toBe(false)
      expect(schema.safeParse({tags: ['a', 1]}).success).toBe(false)
    })

    it('handles array without items schema as any[]', () => {
      const schema = jsonSchemaToZod({
        type: 'object',
        properties: {
          data: {type: 'array'},
        },
        required: ['data'],
      })

      expect(schema.safeParse({data: ['a', 1, true]}).success).toBe(true)
      expect(schema.safeParse({data: []}).success).toBe(true)
      expect(schema.safeParse({data: [{nested: 'object'}]}).success).toBe(true)
    })

    it('converts nested array types', () => {
      const schema = jsonSchemaToZod({
        type: 'object',
        properties: {
          numbers: {type: 'array', items: {type: 'number'}},
          booleans: {type: 'array', items: {type: 'boolean'}},
        },
        required: ['numbers'],
      })

      expect(schema.safeParse({numbers: [1, 2, 3]}).success).toBe(true)
      expect(schema.safeParse({numbers: [1, 2], booleans: [true, false]}).success).toBe(true)
    })
  })

  describe('object and record types', () => {
    it('converts object type to record', () => {
      const schema = jsonSchemaToZod({
        type: 'object',
        properties: {
          metadata: {type: 'object'},
        },
        required: ['metadata'],
      })

      expect(schema.safeParse({metadata: {any: 'value'}}).success).toBe(true)
      expect(schema.safeParse({metadata: {nested: {deeply: 'ok'}}}).success).toBe(true)
      expect(schema.safeParse({metadata: {}}).success).toBe(true)
    })
  })

  describe('unknown and fallback types', () => {
    it('handles unknown types as any', () => {
      const schema = jsonSchemaToZod({
        type: 'object',
        properties: {
          unknown: {type: 'custom_type'},
        },
        required: ['unknown'],
      })

      expect(schema.safeParse({unknown: 'anything'}).success).toBe(true)
      expect(schema.safeParse({unknown: 123}).success).toBe(true)
      expect(schema.safeParse({unknown: {nested: 'object'}}).success).toBe(true)
      expect(schema.safeParse({unknown: [1, 2, 3]}).success).toBe(true)
    })

    it('handles missing type field as any', () => {
      const schema = jsonSchemaToZod({
        type: 'object',
        properties: {
          noType: {},
        },
        required: ['noType'],
      })

      expect(schema.safeParse({noType: 'string'}).success).toBe(true)
      expect(schema.safeParse({noType: 42}).success).toBe(true)
    })
  })

  describe('edge cases and malformed schemas', () => {
    it('handles missing properties object', () => {
      const schema = jsonSchemaToZod({type: 'object'})
      expect(schema.safeParse({}).success).toBe(true)
      expect(schema.safeParse({anyField: 'allowed'}).success).toBe(true)
    })

    it('handles null or undefined inputSchema', () => {
      expect(jsonSchemaToZod(null).safeParse({}).success).toBe(true)
      expect(jsonSchemaToZod(undefined).safeParse({}).success).toBe(true)
    })

    it('handles non-object type schema by returning empty object schema', () => {
      const stringSchema = jsonSchemaToZod({type: 'string'})
      const numberSchema = jsonSchemaToZod({type: 'number'})
      const arraySchema = jsonSchemaToZod({type: 'array'})

      expect(stringSchema.safeParse({}).success).toBe(true)
      expect(numberSchema.safeParse({}).success).toBe(true)
      expect(arraySchema.safeParse({}).success).toBe(true)
    })

    it('handles schema with properties but no type field (MCP tool pattern)', () => {
      const schema = jsonSchemaToZod({
        properties: {
          name: {type: 'string'},
          count: {type: 'number'},
        },
        required: ['name'],
      })

      expect(schema.safeParse({name: 'test', count: 5}).success).toBe(true)
      expect(schema.safeParse({name: 'test'}).success).toBe(true)
      expect(schema.safeParse({count: 5}).success).toBe(false)
    })

    it('handles empty required array', () => {
      const schema = jsonSchemaToZod({
        type: 'object',
        properties: {
          field1: {type: 'string'},
          field2: {type: 'number'},
        },
        required: [],
      })

      expect(schema.safeParse({}).success).toBe(true)
    })
  })

  describe('real-world MCP tool schemas', () => {
    it('handles typical single-parameter MCP tool', () => {
      const schema = jsonSchemaToZod({
        type: 'object',
        properties: {
          prompt: {type: 'string'},
        },
        required: ['prompt'],
      })

      expect(schema.safeParse({prompt: 'write code'}).success).toBe(true)
      expect(schema.safeParse({}).success).toBe(false)
    })

    it('handles multi-parameter MCP tool with mixed types', () => {
      const schema = jsonSchemaToZod({
        type: 'object',
        properties: {
          query: {type: 'string'},
          maxResults: {type: 'integer'},
          includeMetadata: {type: 'boolean'},
          tags: {type: 'array', items: {type: 'string'}},
        },
        required: ['query'],
      })

      expect(
        schema.safeParse({
          query: 'search term',
          maxResults: 10,
          includeMetadata: true,
          tags: ['tag1', 'tag2'],
        }).success,
      ).toBe(true)

      expect(schema.safeParse({query: 'minimal'}).success).toBe(true)
      expect(schema.safeParse({maxResults: 10}).success).toBe(false)
    })

    it('handles MCP tool with no input parameters', () => {
      const schema = jsonSchemaToZod({
        type: 'object',
        properties: {},
      })

      expect(schema.safeParse({}).success).toBe(true)
    })

    it('handles MCP tool with optional nested configuration', () => {
      const schema = jsonSchemaToZod({
        type: 'object',
        properties: {
          command: {type: 'string'},
          options: {type: 'object'},
        },
        required: ['command'],
      })

      expect(schema.safeParse({command: 'run', options: {verbose: true}}).success).toBe(true)
      expect(schema.safeParse({command: 'run'}).success).toBe(true)
    })
  })
})
