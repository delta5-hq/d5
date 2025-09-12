import {MemoryVectorStore} from 'langchain/vectorstores/memory'
import {RecursiveCharacterTextSplitter} from 'langchain/text_splitter'
import LLMVector from './../../../../../../models/LLMVector'
import {DEFAULT_CONTEXT_NAME} from './../../../../constants/ext'
import {EmbStorageType} from '../../../../../../shared/config/constants'

const DEFAULT_CHUNK_SIZE = 8191
const TOKEN_PER_MINUTE_MAX = 150000

const encodeKey = key => {
  return key.replace(/[^a-zA-Z0-9]/g, '_')
}

export class ExtVectorStore {
  constructor({
    userId,
    embeddings,
    similarityThreshold,
    log,
    chunkSize,
    contextName = DEFAULT_CONTEXT_NAME,
    storageType = EmbStorageType.openai,
  }) {
    if (!userId) {
      throw Error('User ID is required')
    }
    this.userId = userId
    this.log = log
    this.similarityThreshold = similarityThreshold
    this.contextName = contextName
    this.chunkSize = chunkSize || DEFAULT_CHUNK_SIZE
    this.storageType = storageType

    this.memoryVectorStore = new MemoryVectorStore(embeddings)
    this.splitter = new RecursiveCharacterTextSplitter({
      chunkSize: this.chunkSize,
    })
  }

  async setVectors() {
    const context = await LLMVector.findOne({
      userId: this.userId,
      name: this.contextName === DEFAULT_CONTEXT_NAME ? null : this.contextName,
    }).lean()

    if (!context) {
      const error = new Error("Context doesn't exists")
      error.code = 400

      throw error
    }

    const vectors = []

    const tStore = context.store[this.storageType]

    if (tStore) {
      Object.entries(tStore).forEach(([, newVectors]) => {
        vectors.push(...newVectors)
      })
    }

    this.memoryVectorStore.memoryVectors = vectors
  }

  async getRelevantData(query, maxChunks, similarityThreshold) {
    let docs = await this.memoryVectorStore.similaritySearchWithScore(query, maxChunks)

    const similarityValue = similarityThreshold || this.similarityThreshold
    if (similarityValue) {
      docs = docs.filter(x => x[1] >= similarityValue)
    }
    this.log('Relevant Documents Count: ', docs.length)
    return docs.map(x => x[0])
  }

  get memoryVectors() {
    return this.memoryVectorStore.memoryVectors
  }

  /**
   * Loads vectors into the database and memory store, organizing them by their source IDs.
   * Each vector's first href is used as its source ID, and vectors with the same source ID
   * are grouped together in the database.
   *
   * @param {Array<{content: string, hrefs: string[]}>} vectors - Array of vectors to load
   * Each vector must have:
   * - content: string - The text content of the vector
   * - hrefs: string[] - Array of node IDs, where the first ID is used as the source identifier
   * @param {boolean} [keep] - Shows whether to add vectors to existing ones or erase previous ones
   *
   * @throws {Error} If vectors is not an array or if any vector is missing required properties
   *
   * @example
   * await vectorStore.load([
   *   { content: 'text1', hrefs: ['node1', 'node2'] },
   *   { content: 'text2', hrefs: ['node3', 'node4'] }
   * ]);
   */
  async load(vectors, keep) {
    if (!vectors || !Array.isArray(vectors)) {
      throw new Error('Vectors must be an array')
    }

    if (!vectors.every(v => v?.content && Array.isArray(v?.hrefs) && v.hrefs.length > 0)) {
      throw new Error('Each vector must have content and non-empty hrefs array')
    }

    let context = await LLMVector.findOne({
      userId: this.userId,
      name: this.contextName === DEFAULT_CONTEXT_NAME ? null : this.contextName,
    })

    if (!context) {
      context = new LLMVector({
        userId: this.userId,
        name: this.contextName === DEFAULT_CONTEXT_NAME ? null : this.contextName,
        store: {},
      })
    }

    if (!context.store.get(this.storageType)) {
      context.store.set(this.storageType, new Map())
    }

    const totalTextLength = vectors.reduce((acc, curr) => acc + curr.content.length, 0)
    const totalTextSizeInKB = (totalTextLength / 1024).toFixed(2)
    this.log('Summarized length of text:', totalTextLength)
    this.log('Total text size in KB:', totalTextSizeInKB)

    const docs = []

    await Promise.all(
      vectors.map(async ({content, hrefs}) => {
        const newDocs = await this.splitter.createDocuments([content], [{source: hrefs}])
        docs.push(...newDocs)
      }),
    )

    if (docs.length) {
      const maxDocs = Math.floor(TOKEN_PER_MINUTE_MAX / DEFAULT_CHUNK_SIZE)

      const currentDocs = []
      for (let i = 0; i < docs.length; i += 1) {
        currentDocs.push(docs[i])

        if (currentDocs.length === maxDocs || i + 1 === docs.length) {
          await this.memoryVectorStore.addDocuments(currentDocs)
          currentDocs.length = 0
        }
      }

      const tStore = context.store.get(this.storageType)

      if (!keep) {
        tStore.clear()
      }

      for (const doc of this.memoryVectors) {
        const {source: hrefs} = doc.metadata
        const source = encodeKey(hrefs[0] || 'main')

        if (tStore.has(source)) {
          const existing = tStore.get(source) || []
          tStore.set(source, [...existing, doc])
        } else {
          tStore.set(source, [doc])
        }
      }

      context.markModified('store')
      await context.save()
    }
  }
}
