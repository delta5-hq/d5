import debug from 'debug'
import {resolveRefineCell} from '../reliability/core/resolveRefineCell'
import {runWithErrorNode} from './shared/runWithErrorNode'

const log = debug('delta5:app:Command:Refine')

export class RefineCommand {
  constructor(userId, workflowId, store) {
    this.userId = userId
    this.workflowId = workflowId
    this.store = store
    this.logError = log.extend(userId, '/').extend('ERROR*', '::')
  }

  async run(node, options = {}) {
    return runWithErrorNode(this.store, node, this.logError.bind(this), async () => {
      await resolveRefineCell(node, this.store, options.memoMap ?? new Map(), options.signal ?? null)
    })
  }
}
