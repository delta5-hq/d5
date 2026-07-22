import {WebSearchQATool} from './WebSearchQATool'
import {ScholarSearchQATool} from './ScholarSearchQATool'
import {KnowledgeBaseQueryTool} from './KnowledgeBaseQueryTool'
import {MemorizeContentTool} from './MemorizeContentTool'

export class ToolRegistry {
  constructor(userContextProvider, commandContextAdapter) {
    this.tools = [
      new WebSearchQATool(userContextProvider, commandContextAdapter),
      new ScholarSearchQATool(userContextProvider, commandContextAdapter),
      new KnowledgeBaseQueryTool(userContextProvider, commandContextAdapter),
      new MemorizeContentTool(userContextProvider, commandContextAdapter),
    ]
  }

  registerAll(mcpServer) {
    this.tools.forEach(tool => {
      mcpServer.tool(tool.getName(), tool.getDescription(), tool.getZodShape(), args => tool.execute(args))
    })
  }

  getAllTools() {
    return this.tools
  }
}
