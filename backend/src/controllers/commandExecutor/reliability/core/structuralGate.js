import debug from 'debug'
import {deterministicFailureReason} from './failureSemantics'

const log = debug('delta5:app:structuralGate')

const REFUSAL_PATTERNS_EN = [
  /^i('m| am) (sorry|unable|not able)/i,
  /^i cannot (help|assist|provide|generate|create|write)/i,
  /^i('m| am) afraid i (can'?t|cannot|won'?t)/i,
  /^(sorry,? )?(as an ai|as a language model)/i,
  /^i('d| would) (be happy to help|prefer not to)/i,
  /^unfortunately,? i (can'?t|cannot|don'?t)/i,
]

const REFUSAL_PATTERNS_RU = [
  /^извините,? (но )?я не (могу|буду|стану)/i,
  /^прошу прощения,? (но )?(я )?не (могу|буду)/i,
  /^к сожалению,? (я )?не (могу|буду|смогу|стану|в состоянии)/i,
  /^я не могу (помочь|создать|написать|предоставить|генерировать|выполнить|ассистировать)/i,
  /^я не буду (помогать|создавать|писать|предоставлять|генерировать|выполнять)/i,
  /^я (боюсь|опасаюсь),? (что )?не могу/i,
  /^(как языковая модель|как ии|как искусственный интеллект)/i,
]

const REFUSAL_PATTERNS = [...REFUSAL_PATTERNS_EN, ...REFUSAL_PATTERNS_RU]

export const MIN_SUBSTANTIVE_CHARS = 20

const isEmptyOutput = text => !text || !text.trim()

const isRefusalOutput = text => REFUSAL_PATTERNS.some(re => re.test(text.trimStart()))

const isTruncatedOutput = text => text.trim().length < MIN_SUBSTANTIVE_CHARS

const emitRejection = (reason, forkIndex) => {
  const label = forkIndex != null ? `fork-${forkIndex}` : 'fork-?'
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

export const passesStructuralGate = (text, forkIndex = null, failureSignal = null) => {
  const deterministicReason = deterministicFailureReason(failureSignal)
  if (deterministicReason) {
    emitRejection(deterministicReason, forkIndex)
    return false
  }
  if (!passesBaseGate(text, forkIndex)) return false
  if (isTruncatedOutput(text)) {
    emitRejection(`output too short (${text?.trim().length} chars)`, forkIndex)
    return false
  }
  return true
}

// Known ceiling: a soft HTTP-200 error body that arrives as non-empty, non-refusal prose
// without a machine-readable failure signal is structurally indistinguishable from a
// valid completion and passes this gate. Users who need semantic soft-error detection
// must use /elect :n=N + /validate (judge layer).
export const passesCommodityGate = (text, forkIndex = null) => passesBaseGate(text, forkIndex)
