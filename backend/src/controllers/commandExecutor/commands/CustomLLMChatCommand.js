import debug from 'debug'
import {clearCommandsWithParams} from '../constants'
import {clearStepsPrefix} from '../constants/steps'
import {substituteReferencesAndHashrefsChildrenAndSelf} from './references/substitution'
import {getIntegrationSettings, getLLM, Model} from './utils/langchain/getLLM'
import {HumanMessage, SystemMessage} from '@langchain/core/messages'
import {referencePatterns} from './references/utils/referencePatterns'
import {clearReferences} from './references/utils/referenceUtils'
import {REF_DEF_PREFIX, HASHREF_DEF_PREFIX} from './references/referenceConstants'
// eslint-disable-next-line no-unused-vars
import Store from './utils/Store'
import {throwIfAborted, throwIfAbortError} from './utils/executionSignal'
import {createContextForChat} from './utils/createContextForChat'

const log = debug('delta5:app:Command:CustomLLM')

export class CustomLLMChatCommand {
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

  async replyChat(messages, options = {}) {
    const settings = await getIntegrationSettings(this.userId, this.workflowId, this.store)
    const {llm} = getLLM({type: Model.CustomLLM, settings})

    const result = await llm.invoke(
      messages.map(m => (m.role === 'system' ? new SystemMessage(m.content) : new HumanMessage(m.content))),
      options,
    )

    return result.content
  }

  async run(node, context, originalPrompt, options = {}) {
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

      const text = await this.replyChat([{role: 'user', content: prompt}], options)

      throwIfAborted(options.signal)
      this.store.importer.createNodes(text, node.id)
    } catch (e) {
      throwIfAbortError(e)
      this.logError(e)
      throwIfAborted(options.signal)
      this.store.importer.createErrorNode(`Error: ${e.message}`, node.id)
    }
  }
}
