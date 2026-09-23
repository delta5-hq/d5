import {FORK_EVENT} from './ForkStreamEvent'

export class NullForkProgressEmitter {
  forksStarted() {}
  forkSettled() {}
  electComplete() {}
}

class SSEForkProgressEmitter {
  constructor(progress) {
    this._progress = progress
  }

  forksStarted(electNodeId, total) {
    for (let forkIndex = 0; forkIndex < total; forkIndex++) {
      this._progress.emitUpdate({
        type: FORK_EVENT.FORK_STARTED,
        electNodeId,
        forkIndex,
        total,
      })
    }
  }

  forkSettled(electNodeId, result) {
    const payload = {
      type: FORK_EVENT.FORK_SETTLED,
      electNodeId,
      forkIndex: result.forkIndex,
      status: result.status,
    }
    if (result.failedAt !== undefined) payload.failedAt = result.failedAt
    if (result.reason !== undefined) payload.reason = result.reason
    if (result.leafOutputs?.length) payload.leafOutputs = result.leafOutputs
    this._progress.emitUpdate(payload)
  }

  electComplete(electNodeId, winnerForkIndex, total, telemetry = {}) {
    const payload = {
      type: FORK_EVENT.ELECT_COMPLETE,
      electNodeId,
      winnerForkIndex,
      total,
    }
    if (telemetry.fallbackUsed) payload.fallbackUsed = true
    if (telemetry.generatorOnlyJudge) payload.generatorOnlyJudge = true
    if (telemetry.judgeReasoningRequested) payload.judgeReasoningRequested = true
    this._progress.emitUpdate(payload)
  }
}

export function createForkProgressEmitter(progress) {
  if (typeof progress?.emitUpdate === 'function') {
    return new SSEForkProgressEmitter(progress)
  }
  return new NullForkProgressEmitter()
}
