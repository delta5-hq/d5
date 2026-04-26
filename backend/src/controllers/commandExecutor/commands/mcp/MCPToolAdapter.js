import {DynamicStructuredTool} from '@langchain/core/tools'
import {formatToolResult} from './MCPClientManager'
import {MCP_DEFAULT_TIMEOUT_MS} from '../../constants/mcp'
import {jsonSchemaToZod} from './jsonSchemaToZod'

export class MCPToolAdapter extends DynamicStructuredTool {
  constructor({toolDescriptor, client, timeoutMs = MCP_DEFAULT_TIMEOUT_MS, signal}) {
    const zodSchema = jsonSchemaToZod(toolDescriptor.inputSchema)

    super({
      name: toolDescriptor.name,
      description: toolDescriptor.description || toolDescriptor.name,
      schema: zodSchema,
      func: async input => {
        const options = {timeout: timeoutMs}
        if (signal) {
          options.signal = signal
        }

        const result = await client.callTool({name: toolDescriptor.name, arguments: input}, undefined, options)
        return formatToolResult(result).content
      },
    })
    this.inputSchema = toolDescriptor.inputSchema
  }
}
