import debug from 'debug'
import {runCommand} from './utils/runCommand'
import {StepsNodeTraverser} from './utils/StepsNodeTraverser'
import {resolveQueryType, findMCPAliasByQueryType} from './utils/queryTypeResolver'
import {loadMCPAliases} from './mcp/aliasResolver'
// eslint-disable-next-line no-unused-vars
import Store from './utils/Store'
// eslint-disable-next-line no-unused-vars
import ProgressReporter from '../ProgressReporter'

const log = debug('app:Command:Steps')

/**
 * Class representing a Steps Command.
 */
export class StepsCommand {
  /**
   * Creates an instance of StepsCommand
   * @param {string} userId - The unique identifier for the user
   * @param {string} workflowId - The unique identifier for the workflow (optional)
   * @param {Store} store - The store object
   * @param {ProgressReporter}
   */
  constructor(userId, workflowId, store, progress) {
    this.store = store
    this.userId = userId
    this.workflowId = workflowId
    this.progress = progress
    this.log = log.extend(userId, '/')
    if (this.workflowId) {
      this.log = this.log.extend(workflowId, '#')
    }
    this.logError = this.log.extend('ERROR*', '::')
  }

  findMatchingNodes = async node => {
    let mcpAliases = []
    try {
      mcpAliases = await loadMCPAliases(this.userId)
    } catch (e) {
      this.log('loadMCPAliases failed, continuing without dynamic aliases:', e.message)
    }
    const allDynamicAliases = [...mcpAliases]
    const traverser = new StepsNodeTraverser(this.store._nodes, allDynamicAliases)
    traverser.traverse(node)
    return {
      nodesByOrder: traverser.nodesByOrder,
      nodesWithoutOrder: traverser.nodesWithoutOrder,
      dynamicAliases: allDynamicAliases,
    }
  }

  executePrompts = async (nodes, dynamicAliases = []) => {
    const parallelProgress = new ProgressReporter({title: 'parallel'}, this.progress)

    await Promise.all(
      nodes.map(async ({node, promptString}) => {
        try {
          const parallelTracker = await parallelProgress.add('child')

          this.store.editNode({...node, command: promptString})

          const queryType = resolveQueryType(promptString, {mcpAliases: dynamicAliases})
          const mcpAlias = findMCPAliasByQueryType(dynamicAliases, queryType)

          const result = await runCommand(
            {
              queryType,
              cell: {...node, command: promptString},
              store: this.store,
              mcpAlias,
            },
            parallelProgress,
          )

          parallelProgress.remove(parallelTracker)

          return result
        } catch (e) {
          this.logError(e)
          throw e
        }
      }),
    )
  }

  async executePromptsByOrder(nodes, dynamicAliases = []) {
    const orderNumbers = Object.keys(nodes)
      .map(Number)
      .sort((a, b) => a - b)

    const orderedProgress = new ProgressReporter({title: 'ordered'}, this.progress)

    // Execute command by order
    for (let i = 0; i < orderNumbers.length; i += 1) {
      const orderedTracker = await orderedProgress.add('group')

      const currentOrder = nodes[orderNumbers[i]]
      await this.executePrompts(currentOrder, dynamicAliases)

      orderedProgress.remove(orderedTracker)
    }

    orderedProgress.dispose()
  }

  async run(node) {
    try {
      const {nodesByOrder, nodesWithoutOrder, dynamicAliases} = await this.findMatchingNodes(node)

      // Execute command by order
      await this.executePromptsByOrder(nodesByOrder, dynamicAliases)

      // Execute command without order
      await this.executePrompts(nodesWithoutOrder, dynamicAliases)
    } catch (e) {
      this.logError(e)
    }
  }
}
