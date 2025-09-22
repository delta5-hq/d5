import {CLAUDE_MODELS, OPENAI_MODELS, YANDEX_DEFAULT_MODEL, YANDEX_MODELS} from '../../../../../constants'

export const GPT_3_5_TURBO_MAX_TOKENS = 4096
export const GPT_3_5_TURBO_16K_MAX_TOKENS = 16385
export const GPT_4_MAX_TOKENS = 8192
export const GPT_4_TURBO_MAX_TOKENS = 128000
export const GPT_4o_MAX_TOKENS = 128000
export const GPT_4o_MINI_MAX_TOKENS = 128000
export const GPT_O_1_MAX_TOKENS = 200000
export const GPT_O_3_MINI_MAX_TOKENS = 200000
export const GPT_4_5_PREVIEW_MAX_TOKENS = 128000
export const GPT_4_1_MAX_TOKENS = 1_047_576
export const GPT_4_1_MINI_MAX_TOKENS = 128000
export const GPT_4_1_NANO_MAX_TOKENS = 128000
export const GPT_5_MAX_TOKENS = 400000
export const GPT_5_MINI_MAX_TOKENS = 400000
export const GPT_5_NANO_MAX_TOKENS = 400000
export const GPT_5_CHAT_MAX_TOKENS = 128000
export const GPT_o3_MAX_TOKENS = 200000
export const GPT_o3_PRO_MAX_TOKENS = 200000
export const GPT_o3_DEEP_RESEARCH_MAX_TOKENS = 200000
export const GPT_o4_MINI_MAX_TOKENS = 200000
export const GPT_o4_MINI_DEEP_RESEARCH_MAX_TOKENS = 200000

export const modelNotSupportTemperature = [OPENAI_MODELS.GPT_O_1, OPENAI_MODELS.GPT_O_3_MINI]

export const getOpenaiModelSettings = modelName => {
  switch (modelName) {
    case OPENAI_MODELS.GPT_3_5_TURBO:
      return {model: OPENAI_MODELS.GPT_3_5_TURBO, chunkSize: GPT_3_5_TURBO_16K_MAX_TOKENS}
    case OPENAI_MODELS.GPT_4:
      return {model: OPENAI_MODELS.GPT_4, chunkSize: GPT_4_MAX_TOKENS}
    case OPENAI_MODELS.GPT_4_TURBO:
      return {model: OPENAI_MODELS.GPT_4_TURBO, chunkSize: GPT_4_TURBO_MAX_TOKENS}
    case OPENAI_MODELS.GPT_4o_MINI:
      return {model: OPENAI_MODELS.GPT_4o_MINI, chunkSize: GPT_4o_MINI_MAX_TOKENS}
    case OPENAI_MODELS.GPT_O_1:
      return {model: OPENAI_MODELS.GPT_O_1, chunkSize: GPT_O_1_MAX_TOKENS}
    case OPENAI_MODELS.GPT_O_3_MINI:
      return {model: OPENAI_MODELS.GPT_O_3_MINI, chunkSize: GPT_O_3_MINI_MAX_TOKENS}
    case OPENAI_MODELS.GPT_4_5_PREVIEW:
      return {model: OPENAI_MODELS.GPT_4_5_PREVIEW, chunkSize: GPT_4_5_PREVIEW_MAX_TOKENS}
    case OPENAI_MODELS.GPT_4_1:
      return {model: OPENAI_MODELS.GPT_4_1, chunkSize: GPT_4_1_MAX_TOKENS}
    case OPENAI_MODELS.GPT_5:
      return {model: OPENAI_MODELS.GPT_5, chunkSize: GPT_5_MAX_TOKENS}
    case OPENAI_MODELS.GPT_o3:
      return {model: OPENAI_MODELS.GPT_o3, chunkSize: GPT_o3_MAX_TOKENS}
    case OPENAI_MODELS.GPT_o3_PRO:
      return {model: OPENAI_MODELS.GPT_o3_PRO, chunkSize: GPT_o3_PRO_MAX_TOKENS}
    case OPENAI_MODELS.GPT_o3_DEEP_RESEARCH:
      return {model: OPENAI_MODELS.GPT_o3_DEEP_RESEARCH, chunkSize: GPT_o3_DEEP_RESEARCH_MAX_TOKENS}
    case OPENAI_MODELS.GPT_o4_MINI:
      return {model: OPENAI_MODELS.GPT_o4_MINI, chunkSize: GPT_o4_MINI_MAX_TOKENS}
    case OPENAI_MODELS.GPT_o4_MINI_DEEP_RESEARCH:
      return {model: OPENAI_MODELS.GPT_o4_MINI_DEEP_RESEARCH, chunkSize: GPT_o4_MINI_DEEP_RESEARCH_MAX_TOKENS}
    case OPENAI_MODELS.GPT_4_1_MINI:
      return {model: OPENAI_MODELS.GPT_4_1_MINI, chunkSize: GPT_4_1_MINI_MAX_TOKENS}
    case OPENAI_MODELS.GPT_4_1_NANO:
      return {model: OPENAI_MODELS.GPT_4_1_NANO, chunkSize: GPT_4_1_NANO_MAX_TOKENS}
    case OPENAI_MODELS.GPT_5_MINI:
      return {model: OPENAI_MODELS.GPT_5_MINI, chunkSize: GPT_5_MINI_MAX_TOKENS}
    case OPENAI_MODELS.GPT_5_NANO:
      return {model: OPENAI_MODELS.GPT_5_NANO, chunkSize: GPT_5_NANO_MAX_TOKENS}
    case OPENAI_MODELS.GPT_5_CHAT:
      return {model: OPENAI_MODELS.GPT_5_CHAT, chunkSize: GPT_5_CHAT_MAX_TOKENS}
    default:
      return {model: OPENAI_MODELS.GPT_4o, chunkSize: GPT_4o_MAX_TOKENS}
  }
}

export const YANDEX_4_GEN_MAX_TOKENS = 32000
export const LLAMA_8B_MAX_TOKENS = 8192
export const LLAMA_70B_GEN_MAX_TOKENS = 8192

export const getYandexModelSettings = modelName => {
  switch (modelName) {
    case YANDEX_MODELS.GPT_LITE_DEPRECATED:
      return {model: YANDEX_MODELS.GPT_LITE_DEPRECATED, chunkSize: YANDEX_4_GEN_MAX_TOKENS}
    case YANDEX_MODELS.GPT_PRO_DEPRECATED:
      return {model: YANDEX_MODELS.GPT_PRO_DEPRECATED, chunkSize: YANDEX_4_GEN_MAX_TOKENS}
    case YANDEX_MODELS.GPT_LITE_RC:
      return {model: YANDEX_MODELS.GPT_LITE_RC, chunkSize: YANDEX_4_GEN_MAX_TOKENS}
    case YANDEX_MODELS.GPT_LITE_LATEST:
      return {model: YANDEX_MODELS.GPT_LITE_LATEST, chunkSize: YANDEX_4_GEN_MAX_TOKENS}
    case YANDEX_MODELS.GPT_PRO_RC:
      return {model: YANDEX_MODELS.GPT_PRO_RC, chunkSize: YANDEX_4_GEN_MAX_TOKENS}
    case YANDEX_MODELS.GPT_PRO_LATEST:
      return {model: YANDEX_MODELS.GPT_PRO_LATEST, chunkSize: YANDEX_4_GEN_MAX_TOKENS}
    case YANDEX_MODELS.GPT_32K_LATEST:
      return {model: YANDEX_MODELS.GPT_32K_LATEST, chunkSize: YANDEX_4_GEN_MAX_TOKENS}
    case YANDEX_MODELS.GPT_32K_RC:
      return {model: YANDEX_MODELS.GPT_32K_RC, chunkSize: YANDEX_4_GEN_MAX_TOKENS}
    case YANDEX_MODELS.LLAMA_70B_LATEST:
      return {model: YANDEX_MODELS.LLAMA_70B_LATEST, chunkSize: LLAMA_70B_GEN_MAX_TOKENS}
    case YANDEX_MODELS.LLAMA_8B_LATEST:
      return {model: YANDEX_MODELS.LLAMA_8B_LATEST, chunkSize: LLAMA_8B_MAX_TOKENS}
    default:
      return {model: YANDEX_DEFAULT_MODEL, chunkSize: YANDEX_4_GEN_MAX_TOKENS}
  }
}

const CLAUDE_3_5_MAX_OUTPUT = 8192
const CLAUDE_3_MAX_OUTPUT = 4096
const CLAUDE_3_7_MAX_OUTPUT = 8192
const CLAUDE_SONNET_4_MAX_OUTPUT = 8192
const CLAUDE_OPUS_4_1_MAX_OUTPUT = 8192

export function getClaudeMaxOutput(model) {
  if (model.startsWith('claude-3-5')) return CLAUDE_3_5_MAX_OUTPUT
  if (model.startsWith('claude-3-7')) return CLAUDE_3_7_MAX_OUTPUT
  if (model === 'claude-sonnet-4') return CLAUDE_SONNET_4_MAX_OUTPUT
  if (model === 'claude-opus-4.1') return CLAUDE_OPUS_4_1_MAX_OUTPUT
  return CLAUDE_3_MAX_OUTPUT
}

const CLAUDE_3_5_SONNET_MAX_TOKENS = 200000
const CLAUDE_3_5_HAIKU_MAX_TOKENS = 200000
const CLAUDE_3_OPUS_MAX_TOKENS = 200000
const CLAUDE_3_HAIKU_MAX_TOKENS = 200000
const CLAUDE_3_7_SONNET_MAX_TOKENS = 200000
const CLAUDE_SONNET_4_MAX_TOKENS = 200000
const CLAUDE_OPUS_4_1_MAX_TOKENS = 200000

export function getClaudeMaxTokens(model) {
  switch (model) {
    case CLAUDE_MODELS.CLAUDE_3_5_SONNET:
      return CLAUDE_3_5_SONNET_MAX_TOKENS - CLAUDE_3_5_MAX_OUTPUT
    case CLAUDE_MODELS.CLAUDE_3_5_HAIKU:
      return CLAUDE_3_5_HAIKU_MAX_TOKENS - CLAUDE_3_5_MAX_OUTPUT
    case CLAUDE_MODELS.CLAUDE_3_OPUS:
      return CLAUDE_3_OPUS_MAX_TOKENS - CLAUDE_3_MAX_OUTPUT
    case CLAUDE_MODELS.CLAUDE_3_7_SONNET:
      return CLAUDE_3_7_SONNET_MAX_TOKENS - CLAUDE_3_5_MAX_OUTPUT
    case CLAUDE_MODELS:
      return CLAUDE_SONNET_4_MAX_TOKENS - CLAUDE_SONNET_4_MAX_OUTPUT
    case 'claude-opus-4.1':
      return CLAUDE_OPUS_4_1_MAX_TOKENS - CLAUDE_OPUS_4_1_MAX_OUTPUT
    default:
      return CLAUDE_3_HAIKU_MAX_TOKENS - CLAUDE_3_MAX_OUTPUT
  }
}

const QWEN_1_5_MAX_OUTPUT = 2000
const QWEN_2_MAX_OUTPUT = 6144
const QWEN_2_5_MAX_OUTPUT = 8192
const QWEN_MAX_OUTPUT = 8192
const QWEN_1_5_7B_MAX_OUTPUT = 2048
const QWEN_1_5_14B_MAX_OUTPUT = 4096
const QWEN_2_5B_MAX_OUTPUT = 2048
const QWEN_2_7B_MAX_OUTPUT = 4096
const QWEN_2_57B_MAX_OUTPUT = 8192

export function getQwenMaxOutput(model) {
  if (model.startsWith('qwen1.5-')) {
    if (model.includes('7b')) return QWEN_1_5_7B_MAX_OUTPUT
    if (model.includes('14b')) return QWEN_1_5_14B_MAX_OUTPUT
    return QWEN_1_5_MAX_OUTPUT
  }
  if (model.startsWith('qwen2-')) {
    if (model.includes('2.5b')) return QWEN_2_5B_MAX_OUTPUT
    if (model.includes('7b')) return QWEN_2_7B_MAX_OUTPUT
    if (model.includes('57b')) return QWEN_2_57B_MAX_OUTPUT
    return QWEN_2_5_MAX_OUTPUT
  }
  if (model.startsWith('qwen2-')) return QWEN_2_MAX_OUTPUT
  return QWEN_MAX_OUTPUT
}

const QWEN_1_5_MAX_INPUT = 6000
const QWEN_2_MAX_INPUT = 128000
const QWEN_2_5_MAX_INPUT = 129024
const QWEN_2_5_1M_MAX_INPUT = 1000000
const QWEN_PLUS_MAX_INPUT = 129024
const QWEN_TURBO_MAX_INPUT = 1000000
const QWEN_MAX_MAX_INPUT = 30720
const QWEN_FLASH_MAX_INPUT = 1000000
const QWEN_1_5_7B_MAX_INPUT = 8192
const QWEN_1_5_14B_MAX_INPUT = 16384
const QWEN_2_5B_MAX_INPUT = 8192
const QWEN_2_7B_MAX_INPUT = 32000
const QWEN_2_57B_MAX_INPUT = 64000

export function getQwenMaxInput(model) {
  if (model.startsWith('qwen1.5-')) {
    if (model.includes('7b')) return QWEN_1_5_7B_MAX_INPUT
    if (model.includes('14b')) return QWEN_1_5_14B_MAX_INPUT
    return QWEN_1_5_MAX_INPUT
  }
  if (model.startsWith('qwen2-7')) return QWEN_2_MAX_INPUT
  if (model.startsWith('qwen2-')) {
    if (model.includes('2.5b')) return QWEN_2_5B_MAX_INPUT
    if (model.includes('7b')) return QWEN_2_7B_MAX_INPUT
    if (model.includes('57b')) return QWEN_2_57B_MAX_INPUT
    return QWEN_2_5_MAX_INPUT
  }
  if (model.endsWith('1m')) return QWEN_2_5_1M_MAX_INPUT
  if (model === 'qwen-plus') return QWEN_PLUS_MAX_INPUT
  if (model === 'qwen-max') return QWEN_MAX_MAX_INPUT
  if (model === 'qwen-flash') return QWEN_FLASH_MAX_INPUT
  return QWEN_TURBO_MAX_INPUT
}

const DEEPSEEK_MAX_OUTPUT = 8000

export function getDeepseekMaxOutput() {
  return DEEPSEEK_MAX_OUTPUT
}

const DEEPSEEK_MAX_INPUT = 6000

export function getDeepseekMaxInput() {
  return DEEPSEEK_MAX_INPUT
}
