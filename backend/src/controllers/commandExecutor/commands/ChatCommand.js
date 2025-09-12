import debug from 'debug'
import {clearCommandsWithParams} from '../constants'
import {clearStepsPrefix} from '../constants/steps'
import {substituteReferencesAndHashrefsChildrenAndSelf} from './references/substitution'
import {readJoinParam, readTableParam} from '../constants/yandex'
import {getIntegrationSettings} from './utils/langchain/getLLM'
import {DEFAULT_OPENAI_MODEL_NAME, OPENAI_API_KEY} from '../../../constants'
import {ChatOpenAI} from 'langchain/chat_models/openai'
import {HumanMessage, SystemMessage} from 'langchain/schema'
import {referencePatterns} from './references/utils/referencePatterns'
import {clearReferences} from './references/utils/referenceUtils'
import {REF_DEF_PREFIX, HASHREF_DEF_PREFIX} from './references/referenceConstants'
// eslint-disable-next-line no-unused-vars
import Store from './utils/Store'
import {createContextForChat} from './utils/createContextForChat'

const log = debug('delta5:app:Command:Chat')

/**
 * Class representing a Chat Command.
 */
export class ChatCommand {
  /**
   * Creates an instance of ChatCommand
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

  async replyChatOpenAIAPI(messages) {
    try {
      const settings = await getIntegrationSettings(this.userId)
      const {openai} = settings

      const llm = new ChatOpenAI({
        openAIApiKey: openai?.apiKey || OPENAI_API_KEY,
        modelName: openai?.model || DEFAULT_OPENAI_MODEL_NAME,
      })

      const result = await llm.call(
        messages.map(m => {
          return m.role === 'system' ? new SystemMessage(m.content) : new HumanMessage(m.content)
        }),
      )

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

    if (readTableParam(title)) {
      const messages = [
        {
          content: 'Create a table based on user request',
          role: 'system',
        },
        {
          content: prompt,
          role: 'user',
        },
      ]

      const text = await this.replyChatOpenAIAPI(messages)

      this.store.importer.createTable(text, node.id)
    } else {
      const text = await this.replyChatOpenAIAPI([{role: 'user', content: prompt}])

      if (readJoinParam(title)) {
        this.store.importer.createJoinNode(text, node.id)
      } else {
        this.store.importer.createNodes(text, node.id)
      }
    }
  }
}
