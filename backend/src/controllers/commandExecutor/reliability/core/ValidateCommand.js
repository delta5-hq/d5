import debug from 'debug'
import {SystemMessage, HumanMessage} from '@langchain/core/messages'
import {getIntegrationSettings, determineLLMType, getLLM} from '../../commands/utils/langchain/getLLM'
import {NodeTextExtractor} from '../../commands/utils/NodeTextExtractor'
import {getNodeCommand, isOutlineSummarize, isSummarize} from '../../commands/utils/isCommand'
import {isValidateCell, readValidateCriterion, readValidateN} from './validateParams'
import {isValidElectCell} from './electParams'

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

const hasMaterializedPromptOutput = (node, store) => (node.prompts ?? []).some(promptId => store.getNode(promptId))

const isSummaryPostProcessor = node => isSummarize(node) || isOutlineSummarize(getNodeCommand(node))

const extractValidationContent = async (parentNode, store) => {
  const extractor = new NodeTextExtractor(Infinity, skipValidateFn, store)
  const summaryOutputs = []

  for (const childId of parentNode.children ?? []) {
    const child = store.getNode(childId)
    if (!child || !isSummaryPostProcessor(child) || !hasMaterializedPromptOutput(child, store)) {
      continue
    }

    const content = await extractor.extractFullContent(child)
    if (content.trim()) {
      summaryOutputs.push(content)
    }
  }

  if (summaryOutputs.length) {
    return summaryOutputs.join('\n')
  }

  // children may include stale superseded nodes from prior retry attempts
  const promptOutputs = []
  for (const promptId of parentNode.prompts ?? []) {
    const promptNode = store.getNode(promptId)
    if (!promptNode) continue
    const content = await extractor.extractFullContent(promptNode)
    if (content.trim()) {
      promptOutputs.push(content)
    }
  }

  if (promptOutputs.length) {
    return promptOutputs.join('\n')
  }

  // inside a fork before winner selection, elect has no output yet — validate the command being electd
  if (isValidElectCell(getNodeCommand(parentNode)) && !hasMaterializedPromptOutput(parentNode, store)) {
    const grandparent = store.getNode(parentNode.parent)
    if (grandparent) {
      const gpContent = await extractValidationContent(grandparent, store)
      if (gpContent.trim()) return gpContent
    }
  }

  return extractor.extractFullContent(parentNode)
}

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
    if (!parentNode) return {passed: false, criterion, reason: 'parent cell is missing'}
    const content = await extractValidationContent(parentNode, this.store)

    if (!content.trim()) return {passed: false, criterion, reason: 'parent output is empty'}

    const settings = await getIntegrationSettings(this.userId, this.workflowId, this.store)
    const llmType = determineLLMType(settings)
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
