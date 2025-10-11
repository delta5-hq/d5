import type { BaseLLMParams } from '@langchain/core/language_models/llms'
import { ChatOpenAI, type OpenAIInput } from '@langchain/openai'
import type { Perplexity } from '@shared/base-types'
import { PERPLEXITY_API_URL, PERPLEXITY_DEFAULT_MODEL } from '@shared/config'

export const createPerplexityResponse = async (
  message: string,
  credentials: Partial<Perplexity>,
  config?: Partial<OpenAIInput> & BaseLLMParams,
): Promise<string | undefined> => {
  const client = new ChatOpenAI({
    ...config,
    apiKey: credentials.apiKey,
    configuration: {
      baseURL: PERPLEXITY_API_URL,
    },
    model: credentials.model || PERPLEXITY_DEFAULT_MODEL,
  })

  const result = await client.invoke(message)

  if (typeof result.content === 'string') {
    return result.content
  } else if (Array.isArray(result.content)) {
    return result.content.map(item => (typeof item === 'string' ? item : String(item))).join(' ')
  }
  return undefined
}
