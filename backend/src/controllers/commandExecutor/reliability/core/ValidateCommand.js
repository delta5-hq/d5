import debug from 'debug'
import {SystemMessage, HumanMessage} from '@langchain/core/messages'
import {getIntegrationSettings, determineLLMType, getLLM} from '../../commands/utils/langchain/getLLM'
import {NodeTextExtractor} from '../../commands/utils/NodeTextExtractor'
import {getNodeCommand} from '../../commands/utils/isCommand'
import {isValidateCell, readValidateCriterion, readValidateN} from './validateParams'

const log = debug('delta5:validate')

const JUROR_SYSTEM_PROMPT =
  'You are a strict quality verifier. Check whether the given content satisfies the criterion. Reply ONLY with YES or NO: <one-line reason>.'

const buildJurorUserMessage = (criterion, content) =>
  `Content:\n---\n${content}\n---\n\nCriterion: ${criterion}\n\nDoes the content satisfy the criterion?`

const parseJurorResponse = raw => {
  const text = (typeof raw === 'string' ? raw : raw?.content ?? '').trim()
  if (/^yes\b/i.test(text)) return {passed: true, reason: ''}
  const match = text.match(/^no[:\s]+(.*)/is)
  return {passed: false, reason: match ? match[1].trim() : text}
}

const skipValidateFn = node => isValidateCell(getNodeCommand(node))

export class ValidateCommand {
  constructor(userId, workflowId, store) {
    this.userId = userId
    this.workflowId = workflowId
    this.store = store
    this.log = log.extend(userId)
  }

  async run(validateNode, options = {}) {
    const {signal} = options
    const command = getNodeCommand(validateNode)
    const criterion = readValidateCriterion(command)
    const n = readValidateN(command)

    const parentNode = this.store.getNode(validateNode.parent)
    if (!parentNode) return {passed: true, criterion, reason: ''}

    const extractor = new NodeTextExtractor(Infinity, skipValidateFn, this.store)
    const content = await extractor.extractFullContent(parentNode)

    if (!content.trim()) return {passed: true, criterion, reason: ''}

    const settings = await getIntegrationSettings(this.userId, this.workflowId, this.store)
    const llmType = determineLLMType(getNodeCommand(parentNode), settings)
    const {llm} = getLLM({type: llmType, settings, log: this.log})

    const results = await Promise.all(Array.from({length: n}, () => this._callJuror(llm, criterion, content, signal)))

    return aggregateJurorResults(results, criterion)
  }

  async _callJuror(llm, criterion, content, signal) {
    try {
      const messages = [
        new SystemMessage(JUROR_SYSTEM_PROMPT),
        new HumanMessage(buildJurorUserMessage(criterion, content)),
      ]
      const response = await llm.invoke(messages, signal ? {signal} : undefined)
      return parseJurorResponse(response)
    } catch (err) {
      this.log('juror error: %o', err)
      return {passed: null, reason: err?.message ?? String(err)}
    }
  }
}

const aggregateJurorResults = (results, criterion) => {
  const votingResults = results.filter(r => r.passed !== null)
  if (votingResults.length === 0) return {passed: false, criterion, reason: 'all jurors failed'}
  const firstFail = votingResults.find(r => !r.passed)
  return firstFail ? {passed: false, criterion, reason: firstFail.reason} : {passed: true, criterion, reason: ''}
}
