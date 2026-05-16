import {NoopChatModel} from './NoopChatModel'
import {planResponse} from './ResponsePlanner'
import {synthesizeForkContent} from './ForkContentSynthesizer'

const DEFAULT_CHUNK_SIZE = 4000

const plan = messages => planResponse(messages, synthesizeForkContent)

export const createNoopLLM = () => ({
  llm: new NoopChatModel({plan}),
  chunkSize: DEFAULT_CHUNK_SIZE,
})
