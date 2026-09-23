import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { renderHook } from '@testing-library/react'
import { type ReactNode } from 'react'
import { useIntl } from 'react-intl'
import { LocaleProvider, useLocale } from '../locale-context'
import { SUPPORTED_LOCALES } from '../locale'
import messages from '..'

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

const wrapper = ({ children }: { children: ReactNode }) => <LocaleProvider>{children}</LocaleProvider>

const EN_VERDICT_TITLE = messages.en['workflowTree.verdictDrawer.title']
const RU_VERDICT_TITLE = messages.ru['workflowTree.verdictDrawer.title']

const MessageProbe = () => {
  const intl = useIntl()
  return <span data-testid="probe">{intl.formatMessage({ id: 'workflowTree.verdictDrawer.title' })}</span>
}

const LocaleDisplay = () => {
  const { locale } = useLocale()
  return <span data-testid="locale">{locale}</span>
}

const LocaleSetter = ({ target }: { target: string }) => {
  const { setLocale } = useLocale()
  return (
    <button data-testid="switch" onClick={() => setLocale(target)} type="button">
      switch
    </button>
  )
}

describe('useLocale — default locale when localStorage is empty', () => {
  it('returns "en" as the initial locale', () => {
    const { result } = renderHook(() => useLocale(), { wrapper })
    expect(result.current.locale).toBe('en')
  })
})

describe('useLocale — initial locale is read from localStorage on mount', () => {
  it.each(SUPPORTED_LOCALES)('stored %j → initial locale is %j', locale => {
    storageMock[STORAGE_KEY] = locale
    const { result } = renderHook(() => useLocale(), { wrapper })
    expect(result.current.locale).toBe(locale)
  })

  it.each([
    ['unknown locale code', 'fr'],
    ['"none" (USER_DEFAULT_LANGUAGE sentinel)', 'none'],
  ] as const)('stored %s → initial locale falls back to "en"', (_label, stored) => {
    storageMock[STORAGE_KEY] = stored
    const { result } = renderHook(() => useLocale(), { wrapper })
    expect(result.current.locale).toBe('en')
  })
})

describe('setLocale — transitions to the target locale from any starting locale', () => {
  it.each(SUPPORTED_LOCALES.flatMap(from => SUPPORTED_LOCALES.map(to => [from, to] as const)))(
    'from %j: setLocale(%j) → locale becomes the target',
    (from, to) => {
      storageMock[STORAGE_KEY] = from
      const { result } = renderHook(() => useLocale(), { wrapper })
      act(() => result.current.setLocale(to))
      expect(result.current.locale).toBe(to)
    },
  )
})

describe('setLocale — unsupported input resolves to English', () => {
  it.each([
    ['none', 'en'],
    ['fr', 'en'],
    ['', 'en'],
    ['RU', 'en'],
  ] as const)('setLocale(%j) → locale is "en"', (input, expected) => {
    const { result } = renderHook(() => useLocale(), { wrapper })
    act(() => result.current.setLocale(input))
    expect(result.current.locale).toBe(expected)
  })
})

describe('setLocale — persists the resolved locale to localStorage', () => {
  it.each(SUPPORTED_LOCALES)('setLocale(%j) writes the locale to storage', locale => {
    const { result } = renderHook(() => useLocale(), { wrapper })
    act(() => result.current.setLocale(locale))
    expect(storageMock[STORAGE_KEY]).toBe(locale)
  })

  it('setLocale with unsupported value writes "en" (resolved) to storage', () => {
    const { result } = renderHook(() => useLocale(), { wrapper })
    act(() => result.current.setLocale('fr'))
    expect(storageMock[STORAGE_KEY]).toBe('en')
  })

  it('successive calls overwrite the previous stored value', () => {
    const { result } = renderHook(() => useLocale(), { wrapper })
    act(() => result.current.setLocale('ru'))
    act(() => result.current.setLocale('en'))
    expect(storageMock[STORAGE_KEY]).toBe('en')
  })
})

describe('LocaleProvider — tolerates storage fault at mount', () => {
  it('mounts with "en" when localStorage.getItem throws on init', () => {
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
    const { result } = renderHook(() => useLocale(), { wrapper })
    expect(result.current.locale).toBe('en')
  })
})

describe('LocaleProvider — setLocale transitions locale state independent of write success', () => {
  it('locale becomes the target locale even when localStorage.setItem throws', () => {
    const { result } = renderHook(() => useLocale(), { wrapper })
    Object.defineProperty(window, 'localStorage', {
      writable: true,
      configurable: true,
      value: {
        getItem: vi.fn((key: string) => storageMock[key] ?? null),
        setItem: () => {
          throw new Error('quota exceeded')
        },
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
    })
    act(() => result.current.setLocale('ru'))
    expect(result.current.locale).toBe('ru')
  })
})

describe('LocaleProvider — wires locale changes into the IntlProvider message set', () => {
  it('default locale renders EN messages', () => {
    render(
      <LocaleProvider>
        <MessageProbe />
      </LocaleProvider>,
    )
    expect(screen.getByTestId('probe').textContent).toBe(EN_VERDICT_TITLE)
  })

  it('locale "ru" renders RU messages', () => {
    storageMock[STORAGE_KEY] = 'ru'
    render(
      <LocaleProvider>
        <MessageProbe />
      </LocaleProvider>,
    )
    expect(screen.getByTestId('probe').textContent).toBe(RU_VERDICT_TITLE)
  })

  it('EN and RU verdict-drawer titles are distinct — confirms the test is meaningful', () => {
    expect(EN_VERDICT_TITLE).toBeTruthy()
    expect(RU_VERDICT_TITLE).toBeTruthy()
    expect(EN_VERDICT_TITLE).not.toBe(RU_VERDICT_TITLE)
  })

  it('calling setLocale("ru") live-switches from EN to RU messages', () => {
    render(
      <LocaleProvider>
        <MessageProbe />
        <LocaleSetter target="ru" />
      </LocaleProvider>,
    )
    expect(screen.getByTestId('probe').textContent).toBe(EN_VERDICT_TITLE)
    act(() => screen.getByTestId('switch').click())
    expect(screen.getByTestId('probe').textContent).toBe(RU_VERDICT_TITLE)
  })

  it('calling setLocale("en") switches back from RU to EN messages', () => {
    storageMock[STORAGE_KEY] = 'ru'
    render(
      <LocaleProvider>
        <MessageProbe />
        <LocaleSetter target="en" />
      </LocaleProvider>,
    )
    expect(screen.getByTestId('probe').textContent).toBe(RU_VERDICT_TITLE)
    act(() => screen.getByTestId('switch').click())
    expect(screen.getByTestId('probe').textContent).toBe(EN_VERDICT_TITLE)
  })
})

describe('LocaleProvider — locale value is accessible via useLocale', () => {
  it('locale is "en" by default', () => {
    render(
      <LocaleProvider>
        <LocaleDisplay />
      </LocaleProvider>,
    )
    expect(screen.getByTestId('locale').textContent).toBe('en')
  })

  it('locale is "ru" when storage has "ru" at mount time', () => {
    storageMock[STORAGE_KEY] = 'ru'
    render(
      <LocaleProvider>
        <LocaleDisplay />
      </LocaleProvider>,
    )
    expect(screen.getByTestId('locale').textContent).toBe('ru')
  })

  it('locale value updates in the DOM when setLocale fires', () => {
    render(
      <LocaleProvider>
        <LocaleDisplay />
        <LocaleSetter target="ru" />
      </LocaleProvider>,
    )
    expect(screen.getByTestId('locale').textContent).toBe('en')
    act(() => screen.getByTestId('switch').click())
    expect(screen.getByTestId('locale').textContent).toBe('ru')
  })
})

describe('LocaleProvider — all consumers within the same tree share locale state', () => {
  const TwoConsumers = () => {
    const { locale: a, setLocale } = useLocale()
    const { locale: b } = useLocale()
    return (
      <>
        <span data-testid="a">{a}</span>
        <span data-testid="b">{b}</span>
        <button data-testid="switch" onClick={() => setLocale('ru')} type="button" />
      </>
    )
  }

  it('both consumers start at the same locale', () => {
    render(
      <LocaleProvider>
        <TwoConsumers />
      </LocaleProvider>,
    )
    expect(screen.getByTestId('a').textContent).toBe(screen.getByTestId('b').textContent)
  })

  it('a setLocale call updates all consumers simultaneously', () => {
    render(
      <LocaleProvider>
        <TwoConsumers />
      </LocaleProvider>,
    )
    act(() => screen.getByTestId('switch').click())
    expect(screen.getByTestId('a').textContent).toBe('ru')
    expect(screen.getByTestId('b').textContent).toBe('ru')
  })
})

describe('useLocale — outside LocaleProvider returns context default values', () => {
  it('locale defaults to "en" without a surrounding provider', () => {
    const { result } = renderHook(() => useLocale())
    expect(result.current.locale).toBe('en')
  })

  it('setLocale does not throw when called outside a provider', () => {
    const { result } = renderHook(() => useLocale())
    expect(() => act(() => result.current.setLocale('ru'))).not.toThrow()
  })
})
