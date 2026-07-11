import {OutlineTool} from './OutlineTool'

export class ToolRegistry {
  constructor(userContextProvider) {
    this.tools = [new OutlineTool(userContextProvider)]
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
