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

export const passesStructuralGate = text => !isEmptyOutput(text) && !isRefusalOutput(text) && !isTruncatedOutput(text)
