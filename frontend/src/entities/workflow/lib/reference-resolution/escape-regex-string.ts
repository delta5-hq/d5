export const escapeRegexString = (str: string): string => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
