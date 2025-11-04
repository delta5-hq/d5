require('dotenv').config()

const {env} = process

export const PORT = process.env.PORT || 3001

export const BASE_URL = process.env.BASE_URL

export const FRONTEND_PATH = env.FRONTEND_PATH || '../frontend/build'

export const JWT_SECRET = env.JWT_SECRET || 'GrFYK5ftZDtCg7ZGwxZ1JpSxyyJ9bc8uJijvBD1DYiMoS64ZpnBSrFxsNuybN1iO'

export let JWT_TTL = Number(env.JWT_TTL || 86400)

export const {
  MONGO_USERNAME = 'delta5',
  MONGO_PASSWORD,
  MONGO_DATABASE = 'delta5',
  MONGO_HOST = 'localhost',
  MONGO_PORT = '27017',
} = env
const mongoUrl = `${MONGO_HOST}:${MONGO_PORT}/${MONGO_DATABASE}`
const mongoAuth = MONGO_PASSWORD ? `${MONGO_USERNAME}:${MONGO_PASSWORD}@` : ''

export const MONGO_URI = env.E2E_MONGO_URI || env.MONGO_URI || `mongodb://${mongoAuth}${mongoUrl}`

export const IMPORT_JSON_SIZE_LIMIT = env.IMPORT_JSON_SIZE_LIMIT || '300mb'

export const SYNC_USER_ID = env.SYNC_USER_ID || (env.NODE_ENV !== 'production' ? 'wp-sync-user' : undefined)

export const DOCS_SERVICE_URL = env.DOCS_SERVICE_URL || 'http://localhost:3100/image'

export const PDF_SERVICE_URL = env.PDF_SERVICE_URL || 'http://localhost:3102/image'

export const HTML_SERVICE_URL = env.HTML_SERVICE_URL || 'http://localhost:3101/image'

export const RESIZE_SERVICE_URL = env.RESIZE_SERVICE_URL || 'http://localhost:3103/image'

export const EXPORT_FILE_SIZE_LIMIT = env.EXPORT_FILE_SIZE_LIMIT || 20 * 1024 * 1024

export const MAIL_HOST = env.MAIL_HOST

export const MAIL_USER = env.MAIL_USER

export const MAIL_PASSWORD = env.MAIL_PASSWORD

export const GOOGLE_API_KEY = env.GOOGLE_API_KEY

export const SERP_API_KEY = env.SERP_API_KEY

export const OPENAI_API_KEY = env.OPENAI_API_KEY

export const OPENAI_API_KEY_EMPTY = 'EMPTY'

export const OPENAI_MODELS = {
  GPT_3_5_TURBO: 'gpt-3.5-turbo',
  GPT_4: 'gpt-4',
  GPT_4_TURBO: 'gpt-4-turbo',
  GPT_4o: 'gpt-4o',
  GPT_4o_MINI: 'gpt-4o-mini',
  GPT_O_1: 'o1',
  GPT_O_3_MINI: 'o3-mini',
  GPT_4_5_PREVIEW: 'gpt-4.5-preview',
  GPT_4_1: 'gpt-4.1',
  GPT_5: 'gpt-5',
  GPT_5_MINI: 'gpt-5-mini',
  GPT_5_NANO: 'gpt-5-nano',
  GPT_5_CHAT: 'gpt-5-chat-latest',
  GPT_4_1_MINI: 'gpt-4.1-mini',
  GPT_4_1_NANO: 'gpt-4.1-nano',
  GPT_o3: 'o3',
  GPT_o3_PRO: 'o3-pro',
  GPT_o3_DEEP_RESEARCH: 'o3-deep-research',
  GPT_o4_MINI: 'o4-mini',
  GPT_o4_MINI_DEEP_RESEARCH: 'o4-mini-deep-research',
}

export const DEFAULT_OPENAI_MODEL_NAME = env.DEFAULT_OPENAI_MODEL_NAME

export const INITIAL_OPENAI_MODEL_NAME = OPENAI_MODELS.GPT_4_1_MINI

export const FREEPIK_API_KEY = env.FREEPIK_API_KEY

export const GOAPI_API_KEY = env.GOAPI_API_KEY

export const YANDEX_MODELS = {
  GPT_LITE_LATEST: 'yandexgpt-lite/latest',
  GPT_LITE_RC: 'yandexgpt-lite/rc',
  GPT_LITE_DEPRECATED: 'yandexgpt-lite/deprecated',
  GPT_PRO_LATEST: 'yandexgpt/latest',
  GPT_PRO_RC: 'yandexgpt/rc',
  GPT_PRO_DEPRECATED: 'yandexgpt/deprecated',
  GPT_32K_LATEST: 'yandexgpt-32k/latest',
  GPT_32K_RC: 'yandexgpt/rc',
  GPT_32K_DEPRECATED: 'yandexgpt-32k/deprecated',
  LLAMA_8B_LATEST: 'llama-lite/latest',
  LLAMA_70B_LATEST: 'llama/latest',
}

export const YANDEX_DEFAULT_MODEL = YANDEX_MODELS.GPT_PRO_LATEST

export const CLAUDE_MODELS = {
  CLAUDE_3_5_SONNET: 'claude-3-5-sonnet-latest',
  CLAUDE_3_5_HAIKU: 'claude-3-5-haiku-latest',
  CLAUDE_3_OPUS: 'claude-3-opus-latest',
  CLAUDE_3_HAIKU: 'claude-3-haiku-20240307',
  CLAUDE_3_7_SONNET: 'claude-3-7-sonnet-latest',
  CLAUDE_SONNET_4: 'claude-sonnet-4',
  CLAUDE_OPUS_4_1: 'claude-opus-4.1',
}

export const CLAUDE_DEFAULT_MODEL = CLAUDE_MODELS.CLAUDE_3_HAIKU

export const PERPLEXITY_MODELS = {
  SONAR: 'sonar',
  SONAR_PRO: 'sonar-pro',
  SONAR_REASONING: 'sonar-reasoning',
  SONAR_REASONING_PRO: 'sonar-reasoning-pro',
}
export const PERPLEXITY_DEFAULT_MODEL = PERPLEXITY_MODELS.SONAR

export const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY

export const QWEN_MODELS = {
  QWEN_1_5_110b_CHAT: 'qwen1.5-110b-chat',
  QWEN_1_5_72b_CHAT: 'qwen1.5-72b-chat',
  QWEN_1_5_32b_CHAT: 'qwen1.5-32b-chat',
  QWEN_1_5_14b_CHAT: 'qwen1.5-14b-chat',
  QWEN_1_5_7b_CHAT: 'qwen1.5-7b-chat',
  QWEN_2_72B_INSTRUCT: 'qwen2-72b-instruct',
  QWEN_2_7B_INSTRUCT: 'qwen2-7b-instruct',
  QWEN_2_5_14B_INSTRUCT_1M: 'qwen2.5-14b-instruct-1m',
  QWEN_2_5_7B_INSTRUCT_1M: 'qwen2.5-7b-instruct-1m',
  QWEN_2_5_72B_INSTRUCT: 'qwen2.5-72b-instruct',
  QWEN_2_5_32B_INSTRUCT: 'qwen2.5-32b-instruct',
  QWEN_2_5_14B_INSTRUCT: 'qwen2.5-14b-instruct',
  QWEN_2_5_7B_INSTRUCT: 'qwen2.5-7b-instruct',

  QWEN_1_5_1_8_CHAT: 'qwen1.5-1.8-chat',
  QWEN_2_2_5B_INSTRUCT: 'qwen2-2.5b-instruct',
  QWEN_2_57B_INSTRUCT: 'qwen2-57b-instruct',

  QWEN_TURBO: 'qwen-turbo',
  QWEN_PLUS: 'qwen-plus',
  QWEN_MAX: 'qwen-max',
  QWEN_FLASH: 'qwen-flash',
  QWEN_CYDER: 'qwen-cyder',
}

export const QWEN_DEFAULT_MODEL = QWEN_MODELS.QWEN_PLUS

export const DEEPSEEK_MODELS = {
  DEEPSEEK_CHAT: 'deepseek-chat',
  DEEPSEEK_REASONER: 'deepseek-reasoner',
}

export const DEEPSEEK_DEFAULT_MODEL = DEEPSEEK_MODELS.DEEPSEEK_CHAT

export const CustomLLMApiType = {
  OpenAI_Compatible: 'OpenAI compatible',
  OpenAI_Compatible_Chain_Of_Thought: 'OpenAI compatible Chain-of-Thought',
}

export const CUSTOM_LLM_TIMEOUT_MS = 600_000

export const SCRAPE_V2_TIMEOUT_MS = 8000
export const SCRAPER_API_SITES = ['cyberleninka.ru']
export const SCRAPER_API_TIMEOUT_MS = 80000
