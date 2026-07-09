import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { IntlProvider } from 'react-intl'
import messages from '.'
import { type SupportedLocale, readStoredLocale, writeStoredLocale, resolveLocale } from './locale'

interface LocaleContextValue {
  locale: SupportedLocale
  setLocale: (next: string) => void
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: 'en',
  setLocale: () => undefined,
})

export const useLocale = () => useContext(LocaleContext)

export const LocaleProvider = ({ children }: { children: ReactNode }) => {
  const [locale, setLocaleState] = useState<SupportedLocale>(readStoredLocale)

  const setLocale = useCallback((next: string) => {
    const resolved = resolveLocale(next)
    writeStoredLocale(resolved)
    setLocaleState(resolved)
  }, [])

  return (
    <LocaleContext.Provider value={{ locale, setLocale }}>
      <IntlProvider locale={locale} messages={messages[locale]}>
        {children}
      </IntlProvider>
    </LocaleContext.Provider>
  )
}
