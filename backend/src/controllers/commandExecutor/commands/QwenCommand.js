import debug from 'debug'
import {clearCommandsWithParams} from '../constants'
import {clearStepsPrefix} from '../constants/steps'
import {substituteReferencesAndHashrefsChildrenAndSelf} from './references/substitution'
import {getIntegrationSettings} from './utils/langchain/getLLM'
import {QWEN_DEFAULT_MODEL} from '../../../constants'
import OpenAI from 'openai'
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
   * @param {string} workflowId - The unique identifier for the workflow (optional)
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
    const settings = await getIntegrationSettings(this.userId, this.workflowId, this.store)
    const {apiKey, model = QWEN_DEFAULT_MODEL} = settings?.qwen || {}

    if (!apiKey) {
      throw new Error(
        'Qwen API key not configured. Set it in Integration Settings or set the QWEN_API_KEY environment variable.',
      )
    }

    const client = new OpenAI({
      apiKey,
      baseURL: QWEN_API_URL,
    })

    const response = await client.chat.completions.create({
      messages,
      model,
      top_p: 0.7,
    })

    return response.choices[0].message.content
  }

  async run(node, context, originalPrompt) {
    try {
      let prompt = originalPrompt
      const title = node?.command || node?.title

      if (!prompt || referencePatterns.withAssignmentPrefix().test(title)) {
        prompt = substituteReferencesAndHashrefsChildrenAndSelf(this.store.getNode(node.id), this.store)
      } else {
        prompt = clearCommandsWithParams(
          clearReferences(clearReferences(clearStepsPrefix(prompt), REF_DEF_PREFIX), HASHREF_DEF_PREFIX),
        )
      }

      prompt = context ? context + prompt : createContextForChat(node, {store: this.store}) + prompt

      const userMessage = {
        content: prompt,
        role: 'user',
      }
      const messages = [userMessage]
      const text = (await this.replyQwen(messages, this.userId))?.replaceAll('**', '')

      this.store.importer.createNodes(text, node.id)
    } catch (e) {
      this.logError(e)
      this.store.importer.createNodes(`Error: ${e.message}`, node.id)
    }
  }
}
