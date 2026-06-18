import {NoopChatModel} from './NoopChatModel'
import {planResponse} from './ResponsePlanner'
import {synthesizeForkContent} from './ForkContentSynthesizer'
import {assertGeneratorAllowed} from './MockFailurePolicy'

const DEFAULT_CHUNK_SIZE = 4000

const synthesizeWithFailurePolicy = corpus => {
  assertGeneratorAllowed()
  return synthesizeForkContent(corpus)
}

const plan = messages => planResponse(messages, synthesizeWithFailurePolicy)

export const createNoopLLM = () => ({
  llm: new NoopChatModel({plan}),
  chunkSize: DEFAULT_CHUNK_SIZE,
})
