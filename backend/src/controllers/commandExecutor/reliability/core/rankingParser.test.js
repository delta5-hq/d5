import {
  fromJsonArray,
  fromMarkdownNumberedList,
  fromMarkdownTable,
  fromPostSeparator,
  fromPlainNumbers,
  RANKING_STRATEGIES,
  parseRankingResponse,
} from './rankingParser'

// ─── Shared fixtures ──────────────────────────────────────────────────────────

// Canonical fixture: candidates ranked 2nd > 1st > 3rd (best to worst).
// The 0-indexed result has rank-position-0 hold candidate-index-1, etc.
const N3 = 3
const N2 = 2
const RANKING_2_1_3 = [1, 0, 2]
const RANKING_2_1 = [1, 0]

// ─── fromJsonArray ────────────────────────────────────────────────────────────

describe('fromJsonArray', () => {
  describe('success — extracts candidates from the FIRST [...] bracket group', () => {
    it.each([
      ['compact array', '[2,1,3]'],
      ['spaced array', '[2, 1, 3]'],
      ['array embedded in prose', 'My ranking is [2, 1, 3] based on quality.'],
      ['array inside a JSON object', '{"ranking": [2, 1, 3]}'],
    ])('%s', (_, input) => {
      expect(fromJsonArray(input, N3)).toEqual(RANKING_2_1_3)
    })
  })

  describe('only the FIRST bracket group is tried — subsequent valid arrays are not considered', () => {
    it('first array is partial, second is complete → null (first group governs)', () => {
      expect(fromJsonArray('[1] then [2, 1, 3]', N3)).toBeNull()
    })

    it('first array contains out-of-range numbers, second is valid → null', () => {
      expect(fromJsonArray('[4, 5, 6] then [2, 1, 3]', N3)).toBeNull()
    })
  })

  describe('null — absent or insufficient bracket group', () => {
    it.each([
      ['no bracket group', '2, 1, 3'],
      ['fewer than N valid candidate numbers', '[2, 1]'],
      ['all numbers outside candidate range', '[4, 5, 6]'],
      ['empty array', '[]'],
    ])('%s → null', (_, input) => {
      expect(fromJsonArray(input, N3)).toBeNull()
    })
  })
})

// ─── fromMarkdownNumberedList ─────────────────────────────────────────────────

describe('fromMarkdownNumberedList', () => {
  describe('success — numbered list entries that identify a candidate by number', () => {
    it.each([
      ['plain Candidate label', '1. Candidate 2\n2. Candidate 1\n3. Candidate 3'],
      ['bold Candidate label', '1. **Candidate 2**\n2. **Candidate 1**\n3. **Candidate 3**'],
      [
        'headers and inline descriptions',
        '### Rankings\n1. **Candidate 2** - Best\n2. **Candidate 1** - Good\n3. **Candidate 3** - OK',
      ],
      ['parenthesis list delimiter', '1) Candidate 2\n2) Candidate 1\n3) Candidate 3'],
      ['bare candidate number without keyword', '1. 2\n2. 1\n3. 3'],
    ])('%s', (_, input) => {
      expect(fromMarkdownNumberedList(input, N3)).toEqual(RANKING_2_1_3)
    })
  })

  describe('null — list absent, incomplete, or containing no candidate numbers', () => {
    it.each([
      ['fewer than N entries', '1. Candidate 2\n2. Candidate 1'],
      [
        'entries contain only descriptive text, no candidate number',
        '1. Best response\n2. Middle response\n3. Worst response',
      ],
      ['no list at all', '2, 1, 3'],
    ])('%s → null', (_, input) => {
      expect(fromMarkdownNumberedList(input, N3)).toBeNull()
    })
  })
})

// ─── fromMarkdownTable ────────────────────────────────────────────────────────

describe('fromMarkdownTable', () => {
  describe('success — rank | candidate column table rows', () => {
    it.each([
      ['numeric candidate column', '| Rank | Candidate |\n|---|---|\n| 1 | 2 |\n| 2 | 1 |\n| 3 | 3 |'],
      [
        'Candidate keyword in cell',
        '| Rank | Candidate |\n| --- | --- |\n| 1 | Candidate 2 |\n| 2 | Candidate 1 |\n| 3 | Candidate 3 |',
      ],
      ['table preceded by prose', 'Here is my ranking:\n| Rank | Pick |\n|---|---|\n| 1 | 2 |\n| 2 | 1 |\n| 3 | 3 |'],
    ])('%s', (_, input) => {
      expect(fromMarkdownTable(input, N3)).toEqual(RANKING_2_1_3)
    })
  })

  describe('null — table absent, header-only, or candidate column out of range', () => {
    it.each([
      ['plain text with no table rows', '2, 1, 3'],
      ['fewer than N valid candidate rows', '| Rank | Candidate |\n| 1 | 2 |\n| 2 | 1 |'],
      ['header row and separator only, no data rows', '| Rank | Candidate |\n|---|---|'],
      ['candidate column contains out-of-range numbers', '| Rank | Score |\n| 1 | 100 |\n| 2 | 95 |\n| 3 | 89 |'],
    ])('%s → null', (_, input) => {
      expect(fromMarkdownTable(input, N3)).toBeNull()
    })
  })
})

// ─── fromPostSeparator ────────────────────────────────────────────────────────

describe('fromPostSeparator', () => {
  describe('success — ranking extracted from the tail after the LAST separator', () => {
    it.each([
      ['colon separator', 'I rank them: 2, 1, 3'],
      ['arrow separator', 'Best to worst → 2, 1, 3'],
      ['last of multiple colons used', 'Review: step 1: first pass. Final ranking: 2, 1, 3'],
      ['preamble noise numbers before colon ignored', 'After careful review of all 3 candidates, I rank: 2, 1, 3'],
      ['colon before arrow — arrow is last, arrow governs', 'Ranking: first pass → 2, 1, 3'],
      ['arrow before colon — colon is last, colon governs', 'Best→worst, final: 2, 1, 3'],
    ])('%s', (_, input) => {
      expect(fromPostSeparator(input, N3)).toEqual(RANKING_2_1_3)
    })
  })

  describe('null — separator absent or tail insufficient', () => {
    it.each([
      ['no separator character', '2 1 3'],
      ['tail after separator has fewer than N valid numbers', 'I rank: 2, 1'],
      ['tail after separator has no valid numbers at all', 'Result: unclear'],
    ])('%s → null', (_, input) => {
      expect(fromPostSeparator(input, N3)).toBeNull()
    })
  })
})

// ─── fromPlainNumbers ─────────────────────────────────────────────────────────

describe('fromPlainNumbers', () => {
  describe('success — clean input with no preamble noise', () => {
    it.each([
      ['comma-separated', '2,1,3'],
      ['space-separated', '2 1 3'],
      ['comma-space separated', '2, 1, 3'],
      ['comparison-operator delimiters', '2 > 1 > 3'],
      ['newline-separated', '2\n1\n3'],
    ])('%s', (_, input) => {
      expect(fromPlainNumbers(input, N3)).toEqual(RANKING_2_1_3)
    })
  })

  describe('rightmost-window invariant — answer extracted from tail despite in-range preamble noise', () => {
    it.each([
      ['count phrase adds noise number before ranking', '1 candidate evaluated. Final rank 2, 1, 3'],
      ['"all N candidates" phrase matches N exactly', 'After reviewing all 3 candidates 2 1 3'],
      ['noise number at start when noise equals last candidate', 'All 3 are good but 3, 1, 2'],
    ])('%s', (_, input) => {
      const result = fromPlainNumbers(input, N3)
      expect(result).not.toBeNull()
      const asOneBased = result.map(i => i + 1)
      const unique = new Set(asOneBased)
      expect(unique.size).toBe(N3)
      expect([...unique].sort()).toEqual([1, 2, 3])
    })

    it('specific result correctness: "1 candidate evaluated. Final rank 2, 1, 3"', () => {
      expect(fromPlainNumbers('1 candidate evaluated. Final rank 2, 1, 3', N3)).toEqual(RANKING_2_1_3)
    })

    it('specific result correctness: "After reviewing all 3 candidates 2 1 3"', () => {
      expect(fromPlainNumbers('After reviewing all 3 candidates 2 1 3', N3)).toEqual(RANKING_2_1_3)
    })
  })

  describe('null — completeness invariant requires exactly N unique in-range candidates', () => {
    it.each([
      ['empty string', ''],
      ['no in-range numbers at all', 'I cannot rank these candidates'],
      ['fewer than N unique valid candidates', '2, 1'],
      ['repeated number does not substitute for a missing candidate', '2, 2, 1'],
    ])('%s → null', (_, input) => {
      expect(fromPlainNumbers(input, N3)).toBeNull()
    })
  })
})

// ─── RANKING_STRATEGIES — exported chain ─────────────────────────────────────

describe('RANKING_STRATEGIES', () => {
  it('is an array of 5 callable strategy functions', () => {
    expect(Array.isArray(RANKING_STRATEGIES)).toBe(true)
    expect(RANKING_STRATEGIES).toHaveLength(5)
    expect(RANKING_STRATEGIES.every(s => typeof s === 'function')).toBe(true)
  })

  it('strategies are ordered: json → numbered-list → table → post-separator → plain-numbers', () => {
    expect(RANKING_STRATEGIES).toEqual([
      fromJsonArray,
      fromMarkdownNumberedList,
      fromMarkdownTable,
      fromPostSeparator,
      fromPlainNumbers,
    ])
  })
})

// ─── parseRankingResponse — input normalisation ───────────────────────────────

describe('parseRankingResponse — input normalisation', () => {
  describe('null for absent, empty, or non-text input', () => {
    it.each([
      ['empty string', ''],
      ['null', null],
      ['undefined', undefined],
      ['message object with empty content', {content: ''}],
      ['message object with undefined content', {content: undefined}],
      ['message object with array content (multimodal)', {content: ['text block', 'another']}],
    ])('%s → null', (_, input) => {
      expect(parseRankingResponse(input, N3)).toBeNull()
    })
  })

  it('accepts a LangChain message object by extracting .content string', () => {
    expect(parseRankingResponse({content: '2, 1, 3'}, N3)).toEqual(RANKING_2_1_3)
  })

  describe('null for unparseable text — juror excluded from quorum', () => {
    it.each([
      'I cannot rank these candidates as they are equally good.',
      'The outputs are identical in quality.',
      'Insufficient information to determine ranking.',
    ])('refusal: "%s" → null', text => {
      expect(parseRankingResponse(text, N3)).toBeNull()
    })

    it('fewer than N candidate numbers → null', () => {
      expect(parseRankingResponse('2', N3)).toBeNull()
    })
  })
})

// ─── parseRankingResponse — strategy priority ─────────────────────────────────

describe('parseRankingResponse — strategy priority (earlier strategy wins when multiple match)', () => {
  it('JSON array before numbered list', () => {
    const input = '1. 2\n2. 1\n3. 3\nActually: [3, 1, 2]'
    expect(parseRankingResponse(input, N3)).toEqual([2, 0, 1])
  })

  it('JSON array before markdown table', () => {
    const input = '| 1 | 2 |\n| 2 | 1 |\n| 3 | 3 |\nSummary: [3, 1, 2]'
    expect(parseRankingResponse(input, N3)).toEqual([2, 0, 1])
  })

  it('numbered list before markdown table', () => {
    const mdList = '1. Candidate 2\n2. Candidate 1\n3. Candidate 3'
    const table = '| Rank | Candidate |\n| 1 | 3 |\n| 2 | 1 |\n| 3 | 2 |'
    expect(parseRankingResponse(`${mdList}\n${table}`, N3)).toEqual(RANKING_2_1_3)
  })

  it('markdown table before post-separator', () => {
    const input = 'My pick: 3, 2, 1\n| Rank | Candidate |\n| 1 | 2 |\n| 2 | 1 |\n| 3 | 3 |'
    expect(parseRankingResponse(input, N3)).toEqual(RANKING_2_1_3)
  })

  it('numbered list before post-separator', () => {
    const input = 'My ranking:\n1. Candidate 2\n2. Candidate 1\n3. Candidate 3'
    expect(parseRankingResponse(input, N3)).toEqual(RANKING_2_1_3)
  })

  it('post-separator before plain numbers when preamble contains noise', () => {
    const input = '1 candidate evaluated. Final rank: 2, 1, 3'
    expect(parseRankingResponse(input, N3)).toEqual(RANKING_2_1_3)
  })
})

// ─── parseRankingResponse — N=2 boundary ─────────────────────────────────────

describe('parseRankingResponse — N=2 boundary', () => {
  it('correctly parses a two-candidate ranking', () => {
    expect(parseRankingResponse('2, 1', N2)).toEqual(RANKING_2_1)
  })

  it('returns null when only one of two required candidates appears', () => {
    expect(parseRankingResponse('1', N2)).toBeNull()
  })

  it('parses two-candidate JSON array', () => {
    expect(parseRankingResponse('[2, 1]', N2)).toEqual(RANKING_2_1)
  })

  it('parses two-candidate numbered list', () => {
    expect(parseRankingResponse('1. Candidate 2\n2. Candidate 1', N2)).toEqual(RANKING_2_1)
  })
})
