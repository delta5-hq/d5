import {ScrapeTool} from './ScrapeTool'

export class ToolRegistry {
  constructor() {
    this.tools = [new ScrapeTool()]
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
