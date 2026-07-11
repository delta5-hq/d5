import IntegrationSessionRepository from '../../../../repositories/IntegrationSessionRepository'

export class SessionHydrator {
  constructor(sessionRepository = IntegrationSessionRepository) {
    this.sessionRepository = sessionRepository
  }

  async hydrateRPCAliases(userId, rpcAliases) {
    if (!rpcAliases || rpcAliases.length === 0) {
      return rpcAliases
    }

    const hydrated = await Promise.all(
      rpcAliases.map(async alias => {
        const lastSessionId = await this.sessionRepository.getLastSessionId(userId, alias.alias, 'rpc')
        return {...alias, lastSessionId}
      }),
    )

    return hydrated
  }

  async hydrateMCPAliases(mcpAliases) {
    return mcpAliases
  }

  async hydrateAll(userId, {mcp, rpc}) {
    const [hydratedMcp, hydratedRpc] = await Promise.all([
      this.hydrateMCPAliases(mcp),
      this.hydrateRPCAliases(userId, rpc),
    ])

    return {
      mcp: hydratedMcp,
      rpc: hydratedRpc,
    }
  }
}

export default new SessionHydrator()
