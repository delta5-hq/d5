export function shallowEqual<T>(a: T, b: T): boolean {
  if (Object.is(a, b)) return true
  if (typeof a !== 'object' || typeof b !== 'object') return false
  if (a === null || b === null) return false

  const keysA = Object.keys(a) as Array<keyof T>
  const keysB = Object.keys(b) as Array<keyof T>

  if (keysA.length !== keysB.length) return false

  for (const key of keysA) {
    if (!Object.is(a[key], b[key])) return false
  }

  return true
}
