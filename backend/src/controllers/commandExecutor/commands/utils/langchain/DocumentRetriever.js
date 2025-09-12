import {RecursiveCharacterTextSplitter} from 'langchain/text_splitter'
import {LANG_DEFAULT_VALUE} from '../../../constants'
import {
  getSearchScrapeDescription,
  getSearchScrapeName,
  USEFUL_INFO,
} from '../../../constants/localizedPrompts/SearchScrapeConstants'
import {SearchScrape} from './SearchScrape'
import {deleteDuplications} from '../../../../utils/deleteDuplications'
import {estimateTokenCount} from './estimateTokenCount'
import {LLMChain, PromptTemplate} from 'langchain'
import {isStrSimilar} from '../../../../../utils/isStrSimilar'

const DEFAULT_NAME = 'SearchScrape'
const DEFAULT_SERP_API_PARAMS = {}
const DEFAULT_CHUNK_SIZE = 16000
const DEFAULT_MAX_CHUNKS = 4
const DEFAULT_MAX_COUNT_ITERATIONS = 99
const DEFAULT_SERPAPI_PAGE_SIZE = 10
const ORDERED_DOCS_INITIAL_CHUNK_NUM = 1
export const USEFUL_NUMBER_OF_TOKENS = 500
const NO_USEFUL_INFO = "there's no useful info"
const EMPTY_RESPONSE = 'Not found'

export class DocumentRetriever extends SearchScrape {
  description =
    'A wrapper around Google Search. Useful for when you need to answer questions about current events. Input should be a search query.'

  constructor(vectorStore, params) {
    super(params)
    const {
      name,
      llm,
      serpApiParams,
      maxChunks,
      chunkSize,
      disableSearchScrape,
      onError,
      isCitationsNeeded,
      hrefs,
      abortSignal,
      lang,
      userInput,
    } = params

    if (!llm) {
      throw new Error('LLM is required')
    }

    if (!vectorStore) {
      throw new Error('Vector Store is required')
    }

    this.vectorStore = vectorStore

    this.params = {
      llm,
      name: name || DEFAULT_NAME,
      serpApiParams: serpApiParams || DEFAULT_SERP_API_PARAMS,
      maxChunks: maxChunks || DEFAULT_MAX_CHUNKS,
      chunkSize: chunkSize || DEFAULT_CHUNK_SIZE,
      disableSearchScrape: disableSearchScrape || false,
      onError,
      isCitationsNeeded: isCitationsNeeded || false,
      hrefs: hrefs || [],
      abortSignal,
      lang: lang || LANG_DEFAULT_VALUE,
      userInput,
    }
    this.name = getSearchScrapeName(this.params.lang)
    this.description = getSearchScrapeDescription(this.params.lang)

    this.splitter = new RecursiveCharacterTextSplitter({
      chunkSize: this.params.chunkSize,
    })
  }

  getCitations(docs) {
    const citations = new Set()

    docs.forEach(d => {
      if (Array.isArray(d.metadata.source)) {
        d.metadata.source.forEach(href => {
          const normalizedHref = href.trim()
          citations.add(normalizedHref)
        })
      }
    })

    return Array.from(citations)
  }

  async splitDocumentsByChunkSize(docs) {
    const chunkSize = Math.floor((this.params.chunkSize / 2) * 0.9)
    const newDocuments = []
    let accumulatedContent = ''
    let accumulatedSources = []

    for (let i = 0; i < docs.length; i += 1) {
      const doc = docs[i]
      let remainingContent = doc.pageContent

      while (remainingContent.length) {
        const availableSpace = chunkSize - estimateTokenCount(accumulatedContent)

        if (remainingContent.length > availableSpace) {
          // Take only the part that fits in the current chunk
          accumulatedContent += remainingContent.slice(0, availableSpace)
          remainingContent = remainingContent.slice(availableSpace)
        } else {
          // Add the entire remaining content if it fits
          accumulatedContent += remainingContent
          remainingContent = ''
        }

        // Add current document sources to accumulated sources
        const source = doc.metadata.source
        accumulatedSources = accumulatedSources.concat(source)

        // If accumulated content reaches or exceeds the max chunk size or the remaining content is empty
        if (estimateTokenCount(accumulatedContent) >= chunkSize) {
          newDocuments.push(this.createDocument(accumulatedContent.trim(), deleteDuplications(accumulatedSources)))

          accumulatedContent = ''
          // When only part of the text is added, it is not known how the sources were distributed throughout the text,
          // so they are added to both the current and the next document.
          accumulatedSources = remainingContent.length > 0 ? [...source] : []
        }
      }
    }

    // Add last data to array
    if (accumulatedContent.length) {
      newDocuments.push(this.createDocument(accumulatedContent.trim(), deleteDuplications(accumulatedSources)))
    }

    return newDocuments
  }

  async callWithCitations(input) {
    try {
      const docs = await this.getDocuments(input)

      if (!docs.length) {
        return EMPTY_RESPONSE
      }

      const question = this.params.userInput || input
      const {output: result, citations} = await this.runImprovementRefineChain(question, docs)

      if (this.params.isCitationsNeeded) {
        return {citations, result}
      }

      return result
    } catch (e) {
      if (this.params.onError) {
        this.params.onError(e)
      }
      throw e
    }
  }

  async _call(input) {
    try {
      const docs = await this.getDocuments(input)

      if (!docs.length) {
        return EMPTY_RESPONSE
      }
      const result = await super.runRefinementQAChain(this.params.userInput || input, docs)

      return result
    } catch (e) {
      if (this.params.onError) {
        this.params.onError(e)
      }
      throw e
    }
  }

  createDocument(content, hrefs) {
    return {
      pageContent: content,
      metadata: {
        source: hrefs,
        loc: {
          lines: {
            from: 0,
            to: 1,
          },
        },
      },
    }
  }

  async getDocuments(input) {
    if (this.params.disableSearchScrape) {
      return this.vectorStore.getRelevantData(input, this.params.maxChunks)
    }

    const orderedDocs = []
    let startFrom = 0
    let iterations = 0

    /* eslint-disable no-await-in-loop */
    while (iterations < DEFAULT_MAX_COUNT_ITERATIONS && orderedDocs.length < this.params.maxChunks) {
      const {hrefs, snippets, organicResults = []} = await super.callSerpAPI(input, startFrom)

      if (!organicResults.length) {
        return []
      }
      const filteredHrefs = hrefs.filter(href => !this.vectorStore.sourceLinks.includes(href))

      if (hrefs.length) {
        const selectedHrefs = this.params.maxChunks === 1 ? filteredHrefs.slice(0, 2) : filteredHrefs
        const selectedSnippets =
          this.params.maxChunks === 1 ? snippets.filter(s => s.href && selectedHrefs.includes(s.href)) : snippets

        const scrapeResult = await super.callScrape(selectedHrefs, selectedSnippets)

        if (scrapeResult.length && scrapeResult[0].content.length) {
          if (this.params.maxChunks === 1) {
            const scrapeResultTrimmed = scrapeResult.slice(0, ORDERED_DOCS_INITIAL_CHUNK_NUM)
            return [
              this.createDocument(
                scrapeResultTrimmed.map(x => x.content).join(' '),
                scrapeResultTrimmed.reduce((arr, x) => arr.concat(x.hrefs), []),
              ),
            ]
          }
          const newDocs = await this.vectorStore.load(scrapeResult)

          orderedDocs.push(...newDocs)
        }
      }

      startFrom += DEFAULT_SERPAPI_PAGE_SIZE
      iterations += 1
    }

    let calculatedMaxChunks = this.params.maxChunks
    const {chunkSize} = this.params
    const vectorStoreChunkSize = this.vectorStore.chunkSize
    if (vectorStoreChunkSize < chunkSize) {
      calculatedMaxChunks *= Math.floor(chunkSize / vectorStoreChunkSize)
    }

    const relevantDocs = await this.vectorStore.getRelevantData(
      input,
      calculatedMaxChunks - ORDERED_DOCS_INITIAL_CHUNK_NUM,
    )

    const filteredOrderedDocs = orderedDocs.filter(
      doc => !relevantDocs.some(relDoc => isStrSimilar(relDoc.pageContent, doc.pageContent, 0.95)),
    )

    const docs = [
      ...filteredOrderedDocs.slice(0, ORDERED_DOCS_INITIAL_CHUNK_NUM),
      ...relevantDocs,
      ...filteredOrderedDocs.slice(ORDERED_DOCS_INITIAL_CHUNK_NUM, this.params.maxChunks - relevantDocs.length),
    ]

    return docs
  }

  async detectNoUsefulInfo(inputText) {
    if (inputText.toLowerCase().includes(NO_USEFUL_INFO)) {
      return true
    }

    const prompt = new PromptTemplate({
      template: USEFUL_INFO,
      inputVariables: ['input'],
    })

    const chain = new LLMChain({
      llm: this.params.llm,
      prompt,
    })

    const result = await chain.run(inputText)

    return result.toLowerCase() === 'true'
  }

  async groupAndSplitDocuments(input_documents) {
    const grouped = {}

    input_documents.forEach(doc => {
      const source = doc.metadata.source[0] // Source is always a single-element array in this case
      if (!grouped[source]) {
        grouped[source] = ''
      }
      grouped[source] += `${doc.pageContent}\n`
    })

    const docGroups = []

    // eslint-disable-next-line no-restricted-syntax
    for (const [source, content] of Object.entries(grouped)) {
      const splitDocs = (await this.splitter.createDocuments([content])).map(doc =>
        this.createDocument(doc.pageContent, [source]),
      )

      docGroups.push(splitDocs)
    }

    return docGroups
  }

  async runImprovementRefineChain(question, input_documents) {
    const docGroups = await this.groupAndSplitDocuments(input_documents)

    const refineFunction = async (question, input_documents) => {
      const output = await this.runRefinementQAChain(question, input_documents)

      // Optimization: response longer than 500 tokens is considered useful
      const isWeakAnswer = estimateTokenCount(output) < USEFUL_NUMBER_OF_TOKENS
      if (isWeakAnswer && (await this.detectNoUsefulInfo(output))) {
        return undefined
      }
      return {output, input_documents}
    }

    const refineTasks = docGroups.map(group => refineFunction(question, group))

    const data = (await Promise.allSettled(refineTasks))
      .filter(result => result.status === 'fulfilled' && result.value !== undefined)
      .map(result => result.value)

    const selectedDocs = data.map(({input_documents}) => input_documents[0])
    const generatedTextDocs = await this.splitter.createDocuments(data.map(({output}) => output))
    const recreatedTextDocs = await this.splitDocumentsByChunkSize(generatedTextDocs)

    if (!recreatedTextDocs.length) {
      return {output: EMPTY_RESPONSE, citations: []}
    }

    const output = await this.runRefinementQAChain(question, recreatedTextDocs)

    return {
      output,
      citations: this.getCitations(selectedDocs),
    }
  }
}
