const normalise = raw => {
  const c = typeof raw === 'string' ? raw : raw?.content
  return (typeof c === 'string' ? c : '').trim()
}

const inRange = (x, n) => Number.isInteger(x) && x >= 1 && x <= n

const toZeroIndexed = (nums, n) => {
  const seen = new Set()
  const result = []
  for (const x of nums) {
    if (!seen.has(x)) {
      seen.add(x)
      result.push(x - 1)
    }
  }
  return seen.size === n ? result : null
}

export const fromJsonArray = (text, n) => {
  const match = text.match(/\[[\d,\s]+\]/)
  if (!match) return null
  const nums = (match[0].match(/\d+/g) ?? []).map(Number).filter(x => inRange(x, n))
  return toZeroIndexed(nums, n)
}

export const fromMarkdownNumberedList = (text, n) => {
  const re = /^\d+[.)]\s*\**\s*(?:Candidate\s+)?(\d+)/gim
  const nums = []
  let m
  while ((m = re.exec(text)) !== null) {
    const v = parseInt(m[1], 10)
    if (inRange(v, n)) nums.push(v)
  }
  return toZeroIndexed(nums, n)
}

export const fromMarkdownTable = (text, n) => {
  const re = /^\|[^|]*\|\s*(?:Candidate\s+)?(\d+)\s*\|/gim
  const nums = []
  let m
  while ((m = re.exec(text)) !== null) {
    const v = parseInt(m[1], 10)
    if (inRange(v, n)) nums.push(v)
  }
  return toZeroIndexed(nums, n)
}

export const fromPostSeparator = (text, n) => {
  const lastSep = Math.max(text.lastIndexOf(':'), text.lastIndexOf('→'))
  if (lastSep === -1) return null
  const tail = text.slice(lastSep + 1)
  const nums = tail
    .split(/[\s,]+/)
    .map(s => parseInt(s, 10))
    .filter(x => inRange(x, n))
  return toZeroIndexed(nums, n)
}

// LLMs put preamble first and the answer last — scanning from the right
// isolates the actual ranking from in-range noise numbers in the preamble
// (e.g. "After reviewing all 3 candidates, ranked: 2, 1, 3").
export const fromPlainNumbers = (text, n) => {
  const nums = text
    .split(/[\s,]+/)
    .map(s => parseInt(s, 10))
    .filter(x => inRange(x, n))

  for (let end = nums.length; end >= n; end--) {
    const seen = new Set()
    const window = []
    for (let i = end - 1; i >= 0 && seen.size < n; i--) {
      if (!seen.has(nums[i])) {
        seen.add(nums[i])
        window.unshift(nums[i])
      }
    }
    if (seen.size === n) return window.map(x => x - 1)
  }
  return null
}

export const RANKING_STRATEGIES = [
  fromJsonArray,
  fromMarkdownNumberedList,
  fromMarkdownTable,
  fromPostSeparator,
  fromPlainNumbers,
]

export const parseRankingResponse = (raw, n) => {
  const text = normalise(raw)
  if (!text) return null
  for (const strategy of RANKING_STRATEGIES) {
    const result = strategy(text, n)
    if (result !== null) return result
  }
  return null
}
