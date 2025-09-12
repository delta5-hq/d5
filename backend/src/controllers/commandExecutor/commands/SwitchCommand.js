import debug from 'debug'
import {clearCommandsWithParams} from '../constants'
import {HumanMessage, SystemMessage} from 'langchain/schema'
import {clearStepsPrefix} from '../constants/steps'
import {substituteReferencesAndHashrefsChildrenAndSelf} from './references/substitution'
import {runCommand} from './utils/runCommand'
import {referencePatterns} from './references/utils/referencePatterns'
import {clearReferences} from './references/utils/referenceUtils' // Direct import
import {REF_DEF_PREFIX, HASHREF_DEF_PREFIX} from './references/referenceConstants'
import {CASE_QUERY} from '../constants/switch'
import {getQueryType} from '../constants'
import {commandRegExp} from '../constants/commandRegExp'
import {determineLLMType, getIntegrationSettings, getLLM} from './utils/langchain/getLLM'
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
   * @param {string} mapId - The unique identifier for the map (optional)
   * @param {Store} store - The store object
   */
  constructor(userId, mapId, store, progress) {
    this.store = store
    this.userId = userId
    this.mapId = mapId
    this.progress = progress
    this.log = log.extend(userId, '/')
    if (this.mapId) {
      this.log = this.log.extend(mapId, '#')
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

  async executeSwitch(userPrompt, sysPrompt, llm) {
    try {
      const messages = [new SystemMessage(sysPrompt), new HumanMessage(userPrompt)]
      const result = await llm.call(messages)

      return result.content
    } catch (error) {
      this.logError(error)
      return ''
    }
  }

  async processPromptAndExecuteCase(node, prompt) {
    const options = this.getCaseOptions(node)
    const formattedOptions = Object.keys(options)
      .map(str => `'${str}'`)
      .join(', ')
    const sysPrompt = `Respond with one of these options: ${formattedOptions}`

    const settings = await getIntegrationSettings(this.userId)
    const llmType = determineLLMType(node.command, settings)

    const {llm} = getLLM({type: llmType, settings})

    const caseValue = await this.executeSwitch(prompt, sysPrompt, llm)
    if (!caseValue) {
      return []
    }
    const optionsKey = this.getOptionsKeyFromExecutionResult(caseValue)

    if (options[optionsKey]) {
      const caseNode = options[optionsKey]
      const {children = []} = caseNode
      const caseNodeChildren = children.map(id => this.store.getNode(id)).filter(Boolean)

      for (let i = 0; i < caseNodeChildren.length; i += 1) {
        const executeNode = caseNodeChildren[i]
        const command = executeNode.command || executeNode.title
        const queryType = getQueryType(command)

        if (command && commandRegExp.any.test(command)) {
          await runCommand(
            {
              queryType,
              cell: executeNode,
              store: this.store,
            },
            this.progress,
          )
        }
      }
    }
  }

  async run(node, originalPrompt) {
    let prompt = originalPrompt
    const title = node?.command || node?.title

    if (!prompt || referencePatterns.withAssignmentPrefix().test(title)) {
      prompt = substituteReferencesAndHashrefsChildrenAndSelf(this.store.getNode(node.id), this.store)
    } else {
      prompt = clearCommandsWithParams(
        clearReferences(clearReferences(clearStepsPrefix(prompt), REF_DEF_PREFIX), HASHREF_DEF_PREFIX),
      )
    }

    await this.processPromptAndExecuteCase(node, prompt)
  }

  getOptionsKeyFromExecutionResult(str) {
    return str.replace(/^['"`]|['"`]$/g, '').toLowerCase()
  }
}
