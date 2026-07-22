import {z} from 'zod'
import {applyStringConstraints, applyNumberConstraints} from './constraints'
import {applyDecorators} from './decorators'
import {buildObjectSchema} from './objectBuilder'
import {buildArraySchema} from './arrayBuilder'
import {buildUnionSchema, buildAllOfSchema} from './unionBuilder'

const buildEnumType = values => {
  if (values.every(v => typeof v === 'string')) return z.enum(values)
  return buildUnionSchema(
    values.map(v => z.literal(v)),
    x => x,
  )
}

const buildTypeArraySchema = (schema, recurse) => {
  const nonNullTypes = schema.type.filter(t => t !== 'null')
  if (nonNullTypes.length === 0) return z.null()
  if (nonNullTypes.length === 1) return buildSingleType({...schema, type: nonNullTypes[0]}, recurse)
  return buildUnionSchema(
    nonNullTypes.map(t => ({type: t})),
    recurse,
  )
}

const buildSingleType = (schema, recurse) => {
  switch (schema.type) {
    case 'null':
      return z.null()
    case 'string':
      return applyStringConstraints(z.string(), schema)
    case 'number':
      return applyNumberConstraints(z.number(), schema)
    case 'integer':
      return applyNumberConstraints(z.number().int(), schema)
    case 'boolean':
      return z.boolean()
    case 'array':
      return buildArraySchema(schema, recurse)
    case 'object':
      return buildObjectSchema(schema, recurse)
    default:
      return z.any()
  }
}

const buildRawType = (schema, recurse) => {
  if (schema.const !== undefined) return z.literal(schema.const)
  if (schema.enum) return buildEnumType(schema.enum)
  if (schema.anyOf) return buildUnionSchema(schema.anyOf, recurse)
  if (schema.oneOf) return buildUnionSchema(schema.oneOf, recurse)
  if (schema.allOf) return buildAllOfSchema(schema.allOf, recurse)
  if (Array.isArray(schema.type)) return buildTypeArraySchema(schema, recurse)
  return buildSingleType(schema, recurse)
}

export const buildZodType = schema => {
  if (!schema) return z.any()
  return applyDecorators(buildRawType(schema, buildZodType), schema)
}
