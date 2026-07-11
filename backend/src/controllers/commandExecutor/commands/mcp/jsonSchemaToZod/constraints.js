export const applyStringConstraints = (zodString, schema) => {
  let result = zodString
  if (schema.minLength !== undefined) result = result.min(schema.minLength)
  if (schema.maxLength !== undefined) result = result.max(schema.maxLength)
  if (schema.pattern) result = result.regex(new RegExp(schema.pattern))
  return result
}

export const applyNumberConstraints = (zodNumber, schema) => {
  let result = zodNumber
  if (schema.minimum !== undefined) result = result.min(schema.minimum)
  if (schema.maximum !== undefined) result = result.max(schema.maximum)
  if (schema.exclusiveMinimum !== undefined) result = result.gt(schema.exclusiveMinimum)
  if (schema.exclusiveMaximum !== undefined) result = result.lt(schema.exclusiveMaximum)
  return result
}

export const applyArrayConstraints = (zodArray, schema) => {
  let result = zodArray
  if (schema.minItems !== undefined) result = result.min(schema.minItems)
  if (schema.maxItems !== undefined) result = result.max(schema.maxItems)
  return result
}
