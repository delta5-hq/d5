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

  describe('enum constraint', () => {
    it.each([
      ['single-value enum', ['only'], 'only', 'other'],
      ['two-value enum', ['yes', 'no'], 'yes', 'maybe'],
      ['multi-value enum', ['xs', 's', 'm', 'l', 'xl'], 'xl', 'xxl'],
    ])('accepts declared and rejects undeclared values — %s', (_label, values, validValue, invalidValue) => {
      const schema = jsonSchemaToZod({
        type: 'object',
        properties: {val: {type: 'string', enum: values}},
        required: ['val'],
      })

      expect(schema.safeParse({val: validValue}).success).toBe(true)
      expect(schema.safeParse({val: invalidValue}).success).toBe(false)
    })

    it('handles mixed-type enum via union of literals', () => {
      const schema = jsonSchemaToZod({
        type: 'object',
        properties: {code: {enum: ['auto', 0, false]}},
        required: ['code'],
      })

      expect(schema.safeParse({code: 'auto'}).success).toBe(true)
      expect(schema.safeParse({code: 0}).success).toBe(true)
      expect(schema.safeParse({code: false}).success).toBe(true)
      expect(schema.safeParse({code: 'other'}).success).toBe(false)
      expect(schema.safeParse({code: 1}).success).toBe(false)
    })

    it('propagates enum constraint through array items', () => {
      const schema = jsonSchemaToZod({
        type: 'object',
        properties: {sizes: {type: 'array', items: {type: 'string', enum: ['xs', 's', 'm']}}},
        required: ['sizes'],
      })

      expect(schema.safeParse({sizes: ['xs', 'm']}).success).toBe(true)
      expect(schema.safeParse({sizes: ['xxl']}).success).toBe(false)
    })
  })

  describe('description decorator', () => {
    it.each([
      ['with description', {type: 'string', description: 'The search query'}],
      ['without description', {type: 'string'}],
    ])('field validation unchanged — %s', (_label, propSchema) => {
      const schema = jsonSchemaToZod({
        type: 'object',
        properties: {q: propSchema},
        required: ['q'],
      })

      expect(schema.safeParse({q: 'text'}).success).toBe(true)
      expect(schema.safeParse({q: 42}).success).toBe(false)
    })

    it('description is composable with other constraints', () => {
      const schema = jsonSchemaToZod({
        type: 'object',
        properties: {age: {type: 'integer', description: 'User age in years', minimum: 0, maximum: 150}},
        required: ['age'],
      })

      expect(schema.safeParse({age: 25}).success).toBe(true)
      expect(schema.safeParse({age: -1}).success).toBe(false)
      expect(schema.safeParse({age: 151}).success).toBe(false)
    })
  })

  describe('nested object with properties', () => {
    const nestedSchema = {
      type: 'object',
      properties: {
        config: {
          type: 'object',
          properties: {
            host: {type: 'string'},
            port: {type: 'integer'},
          },
          required: ['host'],
        },
      },
      required: ['config'],
    }

    it.each([
      ['required field present, optional absent', {config: {host: 'localhost'}}, true],
      ['required and optional both present with correct types', {config: {host: 'localhost', port: 8080}}, true],
      ['required field absent', {config: {port: 8080}}, false],
      ['optional field present with wrong type', {config: {host: 'localhost', port: 'bad'}}, false],
      ['outer required object absent', {}, false],
    ])('enforces nested schema constraints — %s', (_label, input, valid) => {
      expect(jsonSchemaToZod(nestedSchema).safeParse(input).success).toBe(valid)
    })

    it('unknown fields inside nested objects are allowed via passthrough', () => {
      const schema = jsonSchemaToZod({
        type: 'object',
        properties: {
          opts: {
            type: 'object',
            properties: {timeout: {type: 'number'}},
            required: ['timeout'],
          },
        },
        required: ['opts'],
      })

      expect(schema.safeParse({opts: {timeout: 30, extra: 'allowed'}}).success).toBe(true)
    })

    it('recursively validates to arbitrary depth', () => {
      const schema = jsonSchemaToZod({
        type: 'object',
        properties: {
          outer: {
            type: 'object',
            properties: {
              inner: {
                type: 'object',
                properties: {value: {type: 'string'}},
                required: ['value'],
              },
            },
            required: ['inner'],
          },
        },
        required: ['outer'],
      })

      expect(schema.safeParse({outer: {inner: {value: 'ok'}}}).success).toBe(true)
      expect(schema.safeParse({outer: {inner: {}}}).success).toBe(false)
    })
  })

  describe('nullable type-array', () => {
    it.each([
      ['["string","null"]', ['string', 'null'], 'hello', 42],
      ['["null","integer"]', ['null', 'integer'], 5, 1.5],
      ['["boolean","null"]', ['boolean', 'null'], true, 'yes'],
    ])('accepts both null and valid non-null value — %s', (_label, types, validNonNull, invalidValue) => {
      const schema = jsonSchemaToZod({
        type: 'object',
        properties: {val: {type: types}},
        required: ['val'],
      })

      expect(schema.safeParse({val: null}).success).toBe(true)
      expect(schema.safeParse({val: validNonNull}).success).toBe(true)
      expect(schema.safeParse({val: invalidValue}).success).toBe(false)
    })

    it('builds a union when no null member present', () => {
      const schema = jsonSchemaToZod({
        type: 'object',
        properties: {val: {type: ['string', 'number']}},
        required: ['val'],
      })

      expect(schema.safeParse({val: 'text'}).success).toBe(true)
      expect(schema.safeParse({val: 42}).success).toBe(true)
      expect(schema.safeParse({val: true}).success).toBe(false)
      expect(schema.safeParse({val: null}).success).toBe(false)
    })
  })

  describe('anyOf and oneOf unions', () => {
    it.each(['anyOf', 'oneOf'])('%s builds a union of member schemas', keyword => {
      const schema = jsonSchemaToZod({
        type: 'object',
        properties: {id: {[keyword]: [{type: 'string'}, {type: 'integer'}]}},
        required: ['id'],
      })

      expect(schema.safeParse({id: 'abc'}).success).toBe(true)
      expect(schema.safeParse({id: 42}).success).toBe(true)
      expect(schema.safeParse({id: 3.14}).success).toBe(false)
      expect(schema.safeParse({id: true}).success).toBe(false)
    })

    it('handles three or more union members', () => {
      const schema = jsonSchemaToZod({
        type: 'object',
        properties: {val: {anyOf: [{type: 'string'}, {type: 'number'}, {type: 'boolean'}]}},
        required: ['val'],
      })

      expect(schema.safeParse({val: 'text'}).success).toBe(true)
      expect(schema.safeParse({val: 10}).success).toBe(true)
      expect(schema.safeParse({val: true}).success).toBe(true)
      expect(schema.safeParse({val: null}).success).toBe(false)
    })
  })

  describe('allOf intersection', () => {
    it('requires all member schemas to be simultaneously satisfied', () => {
      const schema = jsonSchemaToZod({
        type: 'object',
        properties: {
          merged: {
            allOf: [
              {type: 'object', properties: {a: {type: 'string'}}, required: ['a']},
              {type: 'object', properties: {b: {type: 'number'}}, required: ['b']},
            ],
          },
        },
        required: ['merged'],
      })

      expect(schema.safeParse({merged: {a: 'x', b: 1}}).success).toBe(true)
      expect(schema.safeParse({merged: {a: 'x'}}).success).toBe(false)
      expect(schema.safeParse({merged: {b: 1}}).success).toBe(false)
    })

    it('passes through when allOf contains a single member', () => {
      const schema = jsonSchemaToZod({
        type: 'object',
        properties: {
          val: {allOf: [{type: 'object', properties: {x: {type: 'string'}}, required: ['x']}]},
        },
        required: ['val'],
      })

      expect(schema.safeParse({val: {x: 'ok'}}).success).toBe(true)
      expect(schema.safeParse({val: {}}).success).toBe(false)
    })
  })

  describe('const literal', () => {
    it.each([
      ['string', 'v2', 'v1'],
      ['number', 42, 0],
      ['boolean', true, false],
    ])('accepts only the declared %s const value', (_type, validValue, invalidValue) => {
      const schema = jsonSchemaToZod({
        type: 'object',
        properties: {val: {const: validValue}},
        required: ['val'],
      })

      expect(schema.safeParse({val: validValue}).success).toBe(true)
      expect(schema.safeParse({val: invalidValue}).success).toBe(false)
    })
  })

  describe('numeric constraints', () => {
    it.each([
      ['at minimum boundary', 0, true],
      ['within range', 50, true],
      ['at maximum boundary', 100, true],
      ['below minimum', -1, false],
      ['above maximum', 101, false],
    ])('inclusive bounds [0, 100] — %s', (_label, score, valid) => {
      const schema = jsonSchemaToZod({
        type: 'object',
        properties: {score: {type: 'number', minimum: 0, maximum: 100}},
        required: ['score'],
      })

      expect(schema.safeParse({score}).success).toBe(valid)
    })

    it.each([
      ['just above exclusive lower bound', 0.001, true],
      ['just below exclusive upper bound', 0.999, true],
      ['at exclusive lower bound', 0, false],
      ['at exclusive upper bound', 1, false],
    ])('exclusive bounds (0, 1) — %s', (_label, temp, valid) => {
      const schema = jsonSchemaToZod({
        type: 'object',
        properties: {temp: {type: 'number', exclusiveMinimum: 0, exclusiveMaximum: 1}},
        required: ['temp'],
      })

      expect(schema.safeParse({temp}).success).toBe(valid)
    })
  })

  describe('string constraints', () => {
    it.each([
      ['at minLength boundary', 'abc', true],
      ['at maxLength boundary', 'abcdef', true],
      ['below minLength', 'ab', false],
      ['above maxLength', 'abcdefg', false],
    ])('length bounds [3, 6] — %s', (_label, code, valid) => {
      const schema = jsonSchemaToZod({
        type: 'object',
        properties: {code: {type: 'string', minLength: 3, maxLength: 6}},
        required: ['code'],
      })

      expect(schema.safeParse({code}).success).toBe(valid)
    })

    it.each([
      ['matching pattern', 'hello-world', true],
      ['uppercase letters violate pattern', 'Hello-World', false],
      ['underscore violates pattern', 'hello_world', false],
    ])('pattern constraint — %s', (_label, slug, valid) => {
      const schema = jsonSchemaToZod({
        type: 'object',
        properties: {slug: {type: 'string', pattern: '^[a-z0-9-]+$'}},
        required: ['slug'],
      })

      expect(schema.safeParse({slug}).success).toBe(valid)
    })
  })

  describe('array constraints', () => {
    it.each([
      ['at minItems boundary', ['a'], true],
      ['at maxItems boundary', ['a', 'b', 'c'], true],
      ['below minItems', [], false],
      ['above maxItems', ['a', 'b', 'c', 'd'], false],
    ])('item count bounds [1, 3] — %s', (_label, ids, valid) => {
      const schema = jsonSchemaToZod({
        type: 'object',
        properties: {ids: {type: 'array', items: {type: 'string'}, minItems: 1, maxItems: 3}},
        required: ['ids'],
      })

      expect(schema.safeParse({ids}).success).toBe(valid)
    })
  })

  describe('default values', () => {
    it.each([
      ['string', {type: 'string', default: 'en'}, 'en'],
      ['number', {type: 'number', default: 42}, 42],
      ['boolean', {type: 'boolean', default: false}, false],
    ])('%s default applied when field is absent', (_type, propSchema, defaultValue) => {
      const schema = jsonSchemaToZod({
        type: 'object',
        properties: {val: propSchema},
      })

      const result = schema.safeParse({})
      expect(result.success).toBe(true)
      expect(result.data.val).toBe(defaultValue)
    })

    it('explicit value takes precedence over default', () => {
      const schema = jsonSchemaToZod({
        type: 'object',
        properties: {lang: {type: 'string', default: 'en'}},
      })

      const result = schema.safeParse({lang: 'fr'})
      expect(result.success).toBe(true)
      expect(result.data.lang).toBe('fr')
    })
  })
})
