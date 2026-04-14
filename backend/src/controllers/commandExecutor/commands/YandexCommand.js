import debug from 'debug'
import {clearCommandsWithParams} from '../constants'
import {clearStepsPrefix} from '../constants/steps'
import {substituteReferencesAndHashrefsChildrenAndSelf} from './references/substitution'
import {readJoinParam, readTableParam} from '../constants/yandex'
import {getIntegrationSettings} from './utils/langchain/getLLM'
import YandexService from '../../integrations/yandex/YandexService'
import {referencePatterns} from './references/utils/referencePatterns'
import {clearReferences} from './references/utils/referenceUtils' // Direct import
import {REF_DEF_PREFIX, HASHREF_DEF_PREFIX} from './references/referenceConstants'
// eslint-disable-next-line no-unused-vars
import Store from './utils/Store'
import {createContextForChat} from './utils/createContextForChat'

const log = debug('delta5:app:Command:Yandex')

/**
 * Class representing a Yandex Command.
 */
export class YandexCommand {
  /**
   * Creates an instance of YandexCommand
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

  async replyYandex(messages, userId, workflowId, store) {
    const settings = await getIntegrationSettings(userId, workflowId, store)
    const {folder_id, model, ...credentials} = settings?.yandex || {}

    if (!credentials.apiKey || !folder_id) {
      throw new Error(
        'YandexGPT API key and folder ID not configured. Set them in Integration Settings or set the YANDEX_API_KEY and YANDEX_FOLDER_ID environment variables.',
      )
    }

    const modelUri = `gpt://${folder_id}/${model}`

    const response = await YandexService.completionWithRetry({messages, modelUri, ...credentials})

    return response?.alternatives[0].message.text
  }

  async run(node, context, originalPrompt) {
    try {
      let prompt = originalPrompt
      const title = node?.command || node?.title

      if (
        !prompt ||
        referencePatterns.withAssignmentPrefix().test(title) ||
        referencePatterns.withAssignmentPrefix(HASHREF_DEF_PREFIX).test(title)
      ) {
        prompt = substituteReferencesAndHashrefsChildrenAndSelf(this.store.getNode(node.id), this.store)
      } else {
        prompt = clearCommandsWithParams(
          clearReferences(clearReferences(clearStepsPrefix(prompt), REF_DEF_PREFIX), HASHREF_DEF_PREFIX),
        )
      }

      prompt = context ? context + prompt : createContextForChat(node, {store: this.store}) + prompt

      const userMessage = {
        text: prompt,
        role: 'user',
      }

      if (readTableParam(title)) {
        const messages = [
          {
            text: 'Create a table based on user request',
            role: 'system',
          },
          userMessage,
        ]

        const text = (await this.replyYandex(messages, this.userId, this.workflowId, this.store))?.replaceAll('**', '')

        this.store.importer.createTable(text, node.id)
      } else {
        const messages = [userMessage]
        const text = (await this.replyYandex(messages, this.userId, this.workflowId, this.store))?.replaceAll('**', '')

        if (readJoinParam(title)) {
          this.store.importer.createJoinNode(text, node.id)
        } else {
          this.store.importer.createNodes(text, node.id)
        }
      }
    } catch (e) {
      this.logError(e)
      this.store.importer.createNodes(`Error: ${e.message}`, node.id)
    }
  }
}
