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
  CustomLLMApiType,
  QWEN_DEFAULT_MODEL,
  YANDEX_DEFAULT_MODEL,
} from '../../../../../constants'
import {OpenAIEmbeddings} from '@langchain/openai'
import {readLangParam} from '../../../constants'
import {Lang} from '../../../constants/localizedPrompts'
import {EmbStorageType} from '../../../../../shared/config/constants'
import {ChatOpenAI} from '@langchain/openai'
import {QWEN_API_URL, DEEPSEEK_API_URL, USER_DEFAULT_LANGUAGE} from '../../../../../shared/config/constants'
import {ChatClaude} from './Anthropic'
import {CustomLLMChat, CustomEmbeddings} from './CustomLLMChat'
import {createNoopLLM} from './noopLLM'
import {Model, detectConfiguredProvider, loadIntegrationSettings} from './IntegrationSettingsLoader'

export {Model}

export const determineLLMType = (command, settings) => {
  const {lang = undefined, model = 'auto'} = settings || {}

  if (model && model !== 'auto') return model

  if (lang && lang !== USER_DEFAULT_LANGUAGE) {
    return lang === Lang.ru ? Model.YandexGPT : Model.OpenAI
  }

  if (command && readLangParam(command) === Lang.ru) {
    return Model.YandexGPT
  }

  return detectConfiguredProvider(settings) || Model.OpenAI
}

export const getIntegrationSettings = async (userId, workflowId = null, store = null) => {
  if (store?._integrationSettingsCache) {
    return store._integrationSettingsCache
  }

  const settings = await loadIntegrationSettings(userId, workflowId)

  if (store) {
    store._integrationSettingsCache = settings
  }

  return settings
}

export const getLLM = ({type, settings, log, thinkingBudgetTokens = null}) => {
  if (process.env.MOCK_EXTERNAL_SERVICES === 'true') {
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
      const {
        apiRootUrl = '',
        apiType = CustomLLMApiType.OpenAI_Compatible,
        maxTokens = 30000,
      } = settings?.custom_llm || {}

      const llm = new CustomLLMChat({
        apiType,
        apiRootUrl,
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

export const getEmbeddings = ({type, settings}) => {
  switch (type) {
    case Model.OpenAI: {
      const {apiKey} = settings?.openai || {}
      if (!apiKey) {
        throw new Error(
          'OpenAI API key not configured for embeddings. Set it in Integration Settings or set the OPENAI_API_KEY environment variable.',
        )
      }

      const embeddings = new OpenAIEmbeddings({
        apiKey,
      })

      const chunkSize = 8191
      const similarityThreshold = 0.75

      return {embeddings, chunkSize, similarityThreshold, storageType: EmbStorageType.openai}
    }
    case Model.CustomLLM: {
      const {apiRootUrl, embeddingsChunkSize} = settings?.custom_llm ?? {}

      const embeddings = new CustomEmbeddings({
        apiRootUrl,
      })

      const chunkSize = embeddingsChunkSize || 2048
      const similarityThreshold = 0.3

      return {embeddings, chunkSize, similarityThreshold, storageType: EmbStorageType.custom_llm}
    }
    case Model.Qwen: {
      const {apiKey} = settings?.qwen ?? {}

      const embeddings = new OpenAIEmbeddings({
        apiKey,
        model: 'text-embedding-v3',
        configuration: {
          baseURL: QWEN_API_URL,
        },
      })

      const chunkSize = 4096
      const similarityThreshold = 0.75

      return {embeddings, chunkSize, similarityThreshold, storageType: EmbStorageType.qwen}
    }
    default: {
      const {apiKey, folder_id: folderID} = settings?.yandex || {}

      const embeddings = new YandexGPTEmbeddings({
        apiKey,
        folderID,
      })
      const chunkSize = 2048
      const similarityThreshold = 0.3

      return {embeddings, chunkSize, similarityThreshold, storageType: EmbStorageType.yandex}
    }
  }
}
