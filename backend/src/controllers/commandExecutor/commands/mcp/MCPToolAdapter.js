import {DynamicStructuredTool} from '@langchain/core/tools'
import {formatToolResult} from './MCPClientManager'
import {MCP_DEFAULT_TIMEOUT_MS} from '../../constants/mcp'
import {jsonSchemaToZod} from './jsonSchemaToZod'

export class MCPToolAdapter extends DynamicStructuredTool {
  constructor({toolDescriptor, client, timeoutMs = MCP_DEFAULT_TIMEOUT_MS, signal, callName, onCall}) {
    const zodSchema = jsonSchemaToZod(toolDescriptor.inputSchema)
    const mcpToolName = callName ?? toolDescriptor.name

    super({
      name: toolDescriptor.name,
      description: toolDescriptor.description || toolDescriptor.name,
      schema: zodSchema,
      func: async input => {
        const options = {timeout: timeoutMs}
        if (signal) {
          options.signal = signal
        }

        try {
          const result = await client.callTool({name: mcpToolName, arguments: input}, undefined, options)
          onCall?.({status: result.isError ? 'error' : 'success', input, result})
          return formatToolResult(result).content
        } catch (error) {
          onCall?.({status: 'error', input, error})
          throw error
        }
      },
    })
    this.inputSchema = toolDescriptor.inputSchema
  }
}
