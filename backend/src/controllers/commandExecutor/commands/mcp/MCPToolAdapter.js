import {DynamicTool} from 'langchain/tools'
import {formatToolResult} from './MCPClientManager'
import {MCP_DEFAULT_TIMEOUT_MS} from '../../constants/mcp'

const singlePropertyName = inputSchema => {
  const props = inputSchema?.properties
  if (!props) return null
  const keys = Object.keys(props)
  return keys.length === 1 ? keys[0] : null
}

const toolArgumentsFromString = (input, inputSchema) => {
  const onlyProp = singlePropertyName(inputSchema)
  if (onlyProp) return {[onlyProp]: input}

  const hasMultipleProps = inputSchema?.properties && Object.keys(inputSchema.properties).length > 1
  if (hasMultipleProps) {
    try {
      const parsed = JSON.parse(input)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed
    } catch {
      /* empty */
    }
  }

  return {}
}

export class MCPToolAdapter extends DynamicTool {
  constructor({toolDescriptor, client, timeoutMs = MCP_DEFAULT_TIMEOUT_MS}) {
    super({
      name: toolDescriptor.name,
      description: toolDescriptor.description || toolDescriptor.name,
      func: async input => {
        const toolArguments = toolArgumentsFromString(input, toolDescriptor.inputSchema)
        const result = await client.callTool({name: toolDescriptor.name, arguments: toolArguments}, undefined, {
          timeout: timeoutMs,
        })
        return formatToolResult(result).content
      },
    })
    this.inputSchema = toolDescriptor.inputSchema
  }
}
