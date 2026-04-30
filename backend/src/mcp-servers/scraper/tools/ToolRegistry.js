import {ScrapeTool} from './ScrapeTool'

export class ToolRegistry {
  constructor() {
    this.tools = [new ScrapeTool()]
  }

  registerAll(mcpServer) {
    this.tools.forEach(tool => {
      const schema = tool.getSchema()
      mcpServer.registerTool(schema.name, schema, args => tool.execute(args))
    })
  }

  getAllTools() {
    return this.tools
  }
}
