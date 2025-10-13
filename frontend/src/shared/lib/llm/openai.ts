import { ChatOpenAI, type OpenAIChatInput } from '@langchain/openai'
import { HumanMessage } from '@langchain/core/messages'

import {
  OPENAI_API_KEY_EMPTY,
  OPENAI_COMPLETION_BASE_PATH,
  OPENAI_DEFAULT_MODEL,
  OpenaiModels,
} from '@shared/config/llm.config'
import type { Openai } from '@shared/base-types/integration'
import type { BaseLanguageModelCallOptions } from '@langchain/core/language_models/base'

const MAX_ERROR_CALLS_COUNT = 99

export const modelNotSupportTemperature: string[] = [OpenaiModels.GPT_O_1, OpenaiModels.GPT_O_3_MINI]

export async function createResponseChat(
  message: string,
  settings: Partial<Openai>,
  modelSettings?: Partial<OpenAIChatInput>,
  completionSettings?: Partial<BaseLanguageModelCallOptions>,
): Promise<string | undefined> {
  const modelName = settings?.model || OPENAI_DEFAULT_MODEL

  if (modelSettings && modelNotSupportTemperature.includes(modelName)) {
    delete modelSettings.temperature
  }

  const model = new ChatOpenAI({
    ...modelSettings,
    apiKey: settings?.apiKey || OPENAI_API_KEY_EMPTY,
    modelName,
    configuration: {
      baseURL: OPENAI_COMPLETION_BASE_PATH,
    },
    maxRetries: MAX_ERROR_CALLS_COUNT,
  })

  const result = await model.invoke([new HumanMessage(message)], completionSettings)

  if (typeof result.content === 'string') {
    return result.content
  } else if (Array.isArray(result.content)) {
    return result.content.map(item => (typeof item === 'string' ? item : String(item))).join(' ')
  }
  return undefined
}
