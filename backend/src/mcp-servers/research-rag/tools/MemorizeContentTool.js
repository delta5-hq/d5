import debug from 'debug'
import {MemorizeCommand} from '../../../controllers/commandExecutor/commands/MemorizeCommand'
import {CommandStringBuilder} from '../context/CommandStringBuilder'
import {DEFAULT_CONTEXT_NAME} from '../../../controllers/commandExecutor/constants/ext'

const log = debug('delta5:mcp:research-rag:memorize-content')

export class MemorizeContentTool {
  constructor(userContextProvider, commandContextAdapter) {
    this.userContextProvider = userContextProvider
    this.commandContextAdapter = commandContextAdapter
    this.commandStringBuilder = new CommandStringBuilder()
    this.logError = log.extend('ERROR*', '::')
  }

  getSchema() {
    return {
      name: 'memorize_content',
      description: 'Store text content in the user knowledge base for later retrieval',
      inputSchema: {
        type: 'object',
        properties: {
          text: {
            type: 'string',
            description: 'The text content to memorize',
          },
          context: {
            type: 'string',
            description: 'Knowledge base context name. Optional.',
          },
          keep: {
            type: 'boolean',
            description: 'Keep existing vectors in the context. Defaults to true.',
          },
          split: {
            type: 'string',
            description: 'Delimiter to split text into chunks. Optional.',
          },
        },
        required: ['text'],
      },
    }
  }

  async execute(args) {
    try {
      const params = this.commandContextAdapter.parseMemorizeParams(args)
      const userId = this.userContextProvider.getUserId()
      const commandString = this.commandStringBuilder.buildCommandString(params)

      const memorizeCommand = new MemorizeCommand(userId, null, null)
      const contextName = params.context || DEFAULT_CONTEXT_NAME
      const vectorStore = await memorizeCommand._getVectorStore(commandString, contextName)

      const chunks = memorizeCommand.createChunks(params.text, 'mcp-memorize', params.split || null)

      if (chunks.length === 0) {
        throw new Error('No content to memorize after processing')
      }

      await memorizeCommand.saveEmbeddings(vectorStore, chunks, params.keep)

      return {
        content: [
          {
            type: 'text',
            text: `Memorized ${chunks.length} chunk(s) in context "${contextName}"`,
          },
        ],
      }
    } catch (error) {
      this.logError('Memorize content error:', error)
      return {
        content: [{type: 'text', text: `Error: ${error.message}`}],
        isError: true,
      }
    }
  }
}
