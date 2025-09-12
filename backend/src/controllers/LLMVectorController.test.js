import {MemoryVectorStore} from 'langchain/vectorstores/memory'
import {RecursiveCharacterTextSplitter} from 'langchain/text_splitter'
import LLMVector from '../models/LLMVector'
import {EmbStorageType} from '../shared/config/constants'
import LLMVectorController from './LLMVectorController'

jest.mock('langchain/vectorstores/memory')
jest.mock('langchain/text_splitter')
jest.mock('../models/LLMVector')

describe('LLMVectorController', () => {
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
  })

  it('should create a new context and clear store if keep is false', async () => {
    const mockCtx = {
      state: {userId: 'testUser'},
      request: {
        json: jest.fn().mockResolvedValue({
          contextName: null,
          type: EmbStorageType.openai,
          keep: false,
          data: {
            testHref: [
              {
                content: 'test content',
                embedding: [0.123, 0.456],
              },
            ],
          },
        }),
      },
      throw: jest.fn((code, message) => {
        const err = new Error(message)
        err.statusCode = code
        throw err
      }),
      body: null,
    }

    const save = jest.fn()
    const markModified = jest.fn()
    const store = new Map([[EmbStorageType.openai, new Map([['id', {content: 'old', embedding: [1]}]])]])

    LLMVector.findOne.mockResolvedValue(null)
    LLMVector.mockImplementation(() => ({
      save,
      markModified,
      store,
    }))

    await LLMVectorController.save(mockCtx)

    const savedMap = store.get(EmbStorageType.openai)
    expect(savedMap.size).toBe(1)
    expect(savedMap.get('testHref')).toEqual([
      {
        content: 'test content',
        embedding: [0.123, 0.456],
      },
    ])
    expect(markModified).toHaveBeenCalledWith('store')
    expect(save).toHaveBeenCalled()
  })

  it('should append data to existing store if keep is true', async () => {
    const mockCtx = {
      state: {userId: 'testUser'},
      request: {
        json: jest.fn().mockResolvedValue({
          contextName: null,
          type: EmbStorageType.openai,
          keep: true,
          data: {
            testHref2: [
              {
                content: 'new content',
                embedding: [0.111, 0.222],
              },
            ],
          },
        }),
      },
      throw: jest.fn((code, message) => {
        const err = new Error(message)
        err.statusCode = code
        throw err
      }),
      body: null,
    }

    const save = jest.fn()
    const markModified = jest.fn()
    const existingVector = {
      content: 'old content',
      embedding: [0.999, 0.888],
    }

    const store = new Map([[EmbStorageType.openai, new Map([['testHref1', [existingVector]]])]])

    LLMVector.findOne.mockResolvedValue({
      save,
      markModified,
      store,
    })

    await LLMVectorController.save(mockCtx)

    const tStore = store.get(EmbStorageType.openai)
    expect(Array.from(tStore.entries())).toEqual([
      ['testHref1', [existingVector]],
      [
        'testHref2',
        [
          {
            content: 'new content',
            embedding: [0.111, 0.222],
          },
        ],
      ],
    ])
    expect(markModified).toHaveBeenCalledWith('store')
    expect(save).toHaveBeenCalled()
  })
})
