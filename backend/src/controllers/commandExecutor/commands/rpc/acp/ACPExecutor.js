import debug from 'debug'
import {ACPConnection} from './ACPConnection'
import {ACPPermissionPolicy} from './ACPPermissionPolicy'
import {ACPResponseAggregator} from './ACPResponseAggregator'
import {AbortSignalHandler} from './AbortSignalHandler'

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
    signal = null,
  }) {
    if (!command) {
      throw new Error('ACP command is required')
    }

    if (signal?.aborted) {
      throw new Error('Operation aborted')
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

    const abortHandler = new AbortSignalHandler(signal, connection)

    try {
      abortHandler.register()

      await connection.initialize(client)
      log('ACP connection initialized')

      const sessionId = await connection.createSession(lastSessionId)
      log(`Session ${lastSessionId ? 'resumed' : 'created'}: ${sessionId}`)

      const promptPromise = connection.sendPrompt(prompt)
      const response = await abortHandler.createAbortRace(promptPromise)
      log(`Prompt completed with stopReason: ${response.stopReason}`)

      aggregator.extractSessionId(notifications)

      return {
        output: aggregator.getFullResponse(),
        sessionId: aggregator.getSessionId() || sessionId,
        stopReason: response.stopReason,
        exitCode: response.stopReason === 'end_turn' ? 0 : 1,
      }
    } finally {
      abortHandler.unregister()
      await connection.close()
    }
  }
}
