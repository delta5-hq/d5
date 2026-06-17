import debug from 'debug'

const log = debug('delta5:app:structuralGate')

const REFUSAL_PATTERNS = [
  /^i('m| am) (sorry|unable|not able)/i,
  /^i cannot (help|assist|provide|generate|create|write)/i,
  /^i('m| am) afraid i (can'?t|cannot|won'?t)/i,
  /^(sorry,? )?(as an ai|as a language model)/i,
  /^i('d| would) (be happy to help|prefer not to)/i,
  /^unfortunately,? i (can'?t|cannot|don'?t)/i,
]

export const MIN_SUBSTANTIVE_CHARS = 20

const isEmptyOutput = text => !text || !text.trim()

const isRefusalOutput = text => REFUSAL_PATTERNS.some(re => re.test(text.trimStart()))

const isTruncatedOutput = text => text.trim().length < MIN_SUBSTANTIVE_CHARS

const emitRejection = (reason, forkIndex) => {
  const label = forkIndex !== null ? `fork-${forkIndex}` : 'fork-?'
  log('%s rejected: %s', label, reason)
}

const passesBaseGate = (text, forkIndex) => {
  if (isEmptyOutput(text)) {
    emitRejection('empty output', forkIndex)
    return false
  }
  if (isRefusalOutput(text)) {
    emitRejection(`refusal pattern matched — ${text?.trimStart().slice(0, 80)}`, forkIndex)
    return false
  }
  return true
}

export const passesStructuralGate = (text, forkIndex = null) => {
  if (!passesBaseGate(text, forkIndex)) return false
  if (isTruncatedOutput(text)) {
    emitRejection(`output too short (${text?.trim().length} chars)`, forkIndex)
    return false
  }
  return true
}

export const passesCommodityGate = (text, forkIndex = null) => passesBaseGate(text, forkIndex)
