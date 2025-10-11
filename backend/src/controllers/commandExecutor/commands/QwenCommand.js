import debug from 'debug'
import {clearCommandsWithParams} from '../constants'
import {clearStepsPrefix} from '../constants/steps'
import {substituteReferencesAndHashrefsChildrenAndSelf} from './references/substitution'
import {getIntegrationSettings} from './utils/langchain/getLLM'
import {QWEN_DEFAULT_MODEL} from '../../../constants'
import {Configuration, OpenAIApi} from 'openai'
import {QWEN_API_URL} from '../../../shared/config/constants'
import {referencePatterns} from './references/utils/referencePatterns'
import {clearReferences} from './references/utils/referenceUtils' // Direct import
import {REF_DEF_PREFIX, HASHREF_DEF_PREFIX} from './references/referenceConstants'
// eslint-disable-next-line no-unused-vars
import Store from './utils/Store'
import {createContextForChat} from './utils/createContextForChat'

const log = debug('delta5:app:Command:Qwen')

/**
 * Class representing a Qwen Command.
 */
export class QwenCommand {
  /**
   * Creates an instance of QwenCommand
   * @param {string} userId - The unique identifier for the user
   * @param {string} workflowId - The unique identifier for the map (optional)
   * @param {Store} store - The store object
   */
  constructor(userId, workflowId, store) {
    this.store = store
    this.userId = userId
    this.workflowId = workflowId
    this.log = log.extend(userId, '/')
    if (this.workflowId) {
      this.log = this.log.extend(workflowId, '#')
    }
    this.logError = this.log.extend('ERROR*', '::')
  }

  async replyQwen(messages) {
    try {
      const settings = await getIntegrationSettings(this.userId)
      const {apiKey, model = QWEN_DEFAULT_MODEL} = settings?.qwen || {}

      const {data} = await new OpenAIApi(new Configuration({apiKey, basePath: QWEN_API_URL})).createChatCompletion({
        messages,
        model,
        top_p: 0.7,
      })

      return data.choices[0].message.content
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
    const text = (await this.replyQwen(messages, this.userId))?.replaceAll('**', '')

    this.store.importer.createNodes(text, node.id)
  }
}
