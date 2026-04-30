import debug from 'debug'
import {ExtCommand} from '../../../controllers/commandExecutor/commands/ExtCommand'
import {CommandStringBuilder} from '../context/CommandStringBuilder'

const log = debug('delta5:mcp:research-rag:kb-query')

export class KnowledgeBaseQueryTool {
  constructor(userContextProvider, commandContextAdapter) {
    this.userContextProvider = userContextProvider
    this.commandContextAdapter = commandContextAdapter
    this.commandStringBuilder = new CommandStringBuilder()
    this.logError = log.extend('ERROR*', '::')
  }

  getSchema() {
    return {
      name: 'kb_query',
      description: 'Query the user knowledge base (vectorized documents)',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The query to search in the knowledge base',
          },
          context: {
            type: 'string',
            description: 'Knowledge base context name. Optional.',
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
      const params = this.commandContextAdapter.parseKnowledgeBaseParams(args)
      const userId = this.userContextProvider.getUserId()
      const syntheticNode = this.commandStringBuilder.buildSyntheticNode(params)

      const command = new ExtCommand(userId, null, null)
      const result = await command.createResponseExt(syntheticNode, args.query, params)

      return {
        content: [{type: 'text', text: result || '(empty response)'}],
      }
    } catch (error) {
      this.logError('Knowledge base query error:', error)
      return {
        content: [{type: 'text', text: `Error: ${error.message}`}],
        isError: true,
      }
    }
  }
}
