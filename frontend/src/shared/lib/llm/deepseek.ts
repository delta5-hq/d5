import { HumanMessage } from '@langchain/core/messages'
import { ChatOpenAI, type OpenAICallOptions, type OpenAIInput } from '@langchain/openai'
import type { Deepseek } from '@shared/base-types'
import { DEEPSEEK_API_URL, DEEPSEEK_DEFAULT_MODEL } from '@shared/config'

const MAX_ERROR_CALLS_COUNT = 99

export async function createResponseDeepseek(
  message: string,
  settings?: Partial<Deepseek>,
  modelSettings?: Partial<OpenAIInput>,
  completionSettings?: Partial<OpenAICallOptions>,
): Promise<string | undefined> {
  const model = new ChatOpenAI({
    ...modelSettings,
    apiKey: settings?.apiKey,
    modelName: settings?.model || DEEPSEEK_DEFAULT_MODEL,
    configuration: {
      baseURL: DEEPSEEK_API_URL,
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

const DEEPSEEK_MAX_OUTPUT = 8000

export function getDeepseekMaxOutput() {
  return DEEPSEEK_MAX_OUTPUT
}

const DEEPSEEK_MAX_INPUT = 6000

export function getDeepseekMaxInput() {
  return DEEPSEEK_MAX_INPUT
}
