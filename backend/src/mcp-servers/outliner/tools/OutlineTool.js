import debug from 'debug'
import {OutlineCommand} from '../../../controllers/commandExecutor/commands/OutlineCommand'
import {OutlineParamsAdapter} from '../context/OutlineParamsAdapter'
import {OutlineCommandStringBuilder} from '../context/OutlineCommandStringBuilder'

const log = debug('delta5:mcp:outliner:outline-tool')

export class OutlineTool {
  constructor(userContextProvider) {
    this.userContextProvider = userContextProvider
    this.paramsAdapter = new OutlineParamsAdapter()
    this.commandStringBuilder = new OutlineCommandStringBuilder()
    this.logError = log.extend('ERROR*', '::')
  }

  getSchema() {
    return {
      name: 'generate_outline',
      description:
        'Generate a structured hierarchical outline from web search, academic search, or knowledge base. Returns a text tree.',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The topic or question to outline.',
          },
          web: {
            type: 'string',
            description:
              'Web search mode with chunk size (xxs, xs, s, m, l, xl, xxl). Mutually exclusive with scholar/ext.',
          },
          scholar: {
            type: 'string',
            description:
              'Academic search mode with chunk size (xxs, xs, s, m, l, xl, xxl). Mutually exclusive with web/ext.',
          },
          ext: {
            type: 'boolean',
            description: 'Use knowledge base instead of web/scholar. Mutually exclusive with web/scholar.',
          },
          context: {
            type: 'string',
            description: 'Knowledge base context name (when ext=true).',
          },
          href: {
            type: 'string',
            description: 'Specific URL to outline from.',
          },
          minYear: {
            type: 'number',
            description: 'Minimum publication year for scholar search.',
          },
          lang: {
            type: 'string',
            description: 'Output language code (e.g., "ru", "en").',
          },
          citations: {
            type: 'boolean',
            description: 'Include source citations in the response.',
          },
          maxChunks: {
            type: 'string',
            description: 'Direct chunk size override (xxs, xs, s, m, l, xl, xxl).',
          },
        },
        required: ['query'],
      },
    }
  }

  async execute(args) {
    try {
      const params = this.paramsAdapter.adaptParams(args)
      const userId = this.userContextProvider.getUserId()
      const syntheticNode = this.commandStringBuilder.buildSyntheticNode(params)

      const command = new OutlineCommand(userId, null, null)
      const result = await command.createResponseOutline(syntheticNode, args.query, params)

      return {
        content: [{type: 'text', text: result || '(empty outline)'}],
      }
    } catch (error) {
      this.logError('Outline generation error:', error)
      return {
        content: [{type: 'text', text: `Error: ${error.message}`}],
        isError: true,
      }
    }
  }
}
