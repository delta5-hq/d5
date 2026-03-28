import debug from 'debug'
import {ScholarCommand} from '../../../controllers/commandExecutor/commands/ScholarCommand'
import {CommandStringBuilder} from '../context/CommandStringBuilder'

const log = debug('delta5:mcp:research-rag:scholar-search-qa')

export class ScholarSearchQATool {
  constructor(userContextProvider, commandContextAdapter) {
    this.userContextProvider = userContextProvider
    this.commandContextAdapter = commandContextAdapter
    this.commandStringBuilder = new CommandStringBuilder()
    this.logError = log.extend('ERROR*', '::')
  }

  getSchema() {
    return {
      name: 'scholar_search_qa',
      description: 'Search academic papers and answer questions based on scholarly sources',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The academic search query or question',
          },
          lang: {
            type: 'string',
            description: 'Output language code (e.g., "ru", "en"). Optional.',
          },
          citations: {
            type: 'boolean',
            description: 'Include source citations in the response. Optional.',
          },
          maxChunks: {
            type: 'string',
            description: 'Maximum chunks size: xxs, xs, s, m, l, xl, xxl. Optional.',
          },
          minYear: {
            type: 'number',
            description: 'Minimum publication year for search results. Optional.',
          },
        },
        required: ['query'],
      },
    }
  }

  async execute(args) {
    try {
      const params = this.commandContextAdapter.parseScholarSearchParams(args)
      const userId = this.userContextProvider.getUserId()
      const syntheticNode = this.commandStringBuilder.buildSyntheticNode(params)

      const command = new ScholarCommand(userId, null, null)
      const result = await command.createResponseScholar(syntheticNode, args.query, params)

      return {
        content: [{type: 'text', text: result || '(empty response)'}],
      }
    } catch (error) {
      this.logError('Scholar search error:', error)
      return {
        content: [{type: 'text', text: `Error: ${error.message}`}],
        isError: true,
      }
    }
  }
}
