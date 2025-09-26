// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function objectsAreEqual(obj1: Record<string, any>, obj2: Record<string, any>): boolean {
  const keys1 = Object.keys(obj1)
  const keys2 = Object.keys(obj2)

  if (keys1.length !== keys2.length) {
    return false
  }

  for (let i = 0; i < keys1.length; i += 1) {
    const key = keys1[i]
    if (!(key in obj2) || obj1[key] !== obj2[key]) {
      return false
    }
  }

  return true
}
