import debug from 'debug'
import {WebCommand} from '../../../controllers/commandExecutor/commands/WebCommand'
import {CommandStringBuilder} from '../context/CommandStringBuilder'

const log = debug('delta5:mcp:research-rag:web-search-qa')

export class WebSearchQATool {
  constructor(userContextProvider, commandContextAdapter) {
    this.userContextProvider = userContextProvider
    this.commandContextAdapter = commandContextAdapter
    this.commandStringBuilder = new CommandStringBuilder()
    this.logError = log.extend('ERROR*', '::')
  }

  getSchema() {
    return {
      name: 'web_search_qa',
      description: 'Search the web and answer questions based on search results',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query or question',
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
        },
        required: ['query'],
      },
    }
  }

  async execute(args) {
    try {
      const params = this.commandContextAdapter.parseWebSearchParams(args)
      const userId = this.userContextProvider.getUserId()
      const syntheticNode = this.commandStringBuilder.buildSyntheticNode(params)

      const command = new WebCommand(userId, null, null)
      const result = await command.createResponseWeb(syntheticNode, args.query, params)

      return {
        content: [{type: 'text', text: result || '(empty response)'}],
      }
    } catch (error) {
      this.logError('Web search error:', error)
      return {
        content: [{type: 'text', text: `Error: ${error.message}`}],
        isError: true,
      }
    }
  }
}
