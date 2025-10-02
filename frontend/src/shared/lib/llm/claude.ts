import { CLAUDE_MESSAGES_BASE_PATH, ClaudeModels } from '@shared/config'
import { HttpError } from '../error'

interface MessageContentBlock {
  type: 'text'
  text: string
}

interface ToolDefinition {
  name: string
  description?: string
  input_schema: object
}

interface CreateMessageRequest {
  model: string
  messages: {
    role: 'user' | 'assistant'
    content: string
  }[]
  max_tokens: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any>
  stop_sequences?: string[]
  stream?: boolean
  system?: string
  temperature?: number
  tool_choice?: object
  tools?: ToolDefinition[]
  top_k?: number
  top_p?: number
}

interface CreateMessageResponse {
  id: string
  type: 'message'
  role: 'assistant'
  content: MessageContentBlock[]
  model: string
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use' | null
  stop_sequence: string | null
  usage: {
    input_tokens: number
    output_tokens: number
  }
}

export const createResponseClaude = async (
  requestParams: CreateMessageRequest,
  apiKey: string,
): Promise<CreateMessageResponse> => {
  const response = await fetch(CLAUDE_MESSAGES_BASE_PATH, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify(requestParams),
  })

  const result = await response.json()

  if (!response.ok) {
    throw new HttpError(result?.message || 'Unexpected Claude Error', response)
  }

  return result as CreateMessageResponse
}

const CLAUDE_3_5_MAX_OUTPUT = 8192
const CLAUDE_3_MAX_OUTPUT = 4096
const CLAUDE_3_7_MAX_OUTPUT = 8192
const CLAUDE_SONNET_4_MAX_OUTPUT = 8192
const CLAUDE_OPUS_4_1_MAX_OUTPUT = 8192

export function getClaudeMaxOutput(model: string) {
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

export function getClaudeMaxTokens(model: string) {
  switch (model) {
    case ClaudeModels.CLAUDE_3_5_SONNET:
      return CLAUDE_3_5_SONNET_MAX_TOKENS - CLAUDE_3_5_MAX_OUTPUT
    case ClaudeModels.CLAUDE_3_5_HAIKU:
      return CLAUDE_3_5_HAIKU_MAX_TOKENS - CLAUDE_3_5_MAX_OUTPUT
    case ClaudeModels.CLAUDE_3_OPUS:
      return CLAUDE_3_OPUS_MAX_TOKENS - CLAUDE_3_MAX_OUTPUT
    case ClaudeModels.CLAUDE_3_7_SONNET:
      return CLAUDE_3_7_SONNET_MAX_TOKENS - CLAUDE_3_5_MAX_OUTPUT
    case ClaudeModels.CLAUDE_OPUS_4_1:
      return CLAUDE_OPUS_4_1_MAX_TOKENS - CLAUDE_OPUS_4_1_MAX_OUTPUT
    case ClaudeModels.CLAUDE_SONNET_4:
      return CLAUDE_SONNET_4_MAX_TOKENS - CLAUDE_SONNET_4_MAX_OUTPUT
    default:
      return CLAUDE_3_HAIKU_MAX_TOKENS - CLAUDE_3_MAX_OUTPUT
  }
}
