import debug from 'debug'
import {ValidateCommand as ReliabilityValidateCommand} from '../reliability/core/ValidateCommand'
import {runWithErrorNode} from './shared/runWithErrorNode'
import {NodeTextExtractor} from './utils/NodeTextExtractor'
import {getNodeCommand} from './utils/isCommand'
import {isValidateCell} from '../reliability/core/validateParams'

const log = debug('delta5:app:Command:Validate')

const formatValidateResult = result => {
  const criterion = result?.criterion ? ` — ${result.criterion}` : ''
  if (result?.passed) return `Validation passed${criterion}`
  const reason = result?.reason ? `: ${result.reason}` : ''
  return `Validation failed${criterion}${reason}`
}

const skipNestedValidate = node => isValidateCell(getNodeCommand(node))

export class ValidateCommand {
  constructor(userId, workflowId, store) {
    this.userId = userId
    this.workflowId = workflowId
    this.store = store
    this.logError = log.extend(userId, '/').extend('ERROR*', '::')
  }

  async run(node, options = {}) {
    return runWithErrorNode(this.store, node, this.logError.bind(this), async () => {
      await this.ensureValidatableParentContent(node)
      const command = new ReliabilityValidateCommand(this.userId, this.workflowId, this.store)
      const result = await command.run(node, {signal: options.signal ?? null})
      this.store.importer.createNodes(formatValidateResult(result), node.id)
      return result
    })
  }

  async ensureValidatableParentContent(node) {
    const parentNode = this.store.getNode(node.parent)
    if (!parentNode) {
      throw new Error('/validate requires a parent node with content to validate')
    }

    const extractor = new NodeTextExtractor(Infinity, skipNestedValidate, this.store)
    const content = await extractor.extractFullContent(parentNode)
    if (!content.trim()) {
      throw new Error('/validate requires non-empty parent content to validate')
    }
  }
}
