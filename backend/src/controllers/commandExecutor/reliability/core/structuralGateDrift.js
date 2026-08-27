export const STRUCTURAL_GATE_DRIFT_SIGNAL = 'structural-gate drift signal'

const REFUSAL_DRIFT_PATTERNS = [
  /^i\s*(?:will not|won't)\s+(?:comply|continue|answer|provide|generate|create|write)/i,
  /^i\s*(?:am|'m)\s+not\s+(?:allowed|permitted|comfortable)\s+to/i,
  /^i\s*(?:am|'m)\s+not\s+able\s+to/i,
  /^i\s+can't\s+(?:comply|continue|answer|provide|generate|create|write)/i,
  /\bpolicy\s+(?:does not allow|prevents me|requires me to refuse)\b/i,
  /\bi\s+must\s+refuse\b/i,
]

export function isRefusalDriftCandidate(text) {
  const value = typeof text === 'string' ? text.trimStart() : ''
  return REFUSAL_DRIFT_PATTERNS.some(pattern => pattern.test(value))
}

export function buildStructuralGateDriftEvent({forkIndex, score, winnerScore, rankingCount}) {
  return {forkIndex, score, winnerScore, rankingCount}
}

export function shouldRecordStructuralGateDrift({content, score, winnerScore}) {
  return score > winnerScore && isRefusalDriftCandidate(content)
}

export function recordStructuralGateDrift({log, forkIndex, content, score, winnerScore, rankingCount}) {
  if (!shouldRecordStructuralGateDrift({content, score, winnerScore})) return null

  const event = buildStructuralGateDriftEvent({
    forkIndex,
    score,
    winnerScore,
    rankingCount,
  })
  log(
    'structural-gate drift signal: fork-%d passed gate then lost ranking (borda=%d, winner=%d, rankings=%d)',
    event.forkIndex,
    event.score,
    event.winnerScore,
    event.rankingCount,
  )
  return event
}
