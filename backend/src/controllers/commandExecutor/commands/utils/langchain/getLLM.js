import Integration from '../../../../../models/Integration'
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
  OPENAI_API_KEY,
  QWEN_DEFAULT_MODEL,
  YANDEX_DEFAULT_MODEL,
} from '../../../../../constants'
import {OpenAIEmbeddings} from 'langchain/embeddings/openai'
import {readLangParam} from '../../../constants'
import {Lang} from '../../../constants/localizedPrompts'
import {EmbStorageType} from '../../../../../shared/config/constants'
import {ChatOpenAI} from 'langchain/chat_models/openai'
import {
  QWEN_API_URL,
  DEEPSEEK_API_URL,
  USER_DEFAULT_LANGUAGE,
  USER_DEFAULT_MODEL,
} from '../../../../../shared/config/constants'
import {ChatClaude} from './Anthropic'
import {CustomLLMChat, CustomEmbeddings} from './CustomLLMChat'

export const Model = {
  YandexGPT: 'YandexGPT',
  OpenAI: 'OpenAI',
  Claude: 'Claude',
  Qwen: 'Qwen',
  Deepseek: 'Deepseek',
  CustomLLM: 'CustomLLM',
}

export const determineLLMType = (command, settings) => {
  const {lang = undefined, model = USER_DEFAULT_MODEL} = settings || {}

  if (model && model !== USER_DEFAULT_MODEL) return model

  if (lang && lang !== USER_DEFAULT_LANGUAGE) {
    return lang === Lang.ru ? Model.YandexGPT : Model.OpenAI
  }

  if (command && readLangParam(command) === Lang.ru) {
    return Model.YandexGPT
  }

  return Model.OpenAI
}

export const getIntegrationSettings = async userId => {
  const settings = await Integration.findOne({userId}).lean()
  if (!settings) {
    throw Error('Integration not found')
  }

  return settings
}

export const getLLM = ({type, settings, log}) => {
  switch (type) {
    case Model.OpenAI: {
      const {apiKey: openAIApiKey = OPENAI_API_KEY} = settings?.openai || {}
      const {model: modelName, chunkSize} = getOpenaiModelSettings(settings?.openai?.model)

      let temperature = 0.7

      if (modelNotSupportTemperature.includes(modelName)) {
        temperature = undefined
      }

      const llm = new ChatOpenAI({
        temperature,
        maxRetries: 20,
        openAIApiKey,
        modelName,
      })

      return {llm, chunkSize}
    }
    case Model.Claude: {
      const {apiKey, model: modelName} = settings?.claude || {}
      const chunkSize = getClaudeMaxTokens(modelName)

      const llm = new ChatClaude({
        model: modelName,
        apiKey,
        maxRetries: 3,
      })

      return {llm, chunkSize}
    }
    case Model.Qwen: {
      const {apiKey, model: modelName = QWEN_DEFAULT_MODEL} = settings?.qwen || {}
      const chunkSize = getQwenMaxInput(modelName)

      const llm = new ChatOpenAI({
        openAIApiKey: apiKey,
        modelName,
        configuration: {
          basePath: QWEN_API_URL,
        },
        topP: 0.7,
      })
      return {llm, chunkSize}
    }
    case Model.Deepseek: {
      const {apiKey, model: modelName = DEEPSEEK_DEFAULT_MODEL} = settings?.deepseek || {}
      const chunkSize = getDeepseekMaxInput()

      const llm = new ChatOpenAI({
        openAIApiKey: apiKey,
        modelName,
        configuration: {
          basePath: DEEPSEEK_API_URL,
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

      const embeddings = new OpenAIEmbeddings({
        openAIApiKey: apiKey || OPENAI_API_KEY,
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

      const embeddings = new OpenAIEmbeddings(
        {
          openAIApiKey: apiKey,
          modelName: 'text-embedding-v3',
        },
        {
          basePath: QWEN_API_URL,
        },
      )

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
