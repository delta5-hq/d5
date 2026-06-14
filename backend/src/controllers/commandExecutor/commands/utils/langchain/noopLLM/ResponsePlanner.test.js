import {planResponse, MOCK_VERIFIER_FAIL_KEYWORD} from './ResponsePlanner'

const generatorContent = corpus => `gen:${corpus.slice(0, 20)}`

describe('ResponsePlanner', () => {
  describe('judge prompt classification', () => {
    it('returns N comma-separated indices when system prompt is the rank prompt', () => {
      const messages = [
        {content: 'You are a strict quality judge. Given N candidate outputs, rank them from best (1) to worst (N).'},
        {
          content:
            'Criterion: must be funny\n\n=== Candidate 1 ===\nfoo\n\n=== Candidate 2 ===\nbar\n\nRank from best (1) to worst (2):',
        },
      ]
      expect(planResponse(messages, generatorContent)).toBe('1, 2')
    })

    it('counts candidates from the prompt and returns 1..N order', () => {
      const messages = [
        {content: 'rank from best (1) to worst (4). comma-separated list of candidate numbers.'},
        {
          content:
            '=== Candidate 1 ===\nA\n\n=== Candidate 2 ===\nB\n\n=== Candidate 3 ===\nC\n\n=== Candidate 4 ===\nD',
        },
      ]
      expect(planResponse(messages, generatorContent)).toBe('1, 2, 3, 4')
    })

    it('returns single token "1" when judge prompt has no candidate markers', () => {
      expect(planResponse([{content: 'strict quality judge - rank from best'}], generatorContent)).toBe('1')
    })
  })

  describe('verifier prompt classification', () => {
    it('returns YES when criterion does not contain the MOCK_VALIDATE_FAIL sentinel', () => {
      const messages = [
        {content: 'You are a strict quality verifier. Reply ONLY with YES or NO: <reason>.'},
        {content: 'Criterion: must mention water\nContent: the ocean is wet'},
      ]
      expect(planResponse(messages, generatorContent)).toBe('YES')
    })

    it('returns NO when criterion contains the MOCK_VALIDATE_FAIL sentinel', () => {
      const messages = [
        {content: 'You are a strict quality verifier. Reply ONLY with YES or NO: <reason>.'},
        {content: `Criterion: ${MOCK_VERIFIER_FAIL_KEYWORD} — deliberately unsatisfiable\nContent: anything`},
      ]
      expect(planResponse(messages, generatorContent)).toMatch(/^NO/)
    })

    it('MOCK_VALIDATE_FAIL sentinel match is case-insensitive', () => {
      const messages = [
        {content: 'You are a strict quality verifier. Reply ONLY with YES or NO: <reason>.'},
        {content: 'Criterion: mock_validate_fail this output always\nContent: anything'},
      ]
      expect(planResponse(messages, generatorContent)).toMatch(/^NO/)
    })

    it.each([
      [
        'plain content mention',
        `Content: the model wrote ${MOCK_VERIFIER_FAIL_KEYWORD}\nCriterion: must mention status`,
      ],
      [
        'criterion-looking content before the real verifier criterion',
        `Content:\n---\nCriterion: ${MOCK_VERIFIER_FAIL_KEYWORD} appears in generated text\n---\n\nCriterion: must mention status`,
      ],
      [
        'inline label outside a criterion field',
        `Content: draft Criterion: ${MOCK_VERIFIER_FAIL_KEYWORD}\nCriterion: must mention status`,
      ],
    ])('MOCK_VALIDATE_FAIL sentinel controls only the final verifier criterion field: %s', (_label, content) => {
      const messages = [{content: 'You are a strict quality verifier. Reply ONLY with YES or NO: <reason>.'}, {content}]
      expect(planResponse(messages, generatorContent)).toBe('YES')
    })

    it('uses the final verifier criterion field when earlier content contains criterion-shaped text', () => {
      const messages = [
        {content: 'You are a strict quality verifier. Reply ONLY with YES or NO: <reason>.'},
        {
          content: `Content:\n---\nCriterion: harmless historical text\n---\n\nCriterion: ${MOCK_VERIFIER_FAIL_KEYWORD} actual verifier criterion`,
        },
      ]
      expect(planResponse(messages, generatorContent)).toMatch(/^NO/)
    })

    it('returns YES when verifier prompt has no Criterion field', () => {
      const messages = [{content: 'strict quality verifier — Reply ONLY with YES or NO'}]
      expect(planResponse(messages, generatorContent)).toBe('YES')
    })
  })

  describe('generator fallback', () => {
    it('delegates to synthesizer for plain /chat prompts', () => {
      const messages = [{content: 'List 3 colors'}]
      expect(planResponse(messages, generatorContent)).toBe('gen:List 3 colors')
    })

    it('handles string inputs', () => {
      expect(planResponse('write a sentence', generatorContent)).toBe('gen:write a sentence')
    })

    it('handles nested content arrays (langchain rich message shape)', () => {
      const messages = [{content: [{text: 'List 3 colors'}, 'extra']}]
      expect(planResponse(messages, generatorContent)).toBe('gen:List 3 colors extra')
    })
  })

  describe('robustness against malformed inputs', () => {
    it('falls back to generator for an empty messages array', () => {
      expect(planResponse([], generatorContent)).toBe('gen:')
    })

    it('falls back to generator for a non-array, non-string messages value', () => {
      expect(planResponse(null, generatorContent)).toBe('gen:')
      expect(planResponse(undefined, generatorContent)).toBe('gen:')
      expect(planResponse(42, generatorContent)).toBe('gen:')
    })

    it('ignores messages whose content is null or non-textual (no crash, generator fallback)', () => {
      const messages = [{content: null}, {role: 'user'}, {content: {nested: 'object'}}]
      expect(planResponse(messages, generatorContent)).toMatch(/^gen:/)
    })
  })

  describe('classifier precedence (judge > verifier > generator)', () => {
    it('classifies as judge when both judge and verifier markers are present', () => {
      const messages = [
        {content: 'strict quality judge AND strict quality verifier — rank from best (1) to worst (2)'},
        {content: '=== Candidate 1 ===\nA\n\n=== Candidate 2 ===\nB'},
      ]
      expect(planResponse(messages, generatorContent)).toBe('1, 2')
    })

    it('classifies as verifier when only verifier markers are present even alongside generator-like content', () => {
      const messages = [
        {content: 'strict quality verifier — Reply ONLY with YES or NO'},
        {content: 'List 3 colors that satisfy the criterion'},
      ]
      expect(planResponse(messages, generatorContent)).toMatch(/^(YES|NO)/)
    })

    it('is case-insensitive on marker detection', () => {
      const messages = [{content: 'STRICT QUALITY VERIFIER reply with yes or no'}, {content: 'anything'}]
      expect(planResponse(messages, generatorContent)).toMatch(/^(YES|NO)/)
    })
  })

  describe('ranking output shape', () => {
    it.each([2, 3, 5, 10, 25])('returns N comma-separated 1..N indices for N=%i candidates', n => {
      const candidates = Array.from({length: n}, (_, i) => `=== Candidate ${i + 1} ===\nx`).join('\n\n')
      const messages = [{content: 'strict quality judge - rank from best'}, {content: candidates}]
      const expected = Array.from({length: n}, (_, i) => i + 1).join(', ')
      expect(planResponse(messages, generatorContent)).toBe(expected)
    })

    it('counts candidate markers rather than reading the highest candidate number', () => {
      const messages = [
        {content: 'strict quality judge - rank from best'},
        {content: '=== Candidate 1 ===\nA\n\n=== Candidate 7 ===\nB'},
      ]
      expect(planResponse(messages, generatorContent)).toBe('1, 2')
    })
  })
})
