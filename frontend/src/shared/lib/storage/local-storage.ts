export const safeLocalStorage = {
  getItem: (key: string): string | null => {
    if (typeof window === 'undefined') return null

    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  },

  setItem: (key: string, value: string): void => {
    if (typeof window === 'undefined') return

    try {
      localStorage.setItem(key, value)
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn(`localStorage.setItem failed for key "${key}":`, error)
    }
  },

  removeItem: (key: string): void => {
    if (typeof window === 'undefined') return

    try {
      localStorage.removeItem(key)
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn(`localStorage.removeItem failed for key "${key}":`, error)
    }
  },

  getBoolean: (key: string): boolean | null => {
    const value = safeLocalStorage.getItem(key)
    return value === 'true' ? true : value === 'false' ? false : null
  },

  setBoolean: (key: string, value: boolean): void => {
    safeLocalStorage.setItem(key, value.toString())
  },
}
