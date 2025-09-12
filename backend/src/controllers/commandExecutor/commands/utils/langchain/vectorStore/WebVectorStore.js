import {RecursiveCharacterTextSplitter} from 'langchain/text_splitter'
import {MemoryVectorStore} from 'langchain/vectorstores/memory'
import {chunk} from './utils/chunk'

const DEFAULT_CHUNK_SIZE = 8191
const TOKEN_PER_MINUTE_MAX = 150000

export class WebVectorStore {
  memoryVectorStore

  splitter

  names = []

  chunkSize

  similarityThreshold

  logError

  constructor({chunkSize, embeddings, similarityThreshold, logError}) {
    this.logError = logError
    this.similarityThreshold = similarityThreshold

    this.chunkSize = chunkSize
    this.splitter = new RecursiveCharacterTextSplitter({chunkSize: chunkSize || DEFAULT_CHUNK_SIZE})
    this.memoryVectorStore = new MemoryVectorStore(embeddings)
  }

  async load(webDataArray) {
    try {
      const docs = []
      const newWebNames = []

      // eslint-disable-next-line no-restricted-syntax
      for (const {content, hrefs} of webDataArray) {
        newWebNames.push(...hrefs)
        // eslint-disable-next-line no-await-in-loop
        const newDocs = await this.splitter.createDocuments(
          [content],
          [
            {
              source: hrefs,
            },
          ],
        )
        docs.push(...newDocs)
      }
      if (newWebNames) {
        this.names.push(...newWebNames)
      }

      if (docs.length) {
        const chunkSize = this.chunkSize || DEFAULT_CHUNK_SIZE
        const numberOfDocsPerCall = Math.floor(TOKEN_PER_MINUTE_MAX / chunkSize)
        // eslint-disable-next-line no-restricted-syntax
        for (const docsPerCall of chunk(docs, numberOfDocsPerCall)) {
          // eslint-disable-next-line no-await-in-loop
          await this.memoryVectorStore.addDocuments(docsPerCall)
        }
      }

      return docs
    } catch (e) {
      if (this.logError) {
        this.logError(e)
      }
      return []
    }
  }

  async getRelevantData(query, maxChunks, similarityThreshold) {
    let docs = await this.memoryVectorStore.similaritySearchWithScore(query, maxChunks)

    const similarityValue = similarityThreshold || this.similarityThreshold
    if (similarityValue) {
      docs = docs.filter(x => x[1] >= similarityValue)
    }

    return docs.map(x => x[0])
  }

  get sourceLinks() {
    return this.names
  }

  get memoryVectors() {
    return this.memoryVectorStore.memoryVectors
  }
}
