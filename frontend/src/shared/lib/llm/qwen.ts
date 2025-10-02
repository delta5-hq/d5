import { HumanMessage } from '@langchain/core/messages'
import { ChatOpenAI, type OpenAICallOptions, type OpenAIInput } from '@langchain/openai'
import type { Qwen } from '@shared/base-types'
import { QWEN_API_URL, QWEN_DEFAULT_MODEL } from '@shared/config'

const MAX_ERROR_CALLS_COUNT = 99

export async function createResponseQwen(
  message: string,
  settings?: Partial<Qwen>,
  modelSettings?: Partial<OpenAIInput>,
  completionSettings?: Partial<OpenAICallOptions>,
): Promise<string | undefined> {
  const model = new ChatOpenAI({
    ...modelSettings,
    apiKey: settings?.apiKey,
    modelName: settings?.model || QWEN_DEFAULT_MODEL,
    configuration: {
      baseURL: QWEN_API_URL,
    },
    maxRetries: MAX_ERROR_CALLS_COUNT,
    topP: modelSettings?.topP || 0.7,
  })

  const result = await model.invoke([new HumanMessage(message)], completionSettings)

  if (typeof result.content === 'string') {
    return result.content
  } else if (Array.isArray(result.content)) {
    return result.content.map(item => (typeof item === 'string' ? item : String(item))).join(' ')
  }
  return undefined
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

export function getQwenMaxOutput(model: string) {
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

export function getQwenMaxInput(model: string) {
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
