import {YandexGPT, YandexGPTEmbeddings} from './YandexGPT'
import {
  getClaudeMaxTokens,
  getDeepseekMaxInput,
  getOpenaiModelSettings,
  getQwenMaxInput,
  getYandexModelSettings,
  modelNotSupportTemperature,
} from './getModelSettings'
import {
  DEEPSEEK_DEFAULT_MODEL,
  CUSTOM_LLM_DEFAULT_MODEL,
  OPENAI_COMPATIBLE_API_TYPES,
  QWEN_DEFAULT_MODEL,
  YANDEX_DEFAULT_MODEL,
} from '../../../../../constants'
import {OpenAIEmbeddings} from '@langchain/openai'
import {EmbStorageType} from '../../../../../shared/config/constants'
import {ChatOpenAI} from '@langchain/openai'
import {QWEN_API_URL, DEEPSEEK_API_URL} from '../../../../../shared/config/constants'
import {ChatClaude} from './Anthropic'
import {CustomLLMChat, CustomEmbeddings} from './CustomLLMChat'
import {createNoopEmbeddings, createNoopLLM} from './noopLLM'
import {Model, detectConfiguredProvider, loadIntegrationSettings} from './IntegrationSettingsLoader'
import {NATIVE_EMBEDDINGS_TYPES, resolveEmbeddingsFallbackType} from './EmbeddingsFallbackResolver'
import {
  getCachedIntegrationSettings,
  hasCachedIntegrationSettings,
  setCachedIntegrationSettings,
} from './IntegrationSettingsCache'
import IntegrationFacade from '../../../../../repositories/IntegrationFacade'
import {USER_DEFAULT_MODEL} from '../../../../../shared/config/constants'
import {resolveSettings} from './IntegrationSettingsResolver'
import {canUseMockExternalServices} from './MockExternalServices'
import {resolveCustomLLMSettings} from './customLLMSettings'

export {Model}

export const determineLLMType = settings => {
  const {model = 'auto'} = settings || {}

  if (model && model !== 'auto') return model

  return detectConfiguredProvider(settings) || Model.OpenAI
}

export const getIntegrationSettings = async (userId, workflowId = null, store = null) => {
  if (store?._integrationSettingsCache) {
    return store._integrationSettingsCache
  }

  if (canUseMockExternalServices()) {
    const {settings} = resolveSettings({merged: null, workflowDoc: null, userId, workflowId})
    if (store) {
      store._integrationSettingsCache = settings
    }
    return settings
  }

  const fetched = await IntegrationFacade.findMergedDecryptedWithMetadata(userId, workflowId)
  const {settings, workflowDoc} = resolveSettings({...fetched, userId, workflowId})

  if (workflowDoc && settings.model === USER_DEFAULT_MODEL) {
    const workflowProvider = detectConfiguredProvider(workflowDoc)
    if (workflowProvider) {
      settings.model = workflowProvider
    }
  }

  if (store) {
    store._integrationSettingsCache = settings
  }

  return settings
}

export const getLLM = ({type, settings, log, thinkingBudgetTokens = null}) => {
  if (canUseMockExternalServices()) {
    return createNoopLLM()
  }
  switch (type) {
    case Model.OpenAI: {
      const {apiKey} = settings?.openai || {}
      if (!apiKey) {
        throw new Error(
          'OpenAI API key not configured. Set it in Integration Settings or set the OPENAI_API_KEY environment variable.',
        )
      }
      const {model: modelName, chunkSize} = getOpenaiModelSettings(settings?.openai?.model)

      let temperature = 0.7

      if (modelNotSupportTemperature.includes(modelName)) {
        temperature = undefined
      }

      const llm = new ChatOpenAI({
        temperature,
        maxRetries: 20,
        apiKey,
        model: modelName,
      })

      return {llm, chunkSize}
    }
    case Model.Claude: {
      const {apiKey, model: modelName} = settings?.claude || {}
      if (!apiKey) {
        throw new Error(
          'Claude API key not configured. Set it in Integration Settings or set the CLAUDE_API_KEY environment variable.',
        )
      }
      const chunkSize = getClaudeMaxTokens(modelName)

      const llm = new ChatClaude({
        model: modelName,
        apiKey,
        maxRetries: 3,
        ...(thinkingBudgetTokens !== null && {thinkingBudgetTokens}),
      })

      return {llm, chunkSize}
    }
    case Model.Qwen: {
      const {apiKey, model: modelName = QWEN_DEFAULT_MODEL} = settings?.qwen || {}
      if (!apiKey) {
        throw new Error(
          'Qwen API key not configured. Set it in Integration Settings or set the QWEN_API_KEY environment variable.',
        )
      }
      const chunkSize = getQwenMaxInput(modelName)

      const llm = new ChatOpenAI({
        apiKey,
        model: modelName,
        configuration: {
          baseURL: QWEN_API_URL,
        },
        topP: 0.7,
      })
      return {llm, chunkSize}
    }
    case Model.Deepseek: {
      const {apiKey, model: modelName = DEEPSEEK_DEFAULT_MODEL} = settings?.deepseek || {}
      if (!apiKey) {
        throw new Error(
          'Deepseek API key not configured. Set it in Integration Settings or set the DEEPSEEK_API_KEY environment variable.',
        )
      }
      const chunkSize = getDeepseekMaxInput()

      const llm = new ChatOpenAI({
        apiKey,
        model: modelName,
        configuration: {
          baseURL: DEEPSEEK_API_URL,
        },
      })
      return {llm, chunkSize}
    }
    case Model.CustomLLM: {
      const {apiRootUrl, apiType, apiKey, maxTokens = 30000, model} = resolveCustomLLMSettings(settings)

      const resolvedModel = model || (OPENAI_COMPATIBLE_API_TYPES.has(apiType) ? CUSTOM_LLM_DEFAULT_MODEL : undefined)

      const llm = new CustomLLMChat({
        apiType,
        apiRootUrl,
        apiKey,
        model: resolvedModel,
      })

      return {llm, chunkSize: maxTokens}
    }
    default: {
      const {apiKey, folder_id} = settings?.yandex || {}
      if (!apiKey || !folder_id) {
        throw new Error(
          'YandexGPT API key and folder ID not configured. Set them in Integration Settings or set the YANDEX_API_KEY and YANDEX_FOLDER_ID environment variables.',
        )
      }
      const {model: modelName, chunkSize} = getYandexModelSettings(settings?.yandex?.model)

      const llm = new YandexGPT({
        modelURI: `gpt://${folder_id}/${modelName || YANDEX_DEFAULT_MODEL}`,
        apiKey,
        temperature: 0.2,
        maxRetries: 20,
        maxTokens: chunkSize,
        log,
      })

      return {llm, chunkSize}
    }
  }
}

const buildNativeEmbeddings = (type, settings) => {
  switch (type) {
    case Model.OpenAI: {
      const {apiKey} = settings?.openai || {}
      if (!apiKey) {
        throw new Error(
          'OpenAI API key not configured for embeddings. Set it in Integration Settings or set the OPENAI_API_KEY environment variable.',
        )
      }

      return {
        embeddings: new OpenAIEmbeddings({apiKey}),
        chunkSize: 8191,
        similarityThreshold: 0.75,
        storageType: EmbStorageType.openai,
      }
    }
    case Model.CustomLLM: {
      const {apiRootUrl, embeddingsChunkSize} = settings?.custom_llm ?? {}

      return {
        embeddings: new CustomEmbeddings({apiRootUrl}),
        chunkSize: embeddingsChunkSize || 2048,
        similarityThreshold: 0.3,
        storageType: EmbStorageType.custom_llm,
      }
    }
    case Model.Qwen: {
      const {apiKey} = settings?.qwen ?? {}

      return {
        embeddings: new OpenAIEmbeddings({
          apiKey,
          model: 'text-embedding-v3',
          configuration: {
            baseURL: QWEN_API_URL,
          },
        }),
        chunkSize: 4096,
        similarityThreshold: 0.75,
        storageType: EmbStorageType.qwen,
      }
    }
    default: {
      const {apiKey, folder_id: folderID} = settings?.yandex || {}

      return {
        embeddings: new YandexGPTEmbeddings({apiKey, folderID}),
        chunkSize: 2048,
        similarityThreshold: 0.3,
        storageType: EmbStorageType.yandex,
      }
    }
  }
}

export const getEmbeddings = ({type, settings}) => {
  if (canUseMockExternalServices()) {
    return {
      ...createNoopEmbeddings(),
      storageType: EmbStorageType.openai,
    }
  }

  const resolvedType = NATIVE_EMBEDDINGS_TYPES.has(type) ? type : resolveEmbeddingsFallbackType(settings)
  return buildNativeEmbeddings(resolvedType, settings)
}
