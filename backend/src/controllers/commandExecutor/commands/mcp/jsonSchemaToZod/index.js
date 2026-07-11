import {z} from 'zod'
import {buildZodType} from './typeDispatch'

export const jsonSchemaToZod = inputSchema => {
  if (!inputSchema || (inputSchema.type && inputSchema.type !== 'object' && !inputSchema.properties)) {
    return z.object({})
  }

  const properties = inputSchema.properties || {}
  const required = inputSchema.required || []

  const shape = {}
  for (const [name, propSchema] of Object.entries(properties)) {
    const zodType = buildZodType(propSchema)
    shape[name] = required.includes(name) ? zodType : zodType.optional()
  }

  return z.object(shape).passthrough()
}
