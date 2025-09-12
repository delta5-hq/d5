import {ExtVectorStore} from './ExtVectorStore'
import {MemoryVectorStore} from 'langchain/vectorstores/memory'
import {RecursiveCharacterTextSplitter} from 'langchain/text_splitter'
import LLMVector from '../../../../../../models/LLMVector'
import {EmbStorageType} from '../../../../../../shared/config/constants'

jest.mock('langchain/vectorstores/memory')
jest.mock('langchain/text_splitter')
jest.mock('../../../../../../models/LLMVector')

describe('ExtVectorStore', () => {
  const userId = 'testUser'
  const embeddings = jest.fn()
  const log = jest.fn()

  let extVectorStore

  beforeEach(() => {
    jest.clearAllMocks()

    MemoryVectorStore.mockImplementation(() => ({
      similaritySearchWithScore: jest.fn().mockResolvedValue([]),
      addDocuments: jest.fn().mockResolvedValue(undefined),
      memoryVectors: [],
    }))

    RecursiveCharacterTextSplitter.mockImplementation(() => ({
      createDocuments: jest.fn().mockResolvedValue([
        {
          pageContent: 'test content',
          metadata: {source: ['testHref']},
        },
      ]),
    }))

    LLMVector.findOne.mockResolvedValue(null)
    LLMVector.mockImplementation(() => ({
      save: jest.fn().mockResolvedValue(undefined),
      markModified: jest.fn(),
      store: new Map(),
      clear: jest.fn(),
    }))

    extVectorStore = new ExtVectorStore({userId, embeddings, log})
  })

  describe('load', () => {
    it('should create a new context and initialize storageType if no context exists', async () => {
      const mockVectors = [
        {
          content: 'test content',
          hrefs: ['testHref'],
        },
      ]

      await extVectorStore.load(mockVectors)

      expect(LLMVector.findOne).toHaveBeenCalledWith({
        userId,
        name: null,
      })

      const createdContext = LLMVector.mock.results[0].value

      expect(createdContext.save).toHaveBeenCalled()
      expect(createdContext.markModified).toHaveBeenCalledWith('store')
      expect(createdContext.store.get(EmbStorageType.openai)).toBeInstanceOf(Map)
    })

    it('should throw an error if vectors is not an array', async () => {
      await expect(extVectorStore.load(null)).rejects.toThrow('Vectors must be an array')
      await expect(extVectorStore.load(undefined)).rejects.toThrow('Vectors must be an array')
      await expect(extVectorStore.load('string')).rejects.toThrow('Vectors must be an array')
    })

    it('should throw an error if any vector is missing content or hrefs', async () => {
      await expect(extVectorStore.load([{content: 'test'}])).rejects.toThrow(
        'Each vector must have content and non-empty hrefs array',
      )
      await expect(extVectorStore.load([{hrefs: ['test']}])).rejects.toThrow(
        'Each vector must have content and non-empty hrefs array',
      )
      await expect(extVectorStore.load([{content: 'test', hrefs: []}])).rejects.toThrow(
        'Each vector must have content and non-empty hrefs array',
      )
    })

    it('should create clear context if keep false', async () => {
      const mockVectors = [
        {
          content: 'test content',
          hrefs: ['testHref'],
        },
      ]

      const store = new Map([
        [
          EmbStorageType.openai,
          new Map([
            [
              'id',
              {
                content: 'some content',
                embedding: [0.4234231324],
              },
            ],
          ]),
        ],
      ])

      LLMVector.findOne.mockImplementation(() => ({
        save: jest.fn().mockResolvedValue(undefined),
        markModified: jest.fn(),
        store,
      }))

      const mockVector = {
        content: 'test content',
        embedding: [0.234234, 0.324234],
        metadata: {source: ['testHref']},
      }

      jest.spyOn(extVectorStore.memoryVectorStore, 'addDocuments').mockImplementation(() => {
        extVectorStore.memoryVectorStore.memoryVectors = [mockVector]
      })

      await extVectorStore.load(mockVectors, false)

      expect(Array.from(store.get(EmbStorageType.openai).entries())).toEqual([
        [
          'testHref',
          [
            {
              content: 'test content',
              embedding: [0.234234, 0.324234],
              metadata: {source: ['testHref']},
            },
          ],
        ],
      ])
    })

    it('should keep existing context if keep true', async () => {
      const mockVectors = [
        {
          content: 'test content',
          hrefs: ['testHref1'],
        },
      ]

      const existingVector = {
        content: 'some content',
        embedding: [0.4234231324],
      }
      const store = new Map([[EmbStorageType.openai, new Map([['testHref1', [existingVector]]])]])

      LLMVector.findOne.mockImplementation(() => ({
        save: jest.fn().mockResolvedValue(undefined),
        markModified: jest.fn(),
        store,
      }))

      const mockVector = {
        content: 'test content',
        embedding: [0.234234, 0.324234],
        metadata: {source: ['testHref2']},
      }

      jest.spyOn(extVectorStore.memoryVectorStore, 'addDocuments').mockImplementation(() => {
        extVectorStore.memoryVectorStore.memoryVectors = [mockVector]
      })

      await extVectorStore.load(mockVectors, true)

      expect(Array.from(store.get(EmbStorageType.openai).entries())).toEqual([
        ['testHref1', [existingVector]],
        ['testHref2', [mockVector]],
      ])
    })
  })
})
