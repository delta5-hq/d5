export function normalizeToRecord<T extends { id: string }>(
  raw: T[] | Record<string, T> | undefined,
): Record<string, T> | undefined {
  if (!raw) return undefined
  if (!Array.isArray(raw)) return raw
  return Object.fromEntries(raw.map(item => [item.id, item]))
}
