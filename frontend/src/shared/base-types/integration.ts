export interface Openai {
  apiKey?: string
  model: string
}

export interface Perplexity {
  apiKey: string
  model: string
}

export interface Google {
  drive: boolean
}

export interface Yandex {
  apiKey: string
  folder_id: string
  model: string
}

export interface Claude {
  apiKey: string
  model: string
}

export interface Qwen {
  apiKey: string
  model: string
}

export interface Deepseek {
  apiKey: string
  model: string
}

export interface CustomLLM {
  apiRootUrl: string
  apiKey?: string
  maxTokens: number
  apiType: string
  embeddingsChunkSize: number
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

export interface Language {
  code: string
  name: string
}
