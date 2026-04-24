import debug from 'debug'
import {scrapeFiles} from '../../../controllers/utils/scrape'
import {UrlExtractor} from '../context/UrlExtractor'
import {ScrapeParamsAdapter} from '../context/ScrapeParamsAdapter'

const log = debug('delta5:mcp:scraper:scrape-tool')

export class ScrapeTool {
  constructor() {
    this.urlExtractor = new UrlExtractor()
    this.paramsAdapter = new ScrapeParamsAdapter()
    this.logError = log.extend('ERROR*', '::')
  }

  getSchema() {
    return {
      name: 'scrape_web_pages',
      description: 'Scrape text content from web pages and PDFs. Returns filename and content for each URL.',
      inputSchema: {
        type: 'object',
        properties: {
          urls: {
            type: 'array',
            items: {type: 'string'},
            description: 'Array of URLs to scrape. Optional if text is provided.',
          },
          text: {
            type: 'string',
            description: 'Freeform text containing URLs to extract and scrape. Optional if urls is provided.',
          },
          maxSize: {
            type: 'string',
            description: 'Maximum file size (e.g., "5mb", "10mb"). Default: "5mb".',
          },
          maxPages: {
            type: 'string',
            description: 'Maximum pages for PDFs. Default: "100".',
          },
        },
      },
    }
  }

  async execute(args) {
    try {
      let urls = args.urls || []

      if (!urls.length && args.text) {
        urls = this.urlExtractor.extractUniqueUrls(args.text)
      }

      if (!urls.length) {
        return {
          content: [{type: 'text', text: 'No URLs provided or found in text input.'}],
        }
      }

      const params = this.paramsAdapter.adaptParams(args)
      const results = await scrapeFiles(urls, params)

      if (!results.length) {
        return {
          content: [{type: 'text', text: 'No content could be scraped from provided URLs.'}],
        }
      }

      const formattedResults = results
        .map(({filename, content}) => `File: ${filename}\n\n${content}`)
        .join('\n\n---\n\n')

      return {
        content: [{type: 'text', text: formattedResults}],
      }
    } catch (error) {
      this.logError('Scrape error:', error)
      return {
        content: [{type: 'text', text: `Error: ${error.message}`}],
        isError: true,
      }
    }
  }
}
