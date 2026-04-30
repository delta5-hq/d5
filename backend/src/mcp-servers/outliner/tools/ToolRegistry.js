import {OutlineTool} from './OutlineTool'

export class ToolRegistry {
  constructor(userContextProvider) {
    this.tools = [new OutlineTool(userContextProvider)]
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
