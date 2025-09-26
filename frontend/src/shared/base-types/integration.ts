export interface Openai {
  apiKey?: string
  model: string
  useApi: boolean
}

export interface Perplexity {
  apiKey: string
  model: string
  useApi: boolean
}

export interface Google {
  drive: boolean
}

export interface Yandex {
  apiKey: string
  folder_id: string
  model: string
  useApi: boolean
}

export interface Claude {
  apiKey: string
  model: string
  useApi: boolean
}

export interface Qwen {
  apiKey: string
  model: string
  useApi: boolean
}

export interface Deepseek {
  apiKey: string
  model: string
  useApi: boolean
}

export interface CustomLLM {
  apiRootUrl: string
  apiKey?: string
  maxTokens: number
  apiType: string
  embeddingsChunkSize: number
  useApi: boolean
}

export enum Model {
  OpenAI = 'OpenAI',
  YandexGPT = 'YandexGPT',
  Claude = 'Claude',
  Qwen = 'Qwen',
  Deepseek = 'Deepseek',
  CustomLLM = 'CustomLLM',
}

export type IntegrationSettings = Partial<{
  openai: Openai
  google: Google
  yandex: Yandex
  claude: Claude
  qwen: Qwen
  deepseek: Deepseek
  custom_llm: CustomLLM
  lang: string
  model: string
  perplexity: Perplexity
}>
