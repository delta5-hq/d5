const FALLBACK_FIELD = 'input'

const firstStringProperty = properties => Object.keys(properties).find(k => properties[k]?.type === 'string')

export const primaryInputField = schema => {
  const properties = schema?.properties
  if (!properties) return FALLBACK_FIELD

  const required = schema.required ?? []
  if (required.length === 1) return required[0]

  const keys = Object.keys(properties)
  if (keys.length === 1) return keys[0]

  if (required.length > 0) return required[0]

  return firstStringProperty(properties) ?? keys[0] ?? FALLBACK_FIELD
}
