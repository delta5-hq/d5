import {convertToOpenAIFunction} from '@langchain/core/utils/function_calling'

const toAnthropicInputSchema = tool => {
  if (tool.inputSchema && typeof tool.inputSchema === 'object') return tool.inputSchema
  const {parameters} = convertToOpenAIFunction(tool)
  return parameters ?? {type: 'object', properties: {}}
}

export const formatToolsForAnthropic = tools =>
  tools.map(tool => ({
    name: tool.name,
    description: tool.description,
    input_schema: toAnthropicInputSchema(tool),
  }))

export const extractToolCallsFromContent = content =>
  content.filter(block => block.type === 'tool_use').map(block => ({id: block.id, name: block.name, args: block.input}))
