import {Tool} from 'langchain/tools'
import {RecursiveCharacterTextSplitter} from 'langchain/text_splitter'
import {RefineDocumentsChain} from 'langchain/chains'
import {ConditionalPromptSelector, PromptTemplate} from 'langchain/prompts'
import {SearchRefineLLMChain} from './SearchRefineLLMChain'
import {
  getSearchScrapeDescription,
  getSearchScrapeName,
  getSearchScrapeQestionPrompt,
  getSearchScrapeRefinePrompt,
} from './../../../constants/localizedPrompts/SearchScrapeConstants'
import {LANG_DEFAULT_VALUE} from '../../../constants'
import fetch from 'node-fetch'
import {PhraseChunkBuilderV2, scrape} from '../../../../utils/scrape'
import {SERP_API_KEY} from '../../../../../constants'
import debug from 'debug'

const DEFAULT_SERP_BASE_URL = 'https://serpapi.com'
const DEFAULT_SERP_API_PARAMS = {}
const DEFAULT_CHUNK_SIZE = 16000
const DEFAULT_MAX_CHUNKS = 4

export const NOTHING_FOUND = 'Nothing found'

export class SearchScrape extends Tool {
  name

  description

  params

  constructor({llm, serpApiParams, maxChunks, chunkSize, onError, hrefs, abortSignal, lang, userInput, log}) {
    super()

    if (!llm) {
      throw new Error('LLM is required')
    }

    this.params = {
      llm,
      serpApiParams: serpApiParams || DEFAULT_SERP_API_PARAMS,
      maxChunks: maxChunks || DEFAULT_MAX_CHUNKS,
      chunkSize: chunkSize || DEFAULT_CHUNK_SIZE,
      onError,
      hrefs: hrefs || [],
      abortSignal,
      lang: lang || LANG_DEFAULT_VALUE,
      userInput,
    }
    this.log = log || debug('app:SearchScrape')
    this.name = getSearchScrapeName(this.params.lang)
    this.description = getSearchScrapeDescription(this.params.lang)
  }

  buildUrl(path, params) {
    const nonUndefinedParams = Object.entries(params)
      .filter(param => param[1] !== undefined)
      .map(([key, value]) => [key, `${value}`])
    const searchParams = new URLSearchParams(nonUndefinedParams)
    return `${DEFAULT_SERP_BASE_URL}/${path}?${searchParams}`
  }

  async callSerpAPI(input, start) {
    try {
      this.log('Call serp api', {params: this.params.serpApiParams})
      const {timeout, resources: allowedFileFormats, ...params} = this.params.serpApiParams
      const controller = new AbortController()

      const timeoutId = setTimeout(() => {
        controller.abort()
      }, timeout)

      const resp = await fetch(
        this.buildUrl('search', {
          ...params,
          api_key: SERP_API_KEY,
          start: start || params.start || 0,
          q: input,
        }),
        {signal: this.params.abortSignal},
      )
      clearTimeout(timeoutId)
      const data = await resp.json()
      const hrefs = allowedFileFormats ? this.getHrefsForFileFormats(data, allowedFileFormats) : this.getHrefs(data)
      const snippets = this.getSnippets(data, allowedFileFormats)
      this.log('Get response from serp api', {hrefs, snippets})
      return {
        hrefs,
        snippets,
        organicResults: data.organic_results,
      }
    } catch (e) {
      if (this.params.onError) {
        this.params.onError(e)
      }
      throw e
    }
  }

  getHrefs(data) {
    if (!data || !data.organic_results || !data.organic_results.length) {
      return []
    }

    return data?.organic_results?.map(organic_result => organic_result.link) || []
  }

  getHrefsForFileFormats(data, allowedFileFormats) {
    if (!data || !data.organic_results || !data.organic_results.length) {
      return []
    }

    return data.organic_results
      .map(
        organic_result =>
          organic_result.resources?.find(r => allowedFileFormats.includes(r.file_format?.toUpperCase()))?.link,
      )
      .filter(Boolean)
  }

  getSnippets(data, allowedFileFormats) {
    const snippets = []
    if (data && data.organic_results && data.organic_results.length > 0) {
      // eslint-disable-next-line no-restricted-syntax
      for (const organic_result of data.organic_results) {
        if (!allowedFileFormats) {
          if (organic_result.snippet) {
            snippets.push({
              snippet: organic_result.snippet,
              href: organic_result.link,
            })
          }
        }
      }
    }

    const {snippet, link} = data.answer_box || {}

    if (snippet && link) {
      snippets.push({
        snippet,
        href: link,
      })
    }

    return snippets
  }

  async callScrape(hrefs, snippets, Builder = PhraseChunkBuilderV2) {
    try {
      const chunks = await scrape(hrefs, snippets, this.params.maxChunks, this.params.chunkSize, Builder)
      this.log('Scrape websites')
      return chunks
    } catch (e) {
      if (this.params.onError) {
        this.params.onError(e)
      }
      throw e
    }
  }

  async runRefinementQAChain(question, input_documents) {
    const refinePropmtTemplate = new PromptTemplate({
      inputVariables: ['question', 'existing_answer', 'context'],
      template: getSearchScrapeRefinePrompt(this.params.lang),
    })
    const questionPromptTemplate = new PromptTemplate({
      inputVariables: ['context', 'question'],
      template: getSearchScrapeQestionPrompt(this.params.lang),
    })

    const chain = new RefineDocumentsChain({
      llmChain: new SearchRefineLLMChain({
        prompt: new ConditionalPromptSelector(questionPromptTemplate).getPrompt(this.params.llm),
        llm: this.params.llm,
      }),
      refineLLMChain: new SearchRefineLLMChain({
        prompt: new ConditionalPromptSelector(refinePropmtTemplate).getPrompt(this.params.llm),
        llm: this.params.llm,
      }),
    })

    this.log('Run runRefinementQAChain', {question})
    const res = await chain.call({
      input_documents,
      question,
      signal: this.params.abortSignal,
    })

    return res.output_text
  }

  async fetchAndProcessSearchResults(input) {
    const hrefs = []
    let snippets = ''

    if (!this.params.hrefs.length) {
      const serpApiRes = await this.callSerpAPI(input)
      hrefs.push(...serpApiRes.hrefs)
      snippets += serpApiRes.snippets
    } else {
      hrefs.push(...this.params.hrefs)
    }
    const scrapeResult = await this.callScrape(hrefs, snippets)
    const pagesText = []
    const citations = []

    scrapeResult.forEach(chunk => {
      pagesText.push(chunk.content)

      chunk.hrefs.forEach(href => {
        if (!citations.includes(href)) {
          citations.push(href)
        }
      })
    })

    if (!pagesText.length) {
      return undefined
    }

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: this.params.chunkSize,
    })
    const docs = await splitter.createDocuments(pagesText)

    return {docs, citations}
  }

  async _call(input) {
    try {
      const data = await this.fetchAndProcessSearchResults(input)

      if (!data) {
        return NOTHING_FOUND
      }

      const {docs} = data

      const result = await this.runRefinementQAChain(this.params.userInput || input, docs)

      return result
    } catch (e) {
      if (this.params.onError) {
        this.params.onError(e)
      }
      throw e
    }
  }
}
