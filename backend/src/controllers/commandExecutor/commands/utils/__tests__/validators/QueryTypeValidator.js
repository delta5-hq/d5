export class QueryTypeValidator {
  static expectMcpQueryType(result, {aliasName, shouldHaveAlias = true}) {
    const expectedQueryType = `mcp:${aliasName.replace(/^\//, '')}`
    expect(result.queryType).toBe(expectedQueryType)

    if (shouldHaveAlias) {
      expect(result.mcpAlias).toBeDefined()
      expect(result.mcpAlias.alias).toBe(aliasName)
      expect(result.rpcAlias).toBeUndefined()
    }
  }

  static expectRpcQueryType(result, {aliasName, shouldHaveAlias = true}) {
    const expectedQueryType = `rpc:${aliasName.replace(/^\//, '')}`
    expect(result.queryType).toBe(expectedQueryType)

    if (shouldHaveAlias) {
      expect(result.rpcAlias).toBeDefined()
      expect(result.rpcAlias.alias).toBe(aliasName)
      expect(result.mcpAlias).toBeUndefined()
    }
  }

  static expectNoMatch(result) {
    expect(result.queryType).toBeUndefined()
    expect(result.mcpAlias).toBeUndefined()
    expect(result.rpcAlias).toBeUndefined()
  }
}
