const JUDGE_MARKERS = ['strict quality judge', 'rank from best', 'comma-separated list of candidate numbers']
const VERIFIER_MARKERS = ['strict quality verifier', 'Reply ONLY with YES or NO']

const concatMessages = messages => {
  if (typeof messages === 'string') return messages
  if (!Array.isArray(messages)) return ''
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

const detectKind = corpus => {
  const lower = corpus.toLowerCase()
  if (JUDGE_MARKERS.some(marker => lower.includes(marker.toLowerCase()))) return 'judge'
  if (VERIFIER_MARKERS.some(marker => lower.includes(marker.toLowerCase()))) return 'verifier'
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

export const MOCK_VERIFIER_FAIL_KEYWORD = 'MOCK_VALIDATE_FAIL'

const extractVerifierCriterion = corpus => {
  const matches = [...corpus.matchAll(/^\s*Criterion:\s*(.+?)\s*$/gim)]
  const lastCriterion = matches[matches.length - 1]
  return lastCriterion?.[1]?.trim() ?? ''
}

const verifierVerdict = corpus => {
  const criterion = extractVerifierCriterion(corpus)
  return criterion.toUpperCase().includes(MOCK_VERIFIER_FAIL_KEYWORD)
    ? `NO: mock rejection — criterion contains ${MOCK_VERIFIER_FAIL_KEYWORD}`
    : 'YES'
}

export const planResponse = (messages, synthesizeGeneratorContent) => {
  const corpus = concatMessages(messages)
  const kind = detectKind(corpus)

  switch (kind) {
    case 'judge':
      return rankingResponse(extractCandidateCount(corpus))
    case 'verifier':
      return verifierVerdict(corpus)
    case 'generator':
    default:
      return synthesizeGeneratorContent(corpus)
  }
}
