# SessionResumeStrategy

## Purpose

Encapsulates ACP session acquisition logic with capability-aware resume support. Enables multi-turn conversations with ACP agents (Cline, Gemini CLI) by resuming existing sessions when supported by the agent.

## Architecture

```
SessionResumeStrategy
  ├─ canResumeSession()
  │    └─ Check if agent advertises session.resume capability
  ├─ resumeSession(sessionId, cwd)
  │    └─ Call unstable_resumeSession() on ACP connection
  ├─ createNewSession(cwd, mcpServers)
  │    └─ Call newSession() on ACP connection
  └─ acquireSession(lastSessionId, cwd, mcpServers)
       ├─ If lastSessionId exists AND agent supports resume:
       │    ├─ Try resumeSession()
       │    └─ Fallback to createNewSession() if resume fails
       └─ Else: createNewSession()
```

## Safety

- **Capability Detection**: Only calls `unstable_resumeSession()` if agent advertises `session.resume` capability
- **Graceful Fallback**: If resume fails (session not found, expired, etc.), automatically creates new session
- **Protocol Stability**: Works with current ACP SDK v0.14.x. When SDK changes, capability detection prevents breakage

## Integration Points

### ACPConnection
```javascript
async createSession(lastSessionId = null) {
  const strategy = new SessionResumeStrategy(this.connection, this.agentCapabilities)
  this.sessionId = await strategy.acquireSession(lastSessionId, this.cwd, [])
  return this.sessionId
}
```

### ACPExecutor
```javascript
async execute({..., lastSessionId = null}) {
  const connection = new ACPConnection({...})
  await connection.initialize(client)
  const sessionId = await connection.createSession(lastSessionId)
  // ...
}
```

### RPCCommand
```javascript
async executeACP(prompt) {
  const {lastSessionId} = this.aliasConfig  // Hydrated by SessionHydrator
  const result = await executor.execute({..., lastSessionId})
  // ...
}
```

### SessionHydrator
```javascript
async hydrateRPCAliases(userId, rpcAliases) {
  // Fetches lastSessionId from IntegrationSessionRepository
  // Works for ALL RPC protocols: SSH, HTTP, ACP
  const lastSessionId = await this.sessionRepository.getLastSessionId(userId, alias.alias, 'rpc')
  return {...alias, lastSessionId}
}
```

## Agent Support

| Agent | Protocol | Resume Support | Status |
|-------|----------|----------------|--------|
| Cline | ACP (stdio) | `session.resume` capability | Unknown (check at runtime) |
| Gemini CLI | ACP (stdio) | `session.resume` capability | Unknown (check at runtime) |
| Claude CLI | SSH (JSON over stdout) | `--resume <sessionId>` flag | ✅ Implemented via SessionIdInjector |

## Testing

See `SessionResumeStrategy.test.js` for comprehensive unit tests covering:
- Capability detection
- Resume success path
- Resume fallback to new session
- New session creation
- Error handling
