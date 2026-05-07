/**
 * Integration tests for EvalHarness with a real LLM judge.
 *
 * Scope:
 * - Real LLM judge call (no mocks): accuracy and missRate are computed correctly
 * - Corpus entry with an obvious correct answer: judge picks it reliably
 * - Multi-entry corpus: totalEntries matches input
 * - Per-test judge family override via judgeOptions.judgeFamily
 *
 * Out of scope:
 * - HTTP-layer routing and auth middleware (covered by ExecutorController tests)
 * - Judge quality benchmarking (requires a larger calibration corpus)
 *
 * Requires env vars:
 *   TEST_MONGO_URI    — mongodb URI for an isolated test database
 *   OPENAI_API_KEY    — generator family credentials
 *   ANTHROPIC_API_KEY — judge family credentials (:judge=claude override)
 */

import EvalHarness from './EvalHarness'
import EvalCorpusAdapter from './EvalCorpusAdapter'
import {LLMIntegrationFixture} from '../../commands/utils/__tests__/fixtures/LLMIntegrationFixture'
import {Model} from '../../commands/utils/langchain/getLLM'

const TEST_DB_URI = process.env.TEST_MONGO_URI
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

const canRun = !!(TEST_DB_URI && OPENAI_API_KEY && ANTHROPIC_API_KEY)
const describeIfLLM = canRun ? describe : describe.skip

jest.setTimeout(120000)

const USER_PREFIX = 'eval-harness-integration-test-'

const UNAMBIGUOUS_CORPUS_RAW = [
  {
    prompt: 'What are the three primary colors of light?',
    candidates: [
      'Red, Green, and Blue are the three primary colors of light.',
      'Pizza, hamburgers, and hot dogs are popular American foods.',
    ],
    groundTruthBest: 0,
  },
]

const TWO_ENTRY_CORPUS_RAW = [
  {
    prompt: 'What are the three primary colors of light?',
    candidates: ['Red, Green, and Blue are the three primary colors of light.', 'The moon is made of cheese.'],
    groundTruthBest: 0,
  },
  {
    prompt: 'What is the capital of France?',
    candidates: ['Paris is the capital of France.', 'Bananas are yellow fruits.'],
    groundTruthBest: 0,
  },
]

describeIfLLM('EvalHarness — real LLM judge integration', () => {
  let fixture
  let settings

  beforeEach(async () => {
    const userId = USER_PREFIX + Date.now()
    fixture = new LLMIntegrationFixture(userId, TEST_DB_URI)
    await fixture.connect()
    await fixture.insertProviders({
      openai: {apiKey: OPENAI_API_KEY, model: 'gpt-4o-mini'},
      claude: {apiKey: ANTHROPIC_API_KEY, model: 'claude-haiku-4-5'},
    })
    settings = await fixture.getSettings()
  })

  afterEach(async () => {
    await fixture.teardown()
  })

  describe('Unambiguous corpus entry with :judge=claude override', () => {
    it('accuracy = 1 when judge picks the obviously correct candidate', async () => {
      const corpus = EvalCorpusAdapter.adapt(UNAMBIGUOUS_CORPUS_RAW)

      const report = await EvalHarness.evaluate(corpus, Model.OpenAI, settings, {
        judgeFamily: 'claude',
      })

      expect(report.accuracy).toBe(1)
      expect(report.missRate).toBe(0)
      expect(report.correctPicks).toBe(1)
      expect(report.entries[0].correct).toBe(true)
    }, 90000)

    it('entries[0] carries judgment metadata', async () => {
      const corpus = EvalCorpusAdapter.adapt(UNAMBIGUOUS_CORPUS_RAW)

      const report = await EvalHarness.evaluate(corpus, Model.OpenAI, settings, {
        judgeFamily: 'claude',
      })

      const entry = report.entries[0]
      expect(entry.index).toBe(0)
      expect(entry.groundTruth).toBe(0)
      expect(entry.judgeWinner).toBe(0)
      expect(entry.reason).toBeNull()
    }, 90000)
  })

  describe('Multi-entry corpus', () => {
    it('totalEntries equals corpus length', async () => {
      const corpus = EvalCorpusAdapter.adapt(TWO_ENTRY_CORPUS_RAW)

      const report = await EvalHarness.evaluate(corpus, Model.OpenAI, settings, {
        judgeFamily: 'claude',
      })

      expect(report.totalEntries).toBe(2)
      expect(report.entries).toHaveLength(2)
    }, 90000)

    it('accuracy is in [0, 1] range', async () => {
      const corpus = EvalCorpusAdapter.adapt(TWO_ENTRY_CORPUS_RAW)

      const report = await EvalHarness.evaluate(corpus, Model.OpenAI, settings, {
        judgeFamily: 'claude',
      })

      expect(report.accuracy).toBeGreaterThanOrEqual(0)
      expect(report.accuracy).toBeLessThanOrEqual(1)
      expect(report.accuracy + report.missRate).toBeCloseTo(1, 5)
    }, 90000)
  })

  describe('Report structure completeness', () => {
    it('report includes all required fields', async () => {
      const corpus = EvalCorpusAdapter.adapt(UNAMBIGUOUS_CORPUS_RAW)

      const report = await EvalHarness.evaluate(corpus, Model.OpenAI, settings, {
        judgeFamily: 'claude',
      })

      expect(report).toMatchObject({
        accuracy: expect.any(Number),
        missRate: expect.any(Number),
        totalEntries: expect.any(Number),
        correctPicks: expect.any(Number),
        failedCalls: expect.any(Number),
        entries: expect.any(Array),
      })
    }, 60000)
  })
})
