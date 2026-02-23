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

export interface MCPIntegration {
  alias: string
  transport: 'stdio' | 'streamable-http'
  toolName: string
  toolInputField?: string
  toolStaticArgs?: Record<string, unknown>
  description?: string
  serverUrl?: string
  headers?: Record<string, string>
  command?: string
  args?: string[]
  env?: Record<string, string>
  timeoutMs?: number
}

export interface RPCIntegration {
  alias: string
  protocol: 'ssh' | 'http'
  description?: string
  timeoutMs?: number
  host?: string
  port?: number
  username?: string
  privateKey?: string
  passphrase?: string
  commandTemplate?: string
  workingDir?: string
  url?: string
  method?: 'GET' | 'POST' | 'PUT'
  headers?: Record<string, string>
  bodyTemplate?: string
  outputFormat?: 'text' | 'json'
  outputField?: string
  sessionIdField?: string
  lastSessionId?: string
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
  mcp: MCPIntegration[]
  rpc: RPCIntegration[]
}>

export interface Language {
  code: string
  name: string
}
