export const SUPPORTED_LOCALES = ['en', 'ru'] as const
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]

const STORAGE_KEY = 'd5-locale'

export function resolveLocale(raw: string | null | undefined): SupportedLocale {
  if (raw === 'ru') return 'ru'
  return 'en'
}

export function readStoredLocale(): SupportedLocale {
  try {
    return resolveLocale(localStorage.getItem(STORAGE_KEY))
  } catch {
    return 'en'
  }
}

export function writeStoredLocale(locale: SupportedLocale): void {
  try {
    localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    // ignored — localStorage may be unavailable (private browsing, quota exceeded)
  }
}
