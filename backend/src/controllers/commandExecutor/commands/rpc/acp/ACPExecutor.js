import debug from 'debug'
import {ACPConnection} from './ACPConnection'
import {ACPPermissionPolicy} from './ACPPermissionPolicy'
import {ACPResponseAggregator} from './ACPResponseAggregator'

const log = debug('delta5:app:ACPExecutor')

export class ACPExecutor {
  async execute({
    command,
    args = [],
    env = {},
    timeoutMs = 300_000,
    cwd,
    permissionPolicy,
    prompt,
    onUpdate = null,
    lastSessionId = null,
  }) {
    if (!command) {
      throw new Error('ACP command is required')
    }

    const policy = permissionPolicy || new ACPPermissionPolicy({denyAll: true})
    const aggregator = new ACPResponseAggregator()
    const notifications = []

    const client = {
      async sessionUpdate(notification) {
        notifications.push(notification)
        aggregator.processUpdate(notification)
        onUpdate?.(notification)
      },

      async requestPermission(params) {
        log(`Permission request for ${params.toolCall.title}`)
        return policy.buildResponse(params.toolCall.name, params.options)
      },
    }

    const connection = new ACPConnection({
      command,
      args,
      env,
      timeoutMs,
      cwd: cwd || process.cwd(),
    })

    try {
      await connection.initialize(client)
      log('ACP connection initialized')

      const sessionId = await connection.createSession(lastSessionId)
      log(`Session ${lastSessionId ? 'resumed' : 'created'}: ${sessionId}`)

      const response = await connection.sendPrompt(prompt)
      log(`Prompt completed with stopReason: ${response.stopReason}`)

      aggregator.extractSessionId(notifications)

      return {
        output: aggregator.getFullResponse(),
        sessionId: aggregator.getSessionId() || sessionId,
        stopReason: response.stopReason,
        exitCode: response.stopReason === 'end_turn' ? 0 : 1,
      }
    } finally {
      await connection.close()
    }
  }
}
