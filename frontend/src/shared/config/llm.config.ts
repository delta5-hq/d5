import { API_BASE_PATH, IS_PROD } from './api'

export const OPENAI_COMPLETION_BASE_PATH = `${window.location.origin}${API_BASE_PATH}/integration`
export const OPENAI_API_KEY_EMPTY = 'EMPTY'
export const DALLE_BASE_PATH = `${window.location.origin}${API_BASE_PATH}/integration`
export const CLAUDE_MESSAGES_BASE_PATH = `${API_BASE_PATH}/integration/claude/messages`

export const YANDEX_GPT_COMPLETION_PATH = `${API_BASE_PATH}/integration/yandex/completion`
export const YANDEX_GPT_EMBEDDINGS_PATH = `${API_BASE_PATH}/integration/yandex/embeddings`
export const PERPLEXITY_API_URL = `${window.location.origin}${API_BASE_PATH}/integration/perplexity`

export const QWEN_API_URL = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'

export const DEEPSEEK_API_URL = 'https://api.deepseek.com'

export enum OpenaiModels {
  GPT_3_5_TURBO = 'gpt-3.5-turbo',
  GPT_4 = 'gpt-4',
  GPT_4_TURBO = 'gpt-4-turbo',
  GPT_4o = 'gpt-4o',
  GPT_4o_MINI = 'gpt-4o-mini',
  GPT_O_1 = 'o1',
  GPT_O_3_MINI = 'o3-mini',
  GPT_4_5_PREVIEW = 'gpt-4.5-preview',
  GPT_4_1 = 'gpt-4.1',
  GPT_5 = 'gpt-5',
  GPT_o3 = 'o3',
  GPT_o3_PRO = 'o3-pro',
  GPT_o3_DEEP_RESEARCH = 'o3-deep-research',
  GPT_o4_MINI = 'o4-mini',
  GPT_o4_MINI_DEEP_RESEARCH = 'o4-mini-deep-research',
}
export const OPENAI_DEFAULT_MODEL = OpenaiModels.GPT_4o

export enum YandexGPTModel {
  GPT_LITE_LATEST = 'yandexgpt-lite/latest',
  GPT_LITE_RC = 'yandexgpt-lite/rc',
  GPT_LITE_DEPRECATED = 'yandexgpt-lite/deprecated',
  GPT_PRO_LATEST = 'yandexgpt/latest',
  GPT_PRO_RC = 'yandexgpt/rc',
  GPT_PRO_DEPRECATED = 'yandexgpt/deprecated',
  GPT_32K_LATEST = 'yandexgpt-32k/latest',
  GPT_32K_RC = 'yandexgpt/rc',
  GPT_32K_DEPRECATED = 'yandexgpt-32k/deprecated',
  LLAMA_8B_LATEST = 'llama-lite/latest',
  LLAMA_70B_LATEST = 'llama/latest',
}

export const YANDEX_DEFAULT_MODEL = YandexGPTModel.GPT_PRO_LATEST
export const YANDEX_4_GEN_MAX_TOKENS = 32000
export const LLAMA_8B_MAX_TOKENS = 8192
export const LLAMA_70B_GEN_MAX_TOKENS = 8192

const PROD_GOOGLE_API_KEY = 'AIzaSyBj2cp41GabeWOA_oe9TPEAO_3m2l1_w4E'
const PROD_GOOGLE_CLIENT_ID = '15527659405-7iin55qlruaoukr187bobn0hk0p5q7t3.apps.googleusercontent.com'
const DEV_GOOGLE_API_KEY = 'AIzaSyC9la_wPG4p0r4lPlUsmo9NitjVuwgZxv4'
const DEV_GOOGLE_CLIENT_ID = '424102186327-o9t7dn7fsunsh79aj386pn2v539ka7go.apps.googleusercontent.com'
export const GOOGLE_DRIVE_DISCOVERY_DOCS = ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest']
export const GOOGLE_DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive'

export const GOOGLE_API_KEY = IS_PROD ? PROD_GOOGLE_API_KEY : DEV_GOOGLE_API_KEY
export const GOOGLE_CLIENT_ID = IS_PROD ? PROD_GOOGLE_CLIENT_ID : DEV_GOOGLE_CLIENT_ID

export enum ClaudeModels {
  CLAUDE_3_5_SONNET = 'claude-3-5-sonnet-latest',
  CLAUDE_3_5_HAIKU = 'claude-3-5-haiku-latest',
  CLAUDE_3_OPUS = 'claude-3-opus-latest',
  CLAUDE_3_HAIKU = 'claude-3-haiku-20240307',
  CLAUDE_3_7_SONNET = 'claude-3-7-sonnet-latest',
  CLAUDE_SONNET_4 = 'claude-sonnet-4',
  CLAUDE_OPUS_4_1 = 'claude-opus-4.1',
}

export const CLAUDE_DEFAULT_MODEL = ClaudeModels.CLAUDE_3_HAIKU

export enum PerplexityModels {
  SONAR = 'sonar',
  SONAR_PRO = 'sonar-pro',
  SONAR_REASONING = 'sonar-reasoning',
  SONAR_REASONING_PRO = 'sonar-reasoning-pro',
}
export const PERPLEXITY_DEFAULT_MODEL = PerplexityModels.SONAR

export enum QwenModels {
  QWEN_1_5_110b_CHAT = 'qwen1.5-110b-chat',
  QWEN_1_5_72b_CHAT = 'qwen1.5-72b-chat',
  QWEN_1_5_32b_CHAT = 'qwen1.5-32b-chat',
  QWEN_1_5_14b_CHAT = 'qwen1.5-14b-chat',
  QWEN_1_5_7b_CHAT = 'qwen1.5-7b-chat',
  QWEN_2_72B_INSTRUCT = 'qwen2-72b-instruct',
  QWEN_2_7B_INSTRUCT = 'qwen2-7b-instruct',
  QWEN_2_5_14B_INSTRUCT_1M = 'qwen2.5-14b-instruct-1m',
  QWEN_2_5_7B_INSTRUCT_1M = 'qwen2.5-7b-instruct-1m',
  QWEN_2_5_72B_INSTRUCT = 'qwen2.5-72b-instruct',
  QWEN_2_5_32B_INSTRUCT = 'qwen2.5-32b-instruct',
  QWEN_2_5_14B_INSTRUCT = 'qwen2.5-14b-instruct',
  QWEN_2_5_7B_INSTRUCT = 'qwen2.5-7b-instruct',

  QWEN_1_5_1_8_CHAT = 'qwen1.5-1.8-chat',
  QWEN_2_2_5B_INSTRUCT = 'qwen2-2.5b-instruct',
  QWEN_2_57B_INSTRUCT = 'qwen2-57b-instruct',

  QWEN_TURBO = 'qwen-turbo',
  QWEN_PLUS = 'qwen-plus',
  QWEN_MAX = 'qwen-max',
  QWEN_FLASH = 'qwen-flash',
  QWEN_CYDER = 'qwen-cyder',
}

export const QWEN_DEFAULT_MODEL = QwenModels.QWEN_PLUS

export enum DeepseekModels {
  DEEPSEEK_CHAT = 'deepseek-chat',
  DEEPSEEK_REASONER = 'deepseek-reasoner',
}

export const DEEPSEEK_DEFAULT_MODEL = DeepseekModels.DEEPSEEK_CHAT

export enum CustomLLMApiType {
  OpenAI_Compatible = 'OpenAI compatible',
  OpenAI_Compatible_Chain_Of_Thought = 'OpenAI compatible Chain-of-Thought',
}

export const CUSTOM_LLM_TIMEOUT_MS = 600_000

export enum EmbStorageType {
  openai = 'openai',
  yandex = 'yandex',
  custom_llm = 'custom_llm',
  qwen = 'qwen',
}

export const USER_DEFAULT_MODEL = 'auto'
