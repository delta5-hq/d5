import {callTool} from '../../controllers/commandExecutor/commands/mcp/MCPClientManager'
import {MCP_TRANSPORT} from '../../controllers/commandExecutor/constants/mcp'
import {MCP_DEFAULT_TIMEOUT_MS} from '../../controllers/commandExecutor/constants/mcp'

export class ToolInvoker {
  constructor(timeoutMs = MCP_DEFAULT_TIMEOUT_MS) {
    this.timeoutMs = timeoutMs
  }

  async invoke({serverPath, toolName, toolArguments, env}) {
    const result = await callTool({
      transport: MCP_TRANSPORT.STDIO,
      command: 'npx',
      args: ['babel-node', serverPath],
      env,
      toolName,
      toolArguments,
      timeoutMs: this.timeoutMs,
    })

    return result
  }
}
