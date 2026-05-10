import debug from 'debug'
import {z} from 'zod'
import {OutlineCommand} from '../../../controllers/commandExecutor/commands/OutlineCommand'
import {OutlineParamsAdapter} from '../context/OutlineParamsAdapter'
import {OutlineCommandStringBuilder} from '../context/OutlineCommandStringBuilder'

const log = debug('delta5:mcp:outliner:outline-tool')

const CHUNK_SIZES = ['xxs', 'xs', 's', 'm', 'l', 'xl', 'xxl']

export class OutlineTool {
  constructor(userContextProvider) {
    this.userContextProvider = userContextProvider
    this.paramsAdapter = new OutlineParamsAdapter()
    this.commandStringBuilder = new OutlineCommandStringBuilder()
    this.logError = log.extend('ERROR*', '::')
  }

  getName() {
    return 'generate_outline'
  }

  getDescription() {
    return 'Generate a structured hierarchical outline from web search, academic search, or knowledge base. Returns a text tree.'
  }

  getZodShape() {
    return {
      query: z.string().describe('The topic or question to outline.'),
      web: z
        .enum(CHUNK_SIZES)
        .optional()
        .describe('Web search mode with chunk size. Mutually exclusive with scholar/ext.'),
      scholar: z
        .enum(CHUNK_SIZES)
        .optional()
        .describe('Academic search mode with chunk size. Mutually exclusive with web/ext.'),
      ext: z.boolean().optional().describe('Use knowledge base instead of web/scholar.'),
      context: z.string().optional().describe('Knowledge base context name (when ext=true).'),
      href: z.string().optional().describe('Specific URL to outline from.'),
      minYear: z.number().optional().describe('Minimum publication year for scholar search.'),
      lang: z.string().optional().describe('Output language code (e.g., "ru", "en").'),
      citations: z.boolean().optional().describe('Include source citations in the response.'),
      maxChunks: z.enum(CHUNK_SIZES).optional().describe('Direct chunk size override.'),
    }
  }

  getSchema() {
    return {
      name: this.getName(),
      description: this.getDescription(),
      inputSchema: {
        type: 'object',
        properties: {
          query: {type: 'string', description: 'The topic or question to outline.'},
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
          context: {type: 'string', description: 'Knowledge base context name (when ext=true).'},
          href: {type: 'string', description: 'Specific URL to outline from.'},
          minYear: {type: 'number', description: 'Minimum publication year for scholar search.'},
          lang: {type: 'string', description: 'Output language code (e.g., "ru", "en").'},
          citations: {type: 'boolean', description: 'Include source citations in the response.'},
          maxChunks: {type: 'string', description: 'Direct chunk size override (xxs, xs, s, m, l, xl, xxl).'},
        },
        required: ['query'],
      },
    }
  }

  async execute(args) {
    try {
      const params = this.paramsAdapter.adaptParams(args)
      const userId = this.userContextProvider.getUserId()
      const workflowId = this.userContextProvider.getWorkflowId()
      const syntheticNode = this.commandStringBuilder.buildSyntheticNode(params)

      const command = new OutlineCommand(userId, workflowId, null)
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
