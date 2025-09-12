import googleTranslate from '@iamtraction/google-translate'
import {PromptTemplate} from 'langchain'
import {USER_DEFAULT_LANGUAGE} from '../../../../shared/config/constants'

function sanitizeQuotes(input) {
  return input.replace(/[«»„“”‘’]/g, '"')
}

export async function translateWithGoogle(input, lang) {
  const result = (await googleTranslate(input, {to: lang})).text

  return sanitizeQuotes(result)
}

export async function translateWithLLM(input, lang, llm) {
  return llm.call(
    await PromptTemplate.fromTemplate('{input}\nCopy translating each English word into {lang}').format({
      input,
      lang,
    }),
  )
}

export async function translate(str, outputLang, llm, logError) {
  const translators = [
    (input, lang) => translateWithGoogle(input, lang),
    (input, lang) => translateWithLLM(input, lang, llm),
  ]

  for (const translator of translators) {
    try {
      const result = await translator(str, outputLang)

      if (result) {
        return result
      }
    } catch (e) {
      logError('translation failed', e)
    }
  }

  return str
}

export async function conditionallyTranslate(str, outputLang, llm, logError, settings) {
  const {lang = undefined} = settings || {}

  const determinatedLang = outputLang || lang
  if (!determinatedLang || determinatedLang === USER_DEFAULT_LANGUAGE) return str

  return translate(str, determinatedLang, llm, logError)
}
