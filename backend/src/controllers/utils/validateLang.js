import {LANGUAGES} from '../../shared/config/constants'

export function validateLang(lang) {
  return LANGUAGES.find(({code}) => code === lang)
}
