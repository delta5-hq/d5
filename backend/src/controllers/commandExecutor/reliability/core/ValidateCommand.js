import debug from 'debug'
import {SystemMessage, HumanMessage} from '@langchain/core/messages'
import {getIntegrationSettings, determineLLMType, getLLM} from '../../commands/utils/langchain/getLLM'
import {NodeTextExtractor} from '../../commands/utils/NodeTextExtractor'
import {getNodeCommand, isOutlineSummarize, isSummarize} from '../../commands/utils/isCommand'
import {isValidateCell, readValidateCriterion, readValidateN} from './validateParams'
import {isValidElectCell} from './electParams'
import {isRefineCell} from './refineParams'
import {FAILURE_CAUSE} from './failureSemantics'
import {parseJurorResponse} from './jurorVerdictParser'

export {parseJurorResponse}

const log = debug('delta5:validate')
// Juror failures must be visible in production, where DEBUG is `infinity:*`; the delta5 namespace is not.
const logJurorError = debug('infinity:validate:error')

const JUROR_SYSTEM_PROMPT =
  'You are a strict quality verifier. Check whether the given content satisfies the criterion. Reply ONLY with YES or NO: <one-line reason>.'

const buildJurorUserMessage = (criterion, content) =>
  `Content:\n---\n${content}\n---\n\nCriterion: ${criterion}\n\nDoes the content satisfy the criterion?`

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

  // Reliability modifiers have no generated output of their own. A sequencing term
  // (`/elect :n=N /steps`) keeps its step nodes as the modifier's own children, so the
  // fork's produced output is that subtree — the same content the judge reads off the
  // synthetic term node. Read it first; only a bare modifier with an empty subtree falls
  // through to the command immediately above it.
  if (
    (isValidElectCell(getNodeCommand(parentNode)) || isRefineCell(getNodeCommand(parentNode))) &&
    !hasMaterializedPromptOutput(parentNode, store)
  ) {
    const subtreeContent = await extractor.extractFullContent(parentNode)
    if (subtreeContent.trim()) return subtreeContent

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
      const verdict = parseJurorResponse(response)
      if (verdict.unparsed) logJurorError('juror verdict unrecognised: %o', verdict.reason)
      return verdict
    } catch (err) {
      logJurorError('juror call failed: %o', err)
      return {passed: null, reason: err?.message ?? String(err)}
    }
  }
}

// A juror that threw (passed: null) is not an abstention: dropping it from quorum lets one crash plus
// one YES silently pass. Any crash makes the whole predicate a NO_JUDGE_SIGNAL failure, carrying the
// juror's own error text so the cause is not replaced by an opaque constant.
const aggregateJurorResults = (results, criterion) => {
  const crashed = results.find(r => r.passed === null)
  if (crashed) {
    return {
      passed: false,
      criterion,
      reason: crashed.reason || FAILURE_CAUSE.NO_JUDGE_SIGNAL,
      failureCause: FAILURE_CAUSE.NO_JUDGE_SIGNAL,
    }
  }
  const firstFail = results.find(r => !r.passed)
  if (!firstFail) return {passed: true, criterion, reason: ''}
  if (firstFail.unparsed) {
    return {
      passed: false,
      criterion,
      reason: FAILURE_CAUSE.VERDICT_UNPARSED,
      failureCause: FAILURE_CAUSE.VERDICT_UNPARSED,
    }
  }
  return {passed: false, criterion, reason: firstFail.reason}
}
