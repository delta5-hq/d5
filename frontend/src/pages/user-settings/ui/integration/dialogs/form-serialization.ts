export const serializeArrayToSpaceSeparated = (value: unknown): string | undefined => {
  if (!Array.isArray(value)) return value as string | undefined
  return value.join(' ')
}

export const serializeArrayToCommaSeparated = (value: unknown): string | undefined => {
  if (!Array.isArray(value)) return value as string | undefined
  return value.join(', ')
}

export const serializeObjectToKeyValueLines = (value: unknown): string | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value as string | undefined
  }
  return Object.entries(value)
    .map(([key, val]) => `${key}=${val}`)
    .join('\n')
}

export const deserializeSpaceSeparatedToArray = (value: string | undefined): string[] => {
  if (!value) return []
  return value.split(' ').filter(Boolean)
}

export const deserializeCommaSeparatedToArray = (value: string | undefined): string[] => {
  if (!value) return []
  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
}

export const deserializeKeyValueLinesToObject = (value: string | undefined): Record<string, string> => {
  if (!value) return {}
  const result: Record<string, string> = {}
  value.split('\n').forEach(line => {
    const trimmed = line.trim()
    if (trimmed && trimmed.includes('=')) {
      const [key, ...valueParts] = trimmed.split('=')
      result[key.trim()] = valueParts.join('=').trim()
    }
  })
  return result
}
