import EvalCorpusAdapter from './EvalCorpusAdapter'

describe('EvalCorpusAdapter.validate', () => {
  describe('valid corpus', () => {
    it('accepts a single-entry corpus with two candidates', () => {
      const corpus = [
        {
          prompt: 'What is the capital of France?',
          candidates: ['Paris', 'London'],
          groundTruthBest: 0,
        },
      ]
      expect(EvalCorpusAdapter.validate(corpus)).toBeNull()
    })

    it('accepts a multi-entry corpus with varying candidate counts', () => {
      const corpus = [
        {prompt: 'Q1', candidates: ['A', 'B', 'C'], groundTruthBest: 2},
        {prompt: 'Q2', candidates: ['X', 'Y'], groundTruthBest: 1},
      ]
      expect(EvalCorpusAdapter.validate(corpus)).toBeNull()
    })

    it('accepts groundTruthBest=0 (lower boundary)', () => {
      const corpus = [{prompt: 'Q', candidates: ['A', 'B'], groundTruthBest: 0}]
      expect(EvalCorpusAdapter.validate(corpus)).toBeNull()
    })

    it('accepts groundTruthBest at last valid index (upper boundary)', () => {
      const corpus = [{prompt: 'Q', candidates: ['A', 'B', 'C'], groundTruthBest: 2}]
      expect(EvalCorpusAdapter.validate(corpus)).toBeNull()
    })
  })

  describe('invalid corpus container', () => {
    it.each([
      ['null', null],
      ['undefined', undefined],
      ['plain object', {}],
      ['string', 'not-an-array'],
      ['number', 42],
    ])('rejects %s', (_, input) => {
      expect(EvalCorpusAdapter.validate(input)).toMatch('non-empty array')
    })

    it('rejects empty array', () => {
      expect(EvalCorpusAdapter.validate([])).toMatch('non-empty array')
    })
  })

  describe('invalid entry — prompt', () => {
    it('rejects numeric prompt', () => {
      const corpus = [{prompt: 42, candidates: ['A', 'B'], groundTruthBest: 0}]
      expect(EvalCorpusAdapter.validate(corpus)).toMatch('corpus[0].prompt')
    })

    it('rejects whitespace-only prompt', () => {
      const corpus = [{prompt: '   ', candidates: ['A', 'B'], groundTruthBest: 0}]
      expect(EvalCorpusAdapter.validate(corpus)).toMatch('corpus[0].prompt')
    })

    it('rejects null prompt', () => {
      const corpus = [{prompt: null, candidates: ['A', 'B'], groundTruthBest: 0}]
      expect(EvalCorpusAdapter.validate(corpus)).toMatch('corpus[0].prompt')
    })

    it('rejects missing prompt field', () => {
      const corpus = [{candidates: ['A', 'B'], groundTruthBest: 0}]
      expect(EvalCorpusAdapter.validate(corpus)).toMatch('corpus[0].prompt')
    })
  })

  describe('invalid entry — candidates', () => {
    it('rejects fewer than two candidates', () => {
      const corpus = [{prompt: 'Q', candidates: ['A'], groundTruthBest: 0}]
      expect(EvalCorpusAdapter.validate(corpus)).toMatch('corpus[0].candidates')
    })

    it('rejects non-array candidates field', () => {
      const corpus = [{prompt: 'Q', candidates: 'not-an-array', groundTruthBest: 0}]
      expect(EvalCorpusAdapter.validate(corpus)).toMatch('corpus[0].candidates')
    })

    it('rejects missing candidates field', () => {
      const corpus = [{prompt: 'Q', groundTruthBest: 0}]
      expect(EvalCorpusAdapter.validate(corpus)).toMatch('corpus[0].candidates')
    })

    it('rejects non-string element with per-element index in error message', () => {
      const corpus = [{prompt: 'Q', candidates: ['A', 42], groundTruthBest: 0}]
      expect(EvalCorpusAdapter.validate(corpus)).toMatch('corpus[0].candidates[1]')
    })

    it('rejects null element', () => {
      const corpus = [{prompt: 'Q', candidates: ['A', null], groundTruthBest: 0}]
      expect(EvalCorpusAdapter.validate(corpus)).toMatch('corpus[0].candidates[1]')
    })
  })

  describe('invalid entry — groundTruthBest', () => {
    it('rejects index equal to candidates length (off-by-one)', () => {
      const corpus = [{prompt: 'Q', candidates: ['A', 'B'], groundTruthBest: 2}]
      expect(EvalCorpusAdapter.validate(corpus)).toMatch('groundTruthBest')
    })

    it('rejects negative index', () => {
      const corpus = [{prompt: 'Q', candidates: ['A', 'B'], groundTruthBest: -1}]
      expect(EvalCorpusAdapter.validate(corpus)).toMatch('groundTruthBest')
    })

    it('rejects floating-point index', () => {
      const corpus = [{prompt: 'Q', candidates: ['A', 'B'], groundTruthBest: 0.5}]
      expect(EvalCorpusAdapter.validate(corpus)).toMatch('groundTruthBest')
    })

    it('rejects undefined groundTruthBest', () => {
      const corpus = [{prompt: 'Q', candidates: ['A', 'B']}]
      expect(EvalCorpusAdapter.validate(corpus)).toMatch('groundTruthBest')
    })
  })

  describe('error message attribution', () => {
    it('attributes the error to the first invalid entry when corpus has multiple entries', () => {
      const corpus = [
        {prompt: 'Q1', candidates: ['A', 'B'], groundTruthBest: 0},
        {prompt: 'Q2', candidates: ['X'], groundTruthBest: 0},
      ]
      expect(EvalCorpusAdapter.validate(corpus)).toMatch('corpus[1]')
    })

    it('returns the first error only, not all errors', () => {
      const corpus = [{prompt: null, candidates: ['A'], groundTruthBest: -1}]
      const error = EvalCorpusAdapter.validate(corpus)
      expect(typeof error).toBe('string')
      expect(error.match(/corpus\[0\]/g)).toHaveLength(1)
    })
  })
})

describe('EvalCorpusAdapter.adaptCandidate', () => {
  it('sets the input text as the node title', () => {
    const candidate = EvalCorpusAdapter.adaptCandidate('my answer text')
    expect(candidate.getOutput().nodes[0].title).toBe('my answer text')
  })

  it('preserves text exactly including special characters', () => {
    const text = 'Line 1\nLine 2 — "quoted" & <tagged>'
    expect(EvalCorpusAdapter.adaptCandidate(text).getOutput().nodes[0].title).toBe(text)
  })

  it('returns an empty edges array', () => {
    expect(EvalCorpusAdapter.adaptCandidate('text').getOutput().edges).toEqual([])
  })

  it('returns an empty _nodes map', () => {
    expect(EvalCorpusAdapter.adaptCandidate('text')._nodes).toEqual({})
  })

  it('getOutput returns exactly one node', () => {
    expect(EvalCorpusAdapter.adaptCandidate('text').getOutput().nodes).toHaveLength(1)
  })

  it('returns a fresh nodes array on each getOutput call, preventing mutation leaks', () => {
    const candidate = EvalCorpusAdapter.adaptCandidate('text')
    expect(candidate.getOutput().nodes).not.toBe(candidate.getOutput().nodes)
  })

  it('two candidates from different texts are fully independent objects', () => {
    const a = EvalCorpusAdapter.adaptCandidate('A')
    const b = EvalCorpusAdapter.adaptCandidate('B')
    expect(a).not.toBe(b)
    expect(a.getOutput().nodes[0].title).toBe('A')
    expect(b.getOutput().nodes[0].title).toBe('B')
  })
})

describe('EvalCorpusAdapter.adapt', () => {
  it('preserves prompt for each entry', () => {
    const rawCorpus = [
      {prompt: 'First question', candidates: ['A', 'B'], groundTruthBest: 0},
      {prompt: 'Second question', candidates: ['X', 'Y'], groundTruthBest: 1},
    ]
    const adapted = EvalCorpusAdapter.adapt(rawCorpus)
    expect(adapted[0].prompt).toBe('First question')
    expect(adapted[1].prompt).toBe('Second question')
  })

  it('preserves groundTruthBest for each entry', () => {
    const rawCorpus = [
      {prompt: 'Q1', candidates: ['A', 'B'], groundTruthBest: 1},
      {prompt: 'Q2', candidates: ['X', 'Y', 'Z'], groundTruthBest: 2},
    ]
    const adapted = EvalCorpusAdapter.adapt(rawCorpus)
    expect(adapted[0].groundTruthBest).toBe(1)
    expect(adapted[1].groundTruthBest).toBe(2)
  })

  it('output corpus length equals input corpus length', () => {
    const rawCorpus = [
      {prompt: 'Q1', candidates: ['A', 'B'], groundTruthBest: 0},
      {prompt: 'Q2', candidates: ['X', 'Y', 'Z'], groundTruthBest: 2},
    ]
    expect(EvalCorpusAdapter.adapt(rawCorpus)).toHaveLength(2)
  })

  it('candidate count per entry is preserved', () => {
    const rawCorpus = [{prompt: 'Q', candidates: ['A', 'B', 'C'], groundTruthBest: 0}]
    expect(EvalCorpusAdapter.adapt(rawCorpus)[0].candidates).toHaveLength(3)
  })

  it('each adapted candidate exposes the getOutput interface with the original text', () => {
    const rawCorpus = [{prompt: 'Q', candidates: ['Paris', 'London'], groundTruthBest: 0}]
    const adapted = EvalCorpusAdapter.adapt(rawCorpus)
    expect(adapted[0].candidates[0].getOutput().nodes[0].title).toBe('Paris')
    expect(adapted[0].candidates[1].getOutput().nodes[0].title).toBe('London')
  })

  it('candidates within the same entry are distinct objects', () => {
    const rawCorpus = [{prompt: 'Q', candidates: ['A', 'B'], groundTruthBest: 0}]
    const adapted = EvalCorpusAdapter.adapt(rawCorpus)
    expect(adapted[0].candidates[0]).not.toBe(adapted[0].candidates[1])
  })

  it('entries are transformed independently — modifying one adapted entry does not affect another', () => {
    const rawCorpus = [
      {prompt: 'Q1', candidates: ['A', 'B'], groundTruthBest: 0},
      {prompt: 'Q2', candidates: ['X', 'Y'], groundTruthBest: 0},
    ]
    const adapted = EvalCorpusAdapter.adapt(rawCorpus)
    adapted[0].prompt = 'mutated'
    expect(adapted[1].prompt).toBe('Q2')
  })
})
