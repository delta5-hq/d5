const applyDescription = (zodType, schema) => (schema.description ? zodType.describe(schema.description) : zodType)

const applyDefault = (zodType, schema) => (schema.default !== undefined ? zodType.default(schema.default) : zodType)

const applyNullable = (zodType, schema) =>
  Array.isArray(schema.type) && schema.type.includes('null') ? zodType.nullable() : zodType

export const applyDecorators = (zodType, schema) =>
  applyNullable(applyDefault(applyDescription(zodType, schema), schema), schema)
