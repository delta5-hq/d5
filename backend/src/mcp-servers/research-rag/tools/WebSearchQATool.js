import debug from 'debug'
import {z} from 'zod'
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

  getName() {
    return 'web_search_qa'
  }

  getDescription() {
    return 'Search the web and answer questions based on search results'
  }

  getZodShape() {
    return {
      query: z.string().describe('The search query or question'),
      lang: z.string().optional().describe('Output language code (e.g., "ru", "en").'),
      citations: z.boolean().optional().describe('Include source citations in the response.'),
      maxChunks: z.string().optional().describe('Maximum chunks size: xxs, xs, s, m, l, xl, xxl.'),
    }
  }

  async execute(args) {
    try {
      const params = this.commandContextAdapter.parseWebSearchParams(args)
      const userId = this.userContextProvider.getUserId()
      const workflowId = this.userContextProvider.getWorkflowId()
      const syntheticNode = this.commandStringBuilder.buildSyntheticNode(params)

      const command = new WebCommand(userId, workflowId, null)
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
