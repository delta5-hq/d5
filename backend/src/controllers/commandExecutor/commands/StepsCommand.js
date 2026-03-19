import debug from 'debug'
import {runCommand} from './utils/runCommand'
import {StepsNodeTraverser} from './utils/StepsNodeTraverser'
import {resolveCommand} from './utils/queryTypeResolver'
import {SSHClientPool} from './rpc/SSHClientPool'
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
    const allDynamicAliases = [...this.store._aliases.mcp, ...this.store._aliases.rpc]
    const traverser = new StepsNodeTraverser(this.store._nodes, allDynamicAliases)
    traverser.traverse(node)
    return {
      nodesByOrder: traverser.nodesByOrder,
      nodesWithoutOrder: traverser.nodesWithoutOrder,
    }
  }

  executePrompts = async (nodes, sshClientPool) => {
    const parallelProgress = new ProgressReporter({title: 'parallel'}, this.progress)

    await Promise.all(
      nodes.map(async ({node, promptString}) => {
        try {
          const parallelTracker = await parallelProgress.add('child')

          this.store.editNode({...node, command: promptString})

          const {queryType, mcpAlias, rpcAlias} = resolveCommand(promptString, this.store._aliases)

          const result = await runCommand(
            {
              queryType,
              cell: {...node, command: promptString},
              store: this.store,
              mcpAlias,
              rpcAlias,
              sshClientPool,
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

  async executePromptsByOrder(nodes, sshClientPool) {
    const orderNumbers = Object.keys(nodes)
      .map(Number)
      .sort((a, b) => a - b)

    const orderedProgress = new ProgressReporter({title: 'ordered'}, this.progress)

    for (let i = 0; i < orderNumbers.length; i += 1) {
      const orderedTracker = await orderedProgress.add('group')

      const currentOrder = nodes[orderNumbers[i]]
      await this.executePrompts(currentOrder, sshClientPool)

      orderedProgress.remove(orderedTracker)
    }

    orderedProgress.dispose()
  }

  async run(node) {
    const sshClientPool = new SSHClientPool()

    try {
      const {nodesByOrder, nodesWithoutOrder} = await this.findMatchingNodes(node)

      await this.executePromptsByOrder(nodesByOrder, sshClientPool)

      await this.executePrompts(nodesWithoutOrder, sshClientPool)
    } catch (e) {
      this.logError(e)
    } finally {
      sshClientPool.disposeAll()
    }
  }
}
