export class IntegrationDocBuilder {
  constructor(userId, workflowId = null) {
    this.doc = {
      userId,
      workflowId,
      mcp: [],
      rpc: [],
    }
  }

  addMcpStdio({alias, command, args, toolName, toolInputField = 'prompt', env = null}) {
    this.doc.mcp.push({
      alias,
      transport: 'stdio',
      command,
      args,
      toolName,
      toolInputField,
      ...(env && {env}),
    })
    return this
  }

  addRpcHttp({alias, url, method = 'POST', bodyTemplate, outputFormat = 'json', outputField = null}) {
    this.doc.rpc.push({
      alias,
      protocol: 'http',
      url,
      method,
      bodyTemplate,
      outputFormat,
      ...(outputField && {outputField}),
    })
    return this
  }

  addRpcAcp({alias, command, args, workingDir = '/tmp', autoApprove = 'all', outputFormat = 'text'}) {
    this.doc.rpc.push({
      alias,
      protocol: 'acp-local',
      command,
      args,
      workingDir,
      autoApprove,
      outputFormat,
    })
    return this
  }

  build() {
    return this.doc
  }
}
