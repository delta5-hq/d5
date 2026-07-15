import {z} from 'zod'

export const buildObjectSchema = (schema, recurse) => {
  const properties = schema.properties || {}
  const required = schema.required || []

  if (Object.keys(properties).length === 0) {
    return z.record(z.string(), z.any())
  }

  const shape = {}
  for (const [name, propSchema] of Object.entries(properties)) {
    const zodType = recurse(propSchema)
    shape[name] = required.includes(name) || propSchema?.default !== undefined ? zodType : zodType.optional()
  }

  return z.object(shape).passthrough()
}
