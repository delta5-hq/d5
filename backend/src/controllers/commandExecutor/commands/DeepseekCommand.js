import debug from 'debug'
import {clearCommandsWithParams} from '../constants'
import {clearStepsPrefix} from '../constants/steps'
import {substituteReferencesAndHashrefsChildrenAndSelf} from './references/substitution'
import {getIntegrationSettings} from './utils/langchain/getLLM'
import {ChatOpenAI} from 'langchain/chat_models/openai'
import {HumanMessage} from 'langchain/schema'
import {DEEPSEEK_API_URL} from '../../../shared/config/constants'
import {DEEPSEEK_DEFAULT_MODEL} from '../../../constants'
import {referencePatterns} from './references/utils/referencePatterns'
import {clearReferences} from './references/utils/referenceUtils' // Direct import
import {REF_DEF_PREFIX, HASHREF_DEF_PREFIX} from './references/referenceConstants'
// eslint-disable-next-line no-unused-vars
import Store from './utils/Store'
import {createContextForChat} from './utils/createContextForChat'

const log = debug('delta5:app:Command:Deepseek')

/**
 * Class representing a Deepseek Command.
 */
export class DeepseekCommand {
  /**
   * Creates an instance of DeepseekCommand
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

  async replyDeepseek(message, userId) {
    try {
      const settings = await getIntegrationSettings(userId)
      const {apiKey, model} = settings?.deepseek || {}

      const llm = new ChatOpenAI({
        openAIApiKey: apiKey,
        modelName: model || DEEPSEEK_DEFAULT_MODEL,
        configuration: {
          basePath: DEEPSEEK_API_URL,
        },
        maxRetries: 1,
      })

      const result = await llm.call([new HumanMessage(message)])

      return result.content
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

    const text = (await this.replyDeepseek(prompt, this.userId))?.replaceAll('**', '')

    this.store.importer.createNodes(text, node.id)
  }
}
