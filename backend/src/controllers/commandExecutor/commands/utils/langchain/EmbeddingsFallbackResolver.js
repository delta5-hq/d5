import {Model} from './IntegrationSettingsLoader'

const isNonBlankString = value => typeof value === 'string' && value.trim().length > 0

const EMBEDDINGS_CAPABLE_PROVIDERS = [
  {
    type: Model.OpenAI,
    hasCredential: settings => isNonBlankString(settings?.openai?.apiKey),
  },
  {
    type: Model.Qwen,
    hasCredential: settings => isNonBlankString(settings?.qwen?.apiKey),
  },
  {
    type: Model.CustomLLM,
    hasCredential: settings => isNonBlankString(settings?.custom_llm?.apiRootUrl),
  },
  {
    type: Model.YandexGPT,
    hasCredential: settings =>
      isNonBlankString(settings?.yandex?.apiKey) && isNonBlankString(settings?.yandex?.folder_id),
  },
]

const EMBEDDINGS_CAPABLE_PROVIDER_NAMES = EMBEDDINGS_CAPABLE_PROVIDERS.map(p => p.type).join(', ')

export const resolveEmbeddingsFallbackType = settings => {
  for (const {type, hasCredential} of EMBEDDINGS_CAPABLE_PROVIDERS) {
    if (hasCredential(settings)) return type
  }

  throw new Error(
    `No embeddings provider configured. Commands that require embeddings (/outline, /summarize, /web, /scholar, /ext, /memorize) need credentials for at least one of: ${EMBEDDINGS_CAPABLE_PROVIDER_NAMES}. Add a key in Settings → Integrations.`,
  )
}

export const NATIVE_EMBEDDINGS_TYPES = new Set(EMBEDDINGS_CAPABLE_PROVIDERS.map(p => p.type))
