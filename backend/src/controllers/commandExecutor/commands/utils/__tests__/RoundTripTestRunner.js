import {loadUserAliases} from '../../aliases/loadUserAliases'
import {resolveCommand} from '../queryTypeResolver'
import {runCommand} from '../runCommand'
import Store from '../Store'
import ProgressReporter from '../../../ProgressReporter'

export class RoundTripTestRunner {
  constructor(userId, workflowId = null) {
    this.userId = userId
    this.workflowId = workflowId
  }

  async loadAliases() {
    return loadUserAliases(this.userId, this.workflowId)
  }

  createCell({id, command}) {
    return {
      id,
      title: command,
      command,
    }
  }

  createRootNode({id, childIds}) {
    return {
      id,
      title: 'Workflow',
      children: childIds,
    }
  }

  createNodeTree(cells) {
    const rootNode = this.createRootNode({
      id: 'rootNode',
      childIds: cells.map(c => c.id),
    })

    const nodes = {rootNode}
    cells.forEach(cell => {
      cell.parent = rootNode.id
      nodes[cell.id] = cell
    })

    return nodes
  }

  async executeCell({cell, aliases, prompt = null}) {
    const {queryType, mcpAlias, rpcAlias} = resolveCommand(cell.command, aliases)

    const nodes = this.createNodeTree([cell])
    const store = new Store({
      userId: this.userId,
      workflowId: this.workflowId,
      nodes,
      aliases,
    })

    const progress = new ProgressReporter({title: 'roundtrip-test', outputInterval: 600000})

    try {
      await runCommand(
        {
          queryType,
          cell,
          store,
          mcpAlias,
          rpcAlias,
          prompt: prompt || cell.command,
        },
        progress,
      )
    } finally {
      progress.dispose()
    }

    return {
      queryType,
      mcpAlias,
      rpcAlias,
      output: store.getOutput(),
    }
  }

  async executeMultipleCells({cells, aliases}) {
    const nodes = this.createNodeTree(cells)
    const store = new Store({
      userId: this.userId,
      workflowId: this.workflowId,
      nodes,
      aliases,
    })

    const progress = new ProgressReporter({title: 'roundtrip-test', outputInterval: 600000})
    const results = []

    try {
      for (const cell of cells) {
        const {queryType, mcpAlias, rpcAlias} = resolveCommand(cell.command, aliases)
        await runCommand({queryType, cell, store, mcpAlias, rpcAlias}, progress)
        results.push({cellId: cell.id, queryType})
      }
    } finally {
      progress.dispose()
    }

    return {
      results,
      output: store.getOutput(),
    }
  }
}
