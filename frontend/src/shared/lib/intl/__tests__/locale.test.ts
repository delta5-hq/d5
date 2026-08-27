import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SUPPORTED_LOCALES, resolveLocale, readStoredLocale, writeStoredLocale } from '../locale'

const STORAGE_KEY = 'd5-locale'

let storageMock: Record<string, string> = {}

function installLocalStorageMock() {
  Object.defineProperty(window, 'localStorage', {
    writable: true,
    configurable: true,
    value: {
      getItem: vi.fn((key: string) => storageMock[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        storageMock[key] = value
      }),
      removeItem: vi.fn((key: string) => {
        delete storageMock[key]
      }),
      clear: vi.fn(() => {
        storageMock = {}
      }),
    },
  })
}

beforeEach(() => {
  storageMock = {}
  installLocalStorageMock()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('SUPPORTED_LOCALES', () => {
  it('is a non-empty readonly tuple', () => {
    expect(SUPPORTED_LOCALES.length).toBeGreaterThan(0)
  })

  it('contains English', () => {
    expect(SUPPORTED_LOCALES).toContain('en')
  })

  it('contains Russian', () => {
    expect(SUPPORTED_LOCALES).toContain('ru')
  })

  it('has no duplicate entries', () => {
    expect(new Set(SUPPORTED_LOCALES).size).toBe(SUPPORTED_LOCALES.length)
  })
})

describe('resolveLocale — every supported locale is a fixed point', () => {
  it.each(SUPPORTED_LOCALES)('resolveLocale(%j) → %j', locale => {
    expect(resolveLocale(locale)).toBe(locale)
  })
})

describe('resolveLocale — unsupported and absent values fall back to English', () => {
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['empty string', ''],
    ['"none" (USER_DEFAULT_LANGUAGE sentinel)', 'none'],
    ['unknown locale code', 'fr'],
    ['unknown locale code', 'de'],
    ['unknown locale code', 'zh'],
    ['uppercase "RU" — locale codes are case-sensitive', 'RU'],
    ['uppercase "EN"', 'EN'],
    ['mixed-case variant', 'Ru'],
    ['whitespace around code', ' ru'],
    ['numeric string', '1'],
  ] as const)('%s → "en"', (_label, input) => {
    expect(resolveLocale(input as string | null | undefined)).toBe('en')
  })
})

describe('readStoredLocale — absent key returns the default locale', () => {
  it('returns "en" when localStorage has no locale entry', () => {
    expect(readStoredLocale()).toBe('en')
  })
})

describe('readStoredLocale — stored supported locale is returned as-is', () => {
  it.each(SUPPORTED_LOCALES)('stored %j → readStoredLocale() returns %j', locale => {
    storageMock[STORAGE_KEY] = locale
    expect(readStoredLocale()).toBe(locale)
  })
})

describe('readStoredLocale — stored unsupported value falls back to English', () => {
  it.each(['none', 'fr', 'de', '', 'RU'])('stored %j → "en"', stored => {
    storageMock[STORAGE_KEY] = stored
    expect(readStoredLocale()).toBe('en')
  })
})

describe('readStoredLocale — tolerates unavailable storage', () => {
  it('returns "en" when localStorage.getItem throws', () => {
    Object.defineProperty(window, 'localStorage', {
      writable: true,
      configurable: true,
      value: {
        getItem: () => {
          throw new Error('storage unavailable')
        },
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
    })
    expect(readStoredLocale()).toBe('en')
  })
})

describe('writeStoredLocale — persists locale to the correct storage key', () => {
  it.each(SUPPORTED_LOCALES)('writeStoredLocale(%j) persists the locale to the storage key', locale => {
    writeStoredLocale(locale)
    expect(storageMock[STORAGE_KEY]).toBe(locale)
  })
})

describe('writeStoredLocale — overwrites a previously stored value', () => {
  it('second write replaces the first', () => {
    writeStoredLocale('en')
    writeStoredLocale('ru')
    expect(storageMock[STORAGE_KEY]).toBe('ru')
  })
})

describe('writeStoredLocale — tolerates unavailable storage', () => {
  it('does not throw when localStorage.setItem throws', () => {
    Object.defineProperty(window, 'localStorage', {
      writable: true,
      configurable: true,
      value: {
        getItem: vi.fn(),
        setItem: () => {
          throw new Error('quota exceeded')
        },
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
    })
    expect(() => writeStoredLocale('ru')).not.toThrow()
  })
})

describe('writeStoredLocale → readStoredLocale round-trip', () => {
  it.each(SUPPORTED_LOCALES)('write then read returns the same locale: %j', locale => {
    writeStoredLocale(locale)
    expect(readStoredLocale()).toBe(locale)
  })
})
