import debug from 'debug'
import {clearCommandsWithParams} from '../constants'
import {HumanMessage, SystemMessage} from '@langchain/core/messages'
import {clearStepsPrefix} from '../constants/steps'
import {substituteReferencesAndHashrefsChildrenAndSelf} from './references/substitution'
import {runCommand} from './utils/runCommand'
import {runWithErrorNode} from './shared/runWithErrorNode'
import {referencePatterns} from './references/utils/referencePatterns'
import {clearReferences} from './references/utils/referenceUtils' // Direct import
import {REF_DEF_PREFIX, HASHREF_DEF_PREFIX} from './references/referenceConstants'
import {CASE_QUERY} from '../constants/switch'
import {isAnyCommand} from './utils/commandRecognition'
import {composeAllDynamicAliases} from './utils/aliasComposition'
import {resolveCommand} from './utils/queryTypeResolver'
import {determineLLMType, getIntegrationSettings, getLLM} from './utils/langchain/getLLM'
import {throwIfAborted, signalOptions} from './utils/executionSignal'
// eslint-disable-next-line no-unused-vars
import Store from './utils/Store'
const log = debug('delta5:app:Command:Switch')

/**
 * Class representing a Switch Command.
 */
export class SwitchCommand {
  /**
   * Creates an instance of SwitchCommand
   * @param {string} userId - The unique identifier for the user
   * @param {string} workflowId - The unique identifier for the workflow (optional)
   * @param {Store} store - The store object
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

  getCaseOptions(node) {
    const options = {}

    node.children
      .map(id => this.store.getNode(id))
      .filter(Boolean)
      .forEach(child => {
        const title = child.command || child.title
        if (title && title.trim().startsWith(CASE_QUERY)) {
          options[
            clearCommandsWithParams(
              clearReferences(clearReferences(clearStepsPrefix(title), REF_DEF_PREFIX), HASHREF_DEF_PREFIX),
            ).toLowerCase()
          ] = child
        }
      })

    return options
  }

  async executeSwitch(userPrompt, sysPrompt, llm, signal) {
    try {
      const messages = [new SystemMessage(sysPrompt), new HumanMessage(userPrompt)]
      const result = await llm.invoke(messages, signalOptions(signal))

      return result.content
    } catch (error) {
      this.logError(error)
      return ''
    }
  }

  async processPromptAndExecuteCase(node, prompt, signal) {
    throwIfAborted(signal)
    const options = this.getCaseOptions(node)

    if (Object.keys(options).length === 0) {
      throw new Error('/switch requires child nodes prefixed with /case to define branches')
    }

    const formattedOptions = Object.keys(options)
      .map(str => `'${str}'`)
      .join(', ')
    const sysPrompt = `Respond with one of these options: ${formattedOptions}`

    const settings = await getIntegrationSettings(this.userId, this.workflowId, this.store)
    const llmType = determineLLMType(settings)

    const {llm} = getLLM({type: llmType, settings})

    const caseValue = await this.executeSwitch(prompt, sysPrompt, llm, signal)
    if (!caseValue) {
      return []
    }
    const optionsKey = this.getOptionsKeyFromExecutionResult(caseValue)

    if (options[optionsKey]) {
      const caseNode = options[optionsKey]
      const {children = []} = caseNode
      const caseNodeChildren = children.map(id => this.store.getNode(id)).filter(Boolean)

      const allDynamicAliases = composeAllDynamicAliases(this.store._aliases)

      for (let i = 0; i < caseNodeChildren.length; i += 1) {
        throwIfAborted(signal)
        const executeNode = caseNodeChildren[i]
        const command = executeNode.command || executeNode.title

        if (command && isAnyCommand(command, allDynamicAliases)) {
          const {queryType, mcpAlias, rpcAlias} = resolveCommand(command, this.store._aliases)

          await runWithErrorNode(this.store, executeNode, this.logError.bind(this), () =>
            runCommand(
              {
                queryType,
                cell: executeNode,
                store: this.store,
                mcpAlias,
                rpcAlias,
                signal,
              },
              this.progress,
            ),
          )
        }
      }
    }
  }

  async run(node, originalPrompt, options = {}) {
    await runWithErrorNode(this.store, node, this.logError.bind(this), async () => {
      let prompt = originalPrompt
      const title = node?.command || node?.title

      if (!prompt || referencePatterns.withAssignmentPrefix().test(title)) {
        prompt = substituteReferencesAndHashrefsChildrenAndSelf(this.store.getNode(node.id), this.store)
      } else {
        prompt = clearCommandsWithParams(
          clearReferences(clearReferences(clearStepsPrefix(prompt), REF_DEF_PREFIX), HASHREF_DEF_PREFIX),
        )
      }

      await this.processPromptAndExecuteCase(node, prompt, options.signal)
    })
  }

  getOptionsKeyFromExecutionResult(str) {
    return str.replace(/^['"`]|['"`]$/g, '').toLowerCase()
  }
}
