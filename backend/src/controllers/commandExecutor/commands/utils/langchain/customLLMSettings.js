import {CustomLLMApiType} from '../../../../../constants'

const trimString = value => (typeof value === 'string' ? value.trim() : '')

const stripTrailingSlash = value => value.replace(/\/+$/, '')

const validateHttpUrl = apiRootUrl => {
  let parsed
  try {
    parsed = new URL(apiRootUrl)
  } catch (_err) {
    throw new Error('Custom LLM API root URL is invalid. Set a full http(s) URL in Integration Settings.')
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Custom LLM API root URL must start with http:// or https://. Update Integration Settings.')
  }
}

export const resolveCustomLLMSettings = settings => {
  const customSettings = settings?.custom_llm ?? {}
  const apiRootUrl = stripTrailingSlash(trimString(customSettings.apiRootUrl))

  if (!apiRootUrl) {
    throw new Error('Custom LLM API root URL not configured. Set it in Integration Settings before running /custom.')
  }

  validateHttpUrl(apiRootUrl)

  return {
    ...customSettings,
    apiRootUrl,
    apiType: customSettings.apiType || CustomLLMApiType.OpenAI_Compatible,
    apiKey: trimString(customSettings.apiKey),
  }
}
