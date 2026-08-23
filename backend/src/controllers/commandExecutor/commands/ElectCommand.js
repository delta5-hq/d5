import debug from 'debug'
import {resolveElectCell} from '../reliability/core/resolveElectCell'
import {runWithErrorNode} from './shared/runWithErrorNode'

const log = debug('delta5:app:Command:Elect')

export class ElectCommand {
  constructor(userId, workflowId, store) {
    this.userId = userId
    this.workflowId = workflowId
    this.store = store
    this.logError = log.extend(userId, '/').extend('ERROR*', '::')
  }

  async run(node, options = {}) {
    return runWithErrorNode(this.store, node, this.logError.bind(this), async () => {
      await resolveElectCell(node, this.store, options.memoMap ?? new Map(), options.signal ?? null)
    })
  }
}
