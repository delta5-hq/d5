// A juror verdict is a gate predicate: only a recognised affirmation passes. The verdict is decided
// on the LEADING token of the whole reply, so a negation whose reason merely opens with an
// affirmative word ("NO: correct but empty") cannot leak through, and a label introducing prose
// ("Criterion not satisfied: yes the reply is empty") is never mistaken for an affirmation.
//
// `yes` is the primary affirmation: it passes as the leading token, or as the whole verdict behind a
// bare label ("Answer: YES"). The secondary words (true / correct / passed / affirmative) pass only
// when they are the entire reply; behind a label or amid prose they are not a verdict. Every other
// reply — a genuine negative, an unrecognised verdict, or empty — is a NON-AFFIRMATION and fails; it
// is never dropped from quorum as an abstention. An unrecognised reply carries {unparsed: true} so a
// no-parse is distinguishable from a genuine NO downstream, and stays distinct from the crash
// sentinel ({passed: null}), which only the juror call site produces.

const LEADING_NOISE = /^[\s*_>#`"'-]+/
const TRAILING_NOISE = /[\s*_>#`"'.!]+$/

const LEADING_YES = /^yes\b/i
const LEADING_NEGATIVE = /^(?:no|false|incorrect|negative|fail(?:ed)?)\b/i
const NEGATIVE_REASON = /^(?:no|false|incorrect|negative|fail(?:ed)?)\b[:.\s-]+(.*)/is
const WHOLE_AFFIRMATION = /^(?:yes|true|correct|affirmative|pass(?:ed)?)$/i
const LABELLED_BARE_YES = /^[A-Za-z][A-Za-z ]*:\s*yes\s*$/i

const stripLeadingNoise = text => text.replace(LEADING_NOISE, '')
const stripTrailingNoise = text => text.replace(TRAILING_NOISE, '')

const affirmation = () => ({passed: true, reason: ''})
const rejection = reason => ({passed: false, reason})
const unparsed = reason => ({passed: false, reason, unparsed: true})

// A negative verdict's delimited tail is its reason; a bare token ("NO") has no tail, so the whole
// reply stands as the juror's words rather than an empty reason.
const negativeReason = text => {
  const captured = text.match(NEGATIVE_REASON)?.[1]?.trim()
  return captured || text
}

const extractText = raw => (typeof raw === 'string' ? raw : raw?.content ?? '').trim()

export const parseJurorResponse = raw => {
  const text = extractText(raw)
  const normalised = stripLeadingNoise(text)
  if (LEADING_NEGATIVE.test(normalised)) return rejection(negativeReason(normalised))
  if (LEADING_YES.test(normalised)) return affirmation()

  const bare = stripTrailingNoise(normalised)
  if (WHOLE_AFFIRMATION.test(bare)) return affirmation()
  if (LABELLED_BARE_YES.test(bare)) return affirmation()

  return unparsed(text)
}
