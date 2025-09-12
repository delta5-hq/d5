import en from './en'

type TranslationValue = string | TranslationGroup

interface TranslationGroup {
  [key: string]: TranslationValue
}

type FlatTranslations = Record<string, string>

const flattenEntries = ([key, value]: [string, TranslationValue]): [string, string][] => {
  if (typeof value === 'object' && !('defaultMessage' in value)) {
    return Object.entries(value)
      .map(([k, v]) => [`${key}.${k}`, v] as [string, TranslationValue])
      .flatMap(flattenEntries)
  }
  return [[key, value as string]]
}

const flatten = (obj: TranslationGroup): FlatTranslations =>
  Object.fromEntries(Object.entries(obj).flatMap(flattenEntries))

const all = {
  en: flatten(en),
}

export default all
