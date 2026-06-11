import {FORK_EVENT} from './ForkStreamEvent'

export class NullForkProgressEmitter {
  forksStarted() {}
  forkSettled() {}
  refineComplete() {}
}

class SSEForkProgressEmitter {
  constructor(progress) {
    this._progress = progress
  }

  forksStarted(refineNodeId, total) {
    for (let forkIndex = 0; forkIndex < total; forkIndex++) {
      this._progress.emitUpdate({type: FORK_EVENT.FORK_STARTED, refineNodeId, forkIndex, total})
    }
  }

  forkSettled(refineNodeId, result) {
    const payload = {
      type: FORK_EVENT.FORK_SETTLED,
      refineNodeId,
      forkIndex: result.forkIndex,
      status: result.status,
    }
    if (result.failedAt !== undefined) payload.failedAt = result.failedAt
    if (result.reason !== undefined) payload.reason = result.reason
    if (result.leafOutputs?.length) payload.leafOutputs = result.leafOutputs
    this._progress.emitUpdate(payload)
  }

  refineComplete(refineNodeId, winnerForkIndex, total) {
    this._progress.emitUpdate({type: FORK_EVENT.REFINE_COMPLETE, refineNodeId, winnerForkIndex, total})
  }
}

export function createForkProgressEmitter(progress) {
  if (typeof progress?.emitUpdate === 'function') {
    return new SSEForkProgressEmitter(progress)
  }
  return new NullForkProgressEmitter()
}
