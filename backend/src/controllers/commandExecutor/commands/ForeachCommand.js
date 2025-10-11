import debug from 'debug'
import {REF_PREFIX, clearCommandsWithParams, getQueryType} from '../constants'
import {commandRegExp} from '../constants/commandRegExp'
import {
  FOREACH_FILE_PARAM,
  FOREACH_PARAM_PARALLEL,
  FOREACH_PARENTS_REF,
  FOREACH_QUERY,
  readForeachFileParam,
  readParallelParam,
  readParentRef,
} from '../constants/foreach'
import {STEPS_QUERY} from '../constants/steps'
import {SUMMARIZE_QUERY} from '../constants/summarize'
import {CHAT_PARAM_PARENTS} from '../constants/chat'
import {runCommand} from './utils/runCommand'
import {StepsCommand} from './StepsCommand'
import {createDeepClone} from './utils/createDeepClone'
// eslint-disable-next-line no-unused-vars
import Store from './utils/Store'
// eslint-disable-next-line no-unused-vars
import ProgressReporter from '../ProgressReporter'

const log = debug('delta5:app:Command:Foreach')

const simpleRefRegexp = /(^|\s|\W)@@($|\s|\W)/g
const refWithParentsRegexp = /(^|\s|\W)@@@($|\s|\W)/g

/**
 * Class representing a Web Command.
 */
export class ForeachCommand {
  /**
   * Creates an instance of WebCommand
   * @param {string} userId - The unique identifier for the user
   * @param {string} workflowId - The unique identifier for the map (optional)
   * @param {Store} store - The store object
   * @param {ProgressReporter} progress
   * @param {object} params - Foreach params
   */
  constructor(userId, workflowId, store, progress, params) {
    this.userId = userId
    this.workflowId = workflowId
    this.store = store
    this.progress = progress
    this.params = {
      usePrompts: params?.usePrompts || false,
    }
    this.log = log.extend(userId, '/')
    if (this.workflowId) {
      this.log = this.log.extend(workflowId, '#')
    }
    this.logError = this.log.extend('ERROR*', '::')
  }

  getParams = title => {
    const parallel = readParallelParam(title)
    const useFile = readForeachFileParam(title)

    return {
      parallel,
      useFile,
    }
  }

  getParentsTitles = (node, parent = 3) => {
    let currentNode = this.store.getNode(node?.parent || '')
    const texts = []

    let loopIteration = 0

    while (currentNode && loopIteration < parent && currentNode.parent) {
      const newTitle = currentNode.title?.trim()
      currentNode = this.store.getNode(currentNode.parent)

      if (newTitle && !commandRegExp.any.test(newTitle)) {
        texts.unshift(newTitle)
      }

      loopIteration += 1
    }

    return texts.join(', ')
  }

  substituteParentsTitles = (title, node, parentDepth) => {
    let promptString = title

    const parentsTitles = []
    let depth = parentDepth
    let pNode = this.store.getNode(node?.parent || '')

    while (pNode && pNode.parent && depth) {
      if (pNode.title && !commandRegExp.any.test(pNode.title)) {
        parentsTitles.push(pNode.title)
      }
      pNode = this.store.getNode(pNode.parent || '')
      depth -= 1
    }

    promptString = promptString.replace(FOREACH_PARENTS_REF, parentsTitles.join(', '))

    return promptString
  }

  getPrompt = (node, command) => {
    let promptString = command

    if (promptString.match(refWithParentsRegexp)) {
      promptString = promptString.replace(refWithParentsRegexp, (match, p1, p2) => {
        const replacement = `${this.getParentsTitles(node)}, ${REF_PREFIX}`

        return `${p1}${replacement}${p2}`
      })
    }

    if (promptString.match(simpleRefRegexp)) {
      promptString = promptString.replace(simpleRefRegexp, (match, p1, p2) => {
        const replacement = node.title || ''

        return `${p1}${replacement}${p2}`
      })
    }

    const parentDepth = readParentRef(promptString)

    if (parentDepth) {
      promptString = this.substituteParentsTitles(promptString, node, parentDepth)
      promptString = `${promptString} ${CHAT_PARAM_PARENTS}=0`
    }

    return promptString
  }

  findLeafs = (node, command, useFile) => {
    const leafs = []

    const traverseNode = (currentNode, arr = []) => {
      if (
        !currentNode?.title ||
        currentNode?.title?.startsWith(FOREACH_QUERY) ||
        currentNode?.command?.startsWith(FOREACH_QUERY) ||
        currentNode?.command?.startsWith(SUMMARIZE_QUERY)
      ) {
        return
      }

      if (!currentNode?.children?.length && (!useFile || (useFile && currentNode.file))) {
        const promptString = this.getPrompt(currentNode, command)

        arr.push({node: currentNode, promptString})
      } else if (currentNode?.children?.length) {
        currentNode.children
          .map(id => this.store.getNode(id))
          .filter(Boolean)
          .forEach(n => traverseNode(n, arr))
      }
    }

    node.children
      .map(id => this.store.getNode(id))
      .filter(Boolean)
      .forEach(n => {
        if (!this.params.usePrompts || node.prompts?.includes(n.id)) {
          traverseNode(n, leafs)
        }
      })

    return leafs
  }

  async executePrompts(nodes, isParallel = true) {
    if (isParallel) {
      const parallelProgress = new ProgressReporter({title: 'parallel'}, this.progress)

      await Promise.allSettled(
        nodes.map(async ({node, promptString}) => {
          try {
            const parallelTracker = await parallelProgress.add('child')
            const queryType = getQueryType(promptString)

            if (queryType) {
              // update previous node in mapNodes
              this.store.editNode({...node, command: promptString})

              await runCommand(
                {
                  queryType,
                  cell: {...node, command: promptString},
                  store: this.store,
                },
                parallelProgress,
              )

              parallelProgress.remove(parallelTracker)
            }
          } catch (e) {
            this.logError(e)
            throw e
          }
        }),
      )

      parallelProgress.dispose()
    } else {
      const sequentialProgress = new ProgressReporter({title: 'sequential'}, this.progress)

      for (let i = 0; i < nodes.length; i += 1) {
        try {
          const sequentialTracker = await sequentialProgress.add('child')

          const {node, promptString} = nodes[i]

          const queryType = getQueryType(promptString)
          // update previous node in mapNodes
          this.store.editNode({...node, command: promptString})

          if (queryType) {
            await runCommand(
              {
                queryType,
                cell: this.store.getNode(node.id),
                workflowId: this.workflowId,
                userId: this.userId,
                store: this.store,
              },
              sequentialProgress,
            )
          }

          sequentialProgress.remove(sequentialTracker)
        } catch (e) {
          this.logError(e)
        }
      }

      sequentialProgress.dispose()
    }
  }

  runDefault = async (node, command, params) => {
    const leafs = []
    const mainCommand = command.replace(FOREACH_PARAM_PARALLEL, '').trim()

    const parentNode = this.store.getNode(node.parent)
    const isRoot = !parentNode?.parent

    try {
      if (parentNode && !isRoot) {
        leafs.push(...this.findLeafs(parentNode, mainCommand, params.useFile))

        await this.executePrompts(leafs, params.parallel)
      }
    } catch (e) {
      this.logError(e)
    }

    return {}
  }

  async _processLeaf(leaf, matchingNode) {
    const {node, promptString} = matchingNode
    const command = this.getPrompt(leaf, promptString)
    const title = node.title === node.command ? command : node.title

    if (!node.children?.length) {
      this.store.createNode({command, title, parent: leaf.id})
    } else {
      const newNodes = createDeepClone({...node, command, title}, leaf.id, this.store._nodes)
      newNodes.forEach(node => this.store.createNode(node))
    }

    this.store.orphanMatchingNodes(
      leaf,
      n => !!n.title && (commandRegExp.foreachWithOrder.test(n.title) || commandRegExp.foreach.test(n.title)),
    )
  }

  runSteps = async (node, params) => {
    const stepsCommand = new StepsCommand(this.userId, this.workflowId, this.store)
    const {nodesByOrder, nodesWithoutOrder} = stepsCommand.findMatchingNodes(node)

    const matchingNodes = [
      ...Object.entries(nodesByOrder)
        .map(([order, nodes]) => ({
          order: Number(order),
          nodes,
        }))
        .sort((a, b) => a.order - b.order)
        .flatMap(entry => entry.nodes),
      ...nodesWithoutOrder,
    ]

    let stepsTitle = `${STEPS_QUERY} @@`
    const rootStepsTitle = node.command ? clearCommandsWithParams(node.command) : ''
    console.log(rootStepsTitle)
    if (rootStepsTitle) stepsTitle += ` ${rootStepsTitle}`

    const leafs = this.findLeafs(this.store.getNode(node.parent), stepsTitle, params.useFile)
    const leafNodes = leafs.map(({node: leaf}) => leaf)

    for (let i = 0; i < leafNodes.length; i += 1) {
      const leaf = leafNodes[i]

      for (let j = 0; j < matchingNodes.length; j += 1) {
        await this._processLeaf(leaf, matchingNodes[j])
      }
    }

    await this.executePrompts(leafs, params.parallel)
  }

  stripCommand(str) {
    return str.replace(FOREACH_QUERY, '').replace(FOREACH_FILE_PARAM, '').trim()
  }

  async run(node) {
    const command = node?.command || node?.title || ''
    const prompt = this.stripCommand(command)

    const promptParams = this.getParams(command)

    if (prompt?.startsWith(STEPS_QUERY)) {
      await this.runSteps(node, promptParams)
    } else if (prompt?.match(simpleRefRegexp) || prompt?.match(refWithParentsRegexp)) {
      await this.runDefault(node, prompt, promptParams)
    } else if (prompt) {
      await this.runDefault(node, prompt, promptParams)
    }
  }
}
