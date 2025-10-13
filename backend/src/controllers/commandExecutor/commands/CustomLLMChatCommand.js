import debug from 'debug'
import {clearCommandsWithParams} from '../constants'
import {clearStepsPrefix} from '../constants/steps'
import {substituteReferencesAndHashrefsChildrenAndSelf} from './references/substitution'
import {getIntegrationSettings} from './utils/langchain/getLLM'
import {HumanMessage, SystemMessage} from 'langchain/schema'
import {referencePatterns} from './references/utils/referencePatterns'
import {clearReferences} from './references/utils/referenceUtils'
import {REF_DEF_PREFIX, HASHREF_DEF_PREFIX} from './references/referenceConstants'
import {CustomLLMChat} from './utils/langchain/CustomLLMChat'
// eslint-disable-next-line no-unused-vars
import Store from './utils/Store'
import {createContextForChat} from './utils/createContextForChat'

const log = debug('delta5:app:Command:CustomLLM')

/**
 * Class representing a CustomLLMChat Command.
 */
export class CustomLLMChatCommand {
  /**
   * Creates an instance of CustomLLMChatCommand
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

  async replyChat(messages) {
    try {
      const settings = await getIntegrationSettings(this.userId)
      const {custom_llm} = settings

      const llm = new CustomLLMChat({
        apiRootUrl: custom_llm.apiRootUrl,
        apiType: custom_llm.apiType,
      })

      const result = await llm.call(
        messages.map(m => {
          return m.role === 'system' ? new SystemMessage(m.content) : new HumanMessage(m.content)
        }),
      )

      return result.content
    } catch (e) {
      console.error(e)
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

    const text = await this.replyChat([{role: 'user', content: prompt}])

    this.store.importer.createNodes(text, node.id)
  }
}
