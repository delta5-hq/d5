import {z} from 'zod'

const jsonTypeToZod = (jsonType, itemSchema) => {
  switch (jsonType) {
    case 'string':
      return z.string()
    case 'number':
      return z.number()
    case 'integer':
      return z.number().int()
    case 'boolean':
      return z.boolean()
    case 'array':
      return itemSchema ? z.array(jsonTypeToZod(itemSchema.type, itemSchema.items)) : z.array(z.any())
    case 'object':
      return z.record(z.string(), z.any())
    default:
      return z.any()
  }
}

export const jsonSchemaToZod = inputSchema => {
  if (!inputSchema) {
    return z.object({})
  }

  if (inputSchema.type && inputSchema.type !== 'object') {
    return z.object({})
  }

  const properties = inputSchema.properties || {}
  const required = inputSchema.required || []

  const zodShape = {}

  for (const [propName, propSchema] of Object.entries(properties)) {
    const propType = propSchema.type
    let zodType = jsonTypeToZod(propType, propSchema.items)

    if (!required.includes(propName)) {
      zodType = zodType.optional()
    }

    zodShape[propName] = zodType
  }

  return z.object(zodShape)
}
