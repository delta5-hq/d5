import debug from 'debug'
import {z} from 'zod'
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

  getName() {
    return 'scholar_search_qa'
  }

  getDescription() {
    return 'Search academic papers and answer questions based on scholarly sources'
  }

  getZodShape() {
    return {
      query: z.string().describe('The academic search query or question'),
      lang: z.string().optional().describe('Output language code (e.g., "ru", "en").'),
      citations: z.boolean().optional().describe('Include source citations in the response.'),
      maxChunks: z.string().optional().describe('Maximum chunks size: xxs, xs, s, m, l, xl, xxl.'),
      minYear: z.number().optional().describe('Minimum publication year for search results.'),
    }
  }

  getSchema() {
    return {
      name: this.getName(),
      description: this.getDescription(),
      inputSchema: {
        type: 'object',
        properties: {
          query: {type: 'string', description: 'The academic search query or question'},
          lang: {type: 'string', description: 'Output language code (e.g., "ru", "en"). Optional.'},
          citations: {type: 'boolean', description: 'Include source citations in the response. Optional.'},
          maxChunks: {type: 'string', description: 'Maximum chunks size: xxs, xs, s, m, l, xl, xxl. Optional.'},
          minYear: {type: 'number', description: 'Minimum publication year for search results. Optional.'},
        },
        required: ['query'],
      },
    }
  }

  async execute(args) {
    try {
      const params = this.commandContextAdapter.parseScholarSearchParams(args)
      const userId = this.userContextProvider.getUserId()
      const workflowId = this.userContextProvider.getWorkflowId()
      const syntheticNode = this.commandStringBuilder.buildSyntheticNode(params)

      const command = new ScholarCommand(userId, workflowId, null)
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
