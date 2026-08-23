const JUDGE_MARKERS = ['strict quality judge', 'rank from best', 'comma-separated list of candidate numbers']
const VERIFIER_MARKERS = ['strict quality verifier', 'Reply ONLY with YES or NO']
const USEFULNESS_MARKERS = ['Does this input state that there was no useful info', 'Respond strictly "true" or "false"']
const QA_MARKERS = ['Your only task is to answer a question', 'Context ```']
const ELECT_MARKERS = ['Your only task is to elect the answer', 'Original answer ```', 'New context ```']
const KNOWLEDGE_MAP_MARKERS = ['Your only task is making a knowledge map', 'Input: ```']
const PREVIEW_CHARS = 500

const concatMessages = messages => {
  if (typeof messages === 'string') return messages
  if (Array.isArray(messages)) {
    return messages
      .map(m => {
        if (typeof m === 'string') return m
        if (typeof m?.content === 'string') return m.content
        if (Array.isArray(m?.content)) {
          return m.content.map(part => (typeof part === 'string' ? part : part?.text ?? '')).join(' ')
        }
        return ''
      })
      .join('\n')
  }
  if (!messages || typeof messages !== 'object') return ''
  if (typeof messages.value === 'string') return messages.value
  if (typeof messages.text === 'string') return messages.text
  if (typeof messages.content === 'string') return messages.content
  if (typeof messages.toString === 'function' && messages.toString !== Object.prototype.toString) {
    return messages.toString()
  }
  return ''
}

const detectKind = corpus => {
  const lower = corpus.toLowerCase()
  if (JUDGE_MARKERS.some(marker => lower.includes(marker.toLowerCase()))) return 'judge'
  if (VERIFIER_MARKERS.some(marker => lower.includes(marker.toLowerCase()))) return 'verifier'
  if (USEFULNESS_MARKERS.every(marker => lower.includes(marker.toLowerCase()))) return 'usefulness'
  if (ELECT_MARKERS.every(marker => lower.includes(marker.toLowerCase()))) return 'elect'
  if (QA_MARKERS.every(marker => lower.includes(marker.toLowerCase()))) return 'qa'
  if (KNOWLEDGE_MAP_MARKERS.every(marker => lower.includes(marker.toLowerCase()))) return 'knowledge-map'
  return 'generator'
}

const extractCandidateCount = corpus => {
  const matches = corpus.match(/=== Candidate (\d+) ===/g) ?? []
  if (matches.length === 0) return 0
  return matches.length
}

const rankingResponse = candidateCount => {
  if (candidateCount <= 0) return '1'
  const order = []
  for (let i = 1; i <= candidateCount; i++) order.push(i)
  return order.join(', ')
}

const compact = value =>
  String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')

const preview = value => {
  const text = compact(value)
  if (text.length <= PREVIEW_CHARS) return text
  return `${text.slice(0, PREVIEW_CHARS)}...`
}

const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const extractFencedValue = (corpus, label) => {
  const pattern = new RegExp(`${escapeRegExp(label)}\\s*\`\`\`([\\s\\S]*?)\`\`\``, 'i')
  return corpus.match(pattern)?.[1]?.trim() ?? ''
}

const extractLastFencedValue = (corpus, label) => {
  const pattern = new RegExp(`${escapeRegExp(label)}\\s*\`\`\`([\\s\\S]*?)\`\`\``, 'gi')
  let last = ''
  let match = pattern.exec(corpus)
  while (match) {
    last = match[1]?.trim() ?? ''
    match = pattern.exec(corpus)
  }
  return last
}

const extractQuestion = corpus =>
  corpus.match(/Question:\s*([\s\S]*?)(?:\n\s*\n|Context\s*```|Original answer\s*```|$)/i)?.[1]?.trim() ?? ''

const usefulnessResponse = corpus => {
  const input = corpus.match(/Input:\s*"([\s\S]*?)"\s*\n\s*Question:/i)?.[1] ?? ''
  return /(?:there'?s|there is)\s+no useful info|no useful info|nothing found|not found/i.test(input) ? 'true' : 'false'
}

const qaResponse = corpus => {
  const question = preview(extractQuestion(corpus))
  const context = preview(extractFencedValue(corpus, 'Context'))
  return `mock-answer${question ? `: ${question}` : ''} :: ${context || 'empty context'}`
}

const electResponse = corpus => {
  const question = preview(extractQuestion(corpus))
  const original = preview(extractFencedValue(corpus, 'Original answer'))
  const context = preview(extractFencedValue(corpus, 'New context'))
  const evidence = context || original || 'empty context'
  return `mock-electd-answer${question ? `: ${question}` : ''} :: ${evidence}`
}

const knowledgeMapResponse = corpus => {
  const input = preview(extractLastFencedValue(corpus, 'Input:'))
  return `mock-knowledge-map :: ${input || 'empty input'}`
}

export const MOCK_VERIFIER_FAIL_KEYWORD = 'MOCK_VALIDATE_FAIL'
export const MOCK_VALIDATE_FAIL_CONDITIONAL_PREFIX = 'MOCK_VALIDATE_FAIL_IF_CONTENT_CONTAINS='

const extractVerifierCriterion = corpus => {
  const matches = [...corpus.matchAll(/^\s*Criterion:\s*(.+?)\s*$/gim)]
  const lastCriterion = matches[matches.length - 1]
  return lastCriterion?.[1]?.trim() ?? ''
}

const extractVerifierContent = corpus => {
  const match = corpus.match(/Content:\s*---\s*([\s\S]*?)\s*---/i)
  return match?.[1] ?? corpus
}

const CONDITIONAL_FAILURE_TOKEN_RE = new RegExp(`${MOCK_VALIDATE_FAIL_CONDITIONAL_PREFIX}(\\S+)`)

const readConditionalFailureToken = criterion => criterion.match(CONDITIONAL_FAILURE_TOKEN_RE)?.[1] ?? ''

const verifierVerdict = corpus => {
  const criterion = extractVerifierCriterion(corpus)
  const conditionalToken = readConditionalFailureToken(criterion)

  if (
    criterion.toUpperCase().includes(MOCK_VERIFIER_FAIL_KEYWORD) &&
    !criterion.includes(MOCK_VALIDATE_FAIL_CONDITIONAL_PREFIX)
  ) {
    return `NO: mock rejection — criterion contains ${MOCK_VERIFIER_FAIL_KEYWORD}`
  }

  if (conditionalToken && extractVerifierContent(corpus).includes(conditionalToken)) {
    return `NO: mock rejection — content contains ${conditionalToken}`
  }

  return 'YES'
}

export const planResponse = (messages, synthesizeGeneratorContent) => {
  const corpus = concatMessages(messages)
  const kind = detectKind(corpus)

  switch (kind) {
    case 'judge':
      return rankingResponse(extractCandidateCount(corpus))
    case 'verifier':
      return verifierVerdict(corpus)
    case 'usefulness':
      return usefulnessResponse(corpus)
    case 'qa':
      return qaResponse(corpus)
    case 'elect':
      return electResponse(corpus)
    case 'knowledge-map':
      return knowledgeMapResponse(corpus)
    case 'generator':
    default:
      return synthesizeGeneratorContent(corpus)
  }
}
