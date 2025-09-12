import {EmbStorageType, QWEN_API_URL} from '../../../../../shared/config/constants'
import {determineLLMType, getEmbeddings, Model} from './getLLM'

describe('determineLLMType', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should return the model from settings if it is not default №1', () => {
    const settings = {
      model: Model.OpenAI,
    }
    expect(determineLLMType(undefined, settings)).toBe(Model.OpenAI)
  })

  it('should return the model from settings if it is not default №2', () => {
    const settings = {
      model: Model.YandexGPT,
    }
    expect(determineLLMType(undefined, settings)).toBe(Model.YandexGPT)
  })

  it('should return the model from settings if it is not default №3', () => {
    const settings = {
      model: Model.Claude,
    }
    expect(determineLLMType(undefined, settings)).toBe(Model.Claude)
  })

  it('should return YandexGPT if lang in settings is Lang.ru', () => {
    const settings = {
      lang: 'ru',
    }
    expect(determineLLMType(undefined, settings)).toBe(Model.YandexGPT)
  })

  it('should return OpenAI if lang in settings is not Lang.ru', () => {
    const settings = {
      lang: 'en',
    }
    expect(determineLLMType(undefined, settings)).toBe(Model.OpenAI)
  })

  it('should return YandexGPT if command has --lang=ru', () => {
    expect(determineLLMType('/web prompt --lang=ru', {})).toBe(Model.YandexGPT)
  })

  it('should return OpenAI if command does not have --lang', () => {
    expect(determineLLMType('/web prompt', {})).toBe(Model.OpenAI)
  })
})

describe('getEmbeddingsSettings', () => {
  it('should return correct config for Openai', () => {
    const OPENAI_API_KEY = 'openai_api_key'
    const result = getEmbeddings({
      type: Model.OpenAI,
      settings: {
        openai: {
          apiKey: OPENAI_API_KEY,
        },
      },
    })

    expect(result.embeddings).toEqual(
      expect.objectContaining({
        clientConfig: expect.objectContaining({
          apiKey: OPENAI_API_KEY,
        }),
      }),
    )
    expect(result.storageType).toBe(EmbStorageType.openai)
  })

  it('should return correct config for CustomLLM', () => {
    const API_URL = 'http://localhost:3000/api'
    const result = getEmbeddings({
      type: Model.CustomLLM,
      settings: {
        custom_llm: {
          apiRootUrl: API_URL,
        },
      },
    })

    expect(result.embeddings).toEqual(
      expect.objectContaining({
        apiRootUrl: API_URL,
      }),
    )
    expect(result.storageType).toBe(EmbStorageType.custom_llm)
  })

  it('should return correct config for Qwen', () => {
    const QWEN_API_KEY = 'qwen_api_key'
    const result = getEmbeddings({
      type: Model.Qwen,
      settings: {
        qwen: {
          apiKey: QWEN_API_KEY,
        },
      },
    })

    expect(result.embeddings).toEqual(
      expect.objectContaining({
        clientConfig: expect.objectContaining({
          apiKey: QWEN_API_KEY,
          basePath: QWEN_API_URL,
        }),
      }),
    )
    expect(result.storageType).toBe(EmbStorageType.qwen)
  })

  it('should return default Yandex config if type not matched', () => {
    const YANDEX_API_KEY = 'yandex_api_key'
    const YANDEX_FOLDER_ID = 'yandex_folder_id'
    const result = getEmbeddings({
      type: Model.YandexGPT,
      settings: {
        yandex: {
          apiKey: YANDEX_API_KEY,
          folder_id: YANDEX_FOLDER_ID,
        },
      },
    })

    expect(result.embeddings).toEqual(
      expect.objectContaining({
        apiKey: YANDEX_API_KEY,
        folderID: YANDEX_FOLDER_ID,
      }),
    )
    expect(result.storageType).toBe(EmbStorageType.yandex)
  })
})
