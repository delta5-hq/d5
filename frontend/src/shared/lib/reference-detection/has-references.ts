const REFERENCE_PATTERN = /@@|##/

export function hasReferencesInText(text: string | undefined): boolean {
  return Boolean(text && REFERENCE_PATTERN.test(text))
}

export function hasReferencesInAny(...texts: Array<string | undefined>): boolean {
  return texts.some(hasReferencesInText)
}
