import {WebVectorStore} from './vectorStore/WebVectorStore'
import {DocumentRetriever, USEFUL_NUMBER_OF_TOKENS} from './DocumentRetriever'
import {getEmbeddings, Model} from './getLLM'
import {SearchScrape} from './SearchScrape'
import {estimateTokenCount} from './estimateTokenCount'
import {BaseChain} from 'langchain/chains'

jest.mock('./estimateTokenCount')

describe('DocumentRetriever', () => {
  const settings = {openai: {apiKey: 'apiKey'}}
  const embeddings = getEmbeddings({settings, type: Model.OpenAI})
  const storageKey = 'storageKey'
  const vectorStore = new WebVectorStore({...embeddings, storageKey})
  const llm = {}
  const tool = new DocumentRetriever(vectorStore, {chunkSize: 16000, maxChunks: 1, llm, disableSearchScrape: false})

  const serpCallSpy = jest.spyOn(SearchScrape.prototype, 'callSerpAPI')
  const scrapeSpy = jest.spyOn(SearchScrape.prototype, 'callScrape')
  const loadVectorsSpy = jest.spyOn(vectorStore, 'load')
  const relevantSpy = jest.spyOn(vectorStore, 'getRelevantData')
  const refineSpy = jest.spyOn(BaseChain.prototype, 'call')

  beforeEach(() => {
    serpCallSpy.mockClear()
    scrapeSpy.mockClear()
    loadVectorsSpy.mockClear()
    relevantSpy.mockClear()
    refineSpy.mockClear()
  })

  describe('getDocuments', () => {
    it('should save documents text sources to metadata', async () => {
      serpCallSpy.mockResolvedValue({
        hrefs: [],
        snippets: 'snippets',
        organicResults: [{link: 'url'}],
      })
      scrapeSpy.mockResolvedValueOnce([])

      const doc = {
        pageContent: 'content',
        metadata: {
          source: ['url'],
        },
      }
      relevantSpy.mockResolvedValueOnce([doc])
      const docs = await tool.getDocuments('input')

      expect(docs[0].metadata.source).toEqual(['url'])
    })
  })

  describe('getCitations', () => {
    it('should extract citations from document sources', () => {
      const docs = [
        {metadata: {source: ['https://example.com/1', 'https://example.com/2']}},
        {metadata: {source: ['https://example.com/3']}},
      ]

      const citations = tool.getCitations(docs)

      expect(citations).toEqual(['https://example.com/1', 'https://example.com/2', 'https://example.com/3'])
    })

    it('should handle empty source arrays', () => {
      const docs = [{metadata: {source: []}}, {metadata: {source: ['https://example.com/1']}}]

      const citations = tool.getCitations(docs)

      expect(citations).toEqual(['https://example.com/1'])
    })

    it('should handle documents without source metadata', () => {
      const docs = [{metadata: {}}, {metadata: {source: ['https://example.com/1']}}]

      const citations = tool.getCitations(docs)

      expect(citations).toEqual(['https://example.com/1'])
    })

    it('should remove duplicate URLs', () => {
      const docs = [
        {metadata: {source: ['https://example.com/1', 'https://example.com/1']}},
        {metadata: {source: ['https://example.com/1', 'https://example.com/2']}},
      ]

      const citations = tool.getCitations(docs)

      expect(citations).toEqual(['https://example.com/1', 'https://example.com/2'])
      expect(citations.length).toBe(2)
    })

    it('should be case sensitive', () => {
      const docs = [{metadata: {source: ['https://Example.com/1', 'https://example.com/1']}}]

      const citations = tool.getCitations(docs)

      expect(citations).toHaveLength(2)
      expect(citations).toContain('https://Example.com/1')
      expect(citations).toContain('https://example.com/1')
    })

    it('should trim whitespace from URLs', () => {
      const docs = [{metadata: {source: [' https://example.com/1 ', '  https://example.com/2  ']}}]

      const citations = tool.getCitations(docs)

      expect(citations).toEqual(['https://example.com/1', 'https://example.com/2'])
    })

    it('should include empty URLs after trimming', () => {
      const docs = [{metadata: {source: ['https://example.com/1', '', '  ']}}]

      const citations = tool.getCitations(docs)

      // Backend version doesn't filter empty strings after trimming
      expect(citations).toContain('https://example.com/1')
      expect(citations).toContain('') // Empty string is included
    })

    it('should handle a mix of valid, empty, and duplicate sources', () => {
      const docs = [
        {metadata: {source: ['https://example.com/1', '', '  ']}},
        {metadata: {source: ['https://example.com/1', 'https://example.com/2']}},
        {metadata: {}},
        {metadata: {source: []}},
      ]

      const citations = tool.getCitations(docs)

      expect(citations).toContain('https://example.com/1')
      expect(citations).toContain('https://example.com/2')
      expect(citations).toContain('') // Backend includes empty strings
    })
  })

  describe('runImprovementRefineChain', () => {
    beforeEach(() => {
      tool.detectNoUsefulInfo = jest.fn().mockResolvedValue(true)
    })

    it('should call detectNoUsefulInfo when token count is below threshold', async () => {
      estimateTokenCount.mockReturnValue(USEFUL_NUMBER_OF_TOKENS - 1)

      const question = 'Test question'
      const input_documents = [{pageContent: 'Short text', metadata: {source: 'source'}}]

      refineSpy.mockResolvedValue({output_text: 'result'})

      await tool.runImprovementRefineChain(question, input_documents)

      expect(tool.detectNoUsefulInfo).toHaveBeenCalled()
    })

    it('should not call detectNoUsefulInfo when token count is above threshold', async () => {
      estimateTokenCount.mockReturnValue(USEFUL_NUMBER_OF_TOKENS + 1)

      const question = 'Test question'
      const input_documents = [{pageContent: 'Longer text', metadata: {source: 'source'}}]

      refineSpy.mockResolvedValue({output_text: 'result'})

      await tool.runImprovementRefineChain(question, input_documents)

      expect(tool.detectNoUsefulInfo).not.toHaveBeenCalled()
    })
  })
})
