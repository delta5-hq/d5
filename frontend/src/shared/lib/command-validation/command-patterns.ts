const STEP_PREFIX = '#'
const STEP_PREFIX_PATTERN = `${STEP_PREFIX}(-?\\d+)`

function createStepPrefixRegex(): RegExp {
  return new RegExp(STEP_PREFIX_PATTERN, 'g')
}

export const STEP_PREFIX_REGEX = createStepPrefixRegex()

export function clearSequencePrefix(text: string): string {
  return text.replace(createStepPrefixRegex(), '').trim()
}

export function hasSequencePrefix(text: string): boolean {
  return createStepPrefixRegex().test(text)
}

export function extractSequenceNumber(text: string): number | null {
  const match = text.match(new RegExp(`^\\s*${STEP_PREFIX_PATTERN}`))
  return match ? parseInt(match[1], 10) : null
}
