import debug from 'debug'
import {clearCommandsWithParams} from '../constants'
import {clearStepsPrefix} from '../constants/steps'
import {substituteReferencesAndHashrefsChildrenAndSelf} from './references/substitution'
import {ClaudeService} from './../../integrations/claude/ClaudeService'
import {getIntegrationSettings} from './utils/langchain/getLLM'
import {getClaudeMaxOutput} from './utils/langchain/getModelSettings'
import {referencePatterns} from './references/utils/referencePatterns'
import {clearReferences} from './references/utils/referenceUtils' // Direct import
import {REF_DEF_PREFIX, HASHREF_DEF_PREFIX} from './references/referenceConstants'
// eslint-disable-next-line no-unused-vars
import Store from './utils/Store'
import {createContextForChat} from './utils/createContextForChat'

const log = debug('delta5:app:Command:Claude')

/**
 * Class representing a Claude Command.
 */
export class ClaudeCommand {
  /**
   * Creates an instance of ClaudeCommand
   * @param {string} userId - The unique identifier for the user
   * @param {string} mapId - The unique identifier for the map (optional)
   * @param {Store} store - The store object
   */
  constructor(userId, mapId, store) {
    this.store = store
    this.userId = userId
    this.mapId = mapId
    this.log = log.extend(userId, '/')
    if (this.mapId) {
      this.log = this.log.extend(mapId, '#')
    }
    this.logError = this.log.extend('ERROR*', '::')
  }

  async replyClaude(messages, userId) {
    try {
      const settings = await getIntegrationSettings(userId)
      const {apiKey, model} = settings?.claude || {}

      const max_tokens = getClaudeMaxOutput(model)
      const params = {apiKey, model, messages, max_tokens, userId}

      const response = await ClaudeService.sendMessages(params)

      return response?.content[0].text
    } catch (e) {
      this.logError(e)
      return ''
    }
  }

  async run(node, context, originalPrompt) {
    let prompt = originalPrompt
    const title = node?.command || node?.title

    if (!prompt || referencePatterns.withAssignmentPrefix().test(title)) {
      prompt = substituteReferencesAndHashrefsChildrenAndSelf(this.store.getNode(node.id), this.store)
    } else {
      prompt = clearCommandsWithParams(
        clearReferences(clearReferences(clearStepsPrefix(prompt), REF_DEF_PREFIX), HASHREF_DEF_PREFIX),
      )
    }

    prompt = context ? context + prompt : createContextForChat(node, {allNodes: this.store._nodes}) + prompt

    const userMessage = {
      content: prompt,
      role: 'user',
    }
    const messages = [userMessage]
    const text = (await this.replyClaude(messages, this.userId))?.replaceAll('**', '')

    this.store.importer.createNodes(text, node.id)
  }
}
