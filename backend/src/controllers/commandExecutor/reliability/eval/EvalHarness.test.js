import EvalHarness from './EvalHarness'
import LLMJudge from '../core/LLMJudge'

jest.mock('../core/LLMJudge')

const makeCandidate = text => ({
  getOutput: () => ({nodes: [{title: text}], edges: []}),
  _nodes: {},
})

const makeEntry = (prompt, candidateTexts, groundTruthBest) => ({
  prompt,
  candidates: candidateTexts.map(makeCandidate),
  groundTruthBest,
})

describe('EvalHarness.evaluate', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 100% accuracy when judge always picks the ground-truth winner', async () => {
    LLMJudge.evaluate.mockResolvedValue({
      winnerIndex: 0,
      confidence: 0.9,
      reason: null,
    })

    const corpus = [
      makeEntry('What is the capital?', ['Paris', 'London'], 0),
      makeEntry('Explain photosynthesis', ['Good answer', 'Bad answer'], 0),
    ]

    const report = await EvalHarness.evaluate(corpus, 'OpenAI', {
      openai: {apiKey: 'sk-x'},
    })

    expect(report.accuracy).toBe(1)
    expect(report.correctPicks).toBe(2)
    expect(report.totalEntries).toBe(2)
    expect(report.failedCalls).toBe(0)
  })

  it('returns 0% accuracy when judge always picks the wrong candidate', async () => {
    LLMJudge.evaluate.mockResolvedValue({
      winnerIndex: 1,
      confidence: 0.6,
      reason: null,
    })

    const corpus = [makeEntry('prompt', ['A', 'B'], 0)]

    const report = await EvalHarness.evaluate(corpus, 'OpenAI', {
      openai: {apiKey: 'sk-x'},
    })

    expect(report.accuracy).toBe(0)
    expect(report.missRate).toBe(1)
    expect(report.entries[0].correct).toBe(false)
  })

  it('counts failed calls when judge returns a non-null reason', async () => {
    LLMJudge.evaluate.mockResolvedValue({
      winnerIndex: 0,
      confidence: null,
      reason: 'no_alternative_model_available',
    })

    const corpus = [makeEntry('prompt', ['A', 'B'], 0)]

    const report = await EvalHarness.evaluate(corpus, 'OpenAI', {
      openai: {apiKey: 'sk-x'},
    })

    expect(report.failedCalls).toBe(1)
    expect(report.entries[0].correct).toBe(false)
  })

  it('returns zero-accuracy report for empty corpus', async () => {
    const report = await EvalHarness.evaluate([], 'OpenAI', {})

    expect(report.accuracy).toBe(0)
    expect(report.totalEntries).toBe(0)
    expect(report.entries).toHaveLength(0)
  })

  it('includes per-entry detail in report', async () => {
    LLMJudge.evaluate.mockResolvedValue({
      winnerIndex: 1,
      confidence: 0.75,
      reason: null,
    })

    const corpus = [makeEntry('prompt', ['A', 'B', 'C'], 1)]

    const report = await EvalHarness.evaluate(corpus, 'OpenAI', {})

    expect(report.entries[0]).toEqual({
      index: 0,
      groundTruth: 1,
      judgeWinner: 1,
      confidence: 0.75,
      reason: null,
      correct: true,
    })
  })

  it('forwards judgeOptions to LLMJudge.evaluate', async () => {
    LLMJudge.evaluate.mockResolvedValue({
      winnerIndex: 0,
      confidence: 1,
      reason: null,
    })

    const corpus = [makeEntry('prompt', ['A', 'B'], 0)]
    const judgeOptions = {judgeFamily: 'claude', judgeSamples: 3}

    await EvalHarness.evaluate(corpus, 'OpenAI', {}, judgeOptions)

    expect(LLMJudge.evaluate).toHaveBeenCalledWith('prompt', expect.anything(), 'OpenAI', {}, judgeOptions)
  })

  it('skips entries where LLMJudge throws', async () => {
    LLMJudge.evaluate
      .mockResolvedValueOnce({winnerIndex: 0, confidence: 0.9, reason: null})
      .mockRejectedValueOnce(new Error('network error'))

    const corpus = [makeEntry('prompt 1', ['A', 'B'], 0), makeEntry('prompt 2', ['C', 'D'], 0)]

    const report = await EvalHarness.evaluate(corpus, 'OpenAI', {})

    expect(report.totalEntries).toBe(1)
    expect(report.correctPicks).toBe(1)
  })
})
