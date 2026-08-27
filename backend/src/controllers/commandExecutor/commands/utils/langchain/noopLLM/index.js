import {NoopChatModel} from './NoopChatModel'
import {NoopEmbeddings} from './NoopEmbeddings'
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

export const createNoopEmbeddings = () => ({
  embeddings: new NoopEmbeddings(),
  chunkSize: DEFAULT_CHUNK_SIZE,
  similarityThreshold: 0,
})
