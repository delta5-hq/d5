import debug from 'debug'
import {clearCommandsWithParams} from '../constants'
import {clearStepsPrefix} from '../constants/steps'
import {substituteReferencesAndHashrefsChildrenAndSelf} from './references/substitution'
import {getIntegrationSettings} from './utils/langchain/getLLM'
import {PERPLEXITY_DEFAULT_MODEL} from '../../../constants'
import {PERPLEXITY_API_URL} from '../../../shared/config/constants'
import {Configuration, OpenAIApi} from 'openai'
import {cleanChainOfThoughtText} from '../../utils/cleanChainOfThoughtText'
import {referencePatterns} from './references/utils/referencePatterns'
import {clearReferences} from './references/utils/referenceUtils' // Direct import
import {REF_DEF_PREFIX, HASHREF_DEF_PREFIX} from './references/referenceConstants'
// eslint-disable-next-line no-unused-vars
import Store from './utils/Store'
import {createContextForChat} from './utils/createContextForChat'

const log = debug('delta5:app:Command:Perplexity')

/**
 * Class representing a Perplexity Command.
 */
export class PerplexityCommand {
  static async call(messages, credentials, callOptions) {
    const model = new OpenAIApi(new Configuration({apiKey: credentials.apiKey}), PERPLEXITY_API_URL)

    const result = await model.createChatCompletion(
      {
        messages,
        model: credentials.model || PERPLEXITY_DEFAULT_MODEL,
      },
      callOptions,
    )

    return result.data
  }

  /**
   * Creates an instance of PerplexityCommand
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

  async reply(messages, userId) {
    try {
      const {perplexity} = await getIntegrationSettings(userId)

      const {choices, citations} = await PerplexityCommand.call(messages, perplexity)

      let completionResult = cleanChainOfThoughtText(choices[0].message?.content.replace(/\[\d+\]/g, ''))

      if (!completionResult) return ''

      if (citations.length) {
        completionResult += `\n\nCitations:\n    ${citations.join('\n    ')}`
      }

      return completionResult
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
    const text = (await this.reply(messages, this.userId))?.replaceAll('**', '')

    this.store.importer.createNodes(text, node.id)
  }
}
