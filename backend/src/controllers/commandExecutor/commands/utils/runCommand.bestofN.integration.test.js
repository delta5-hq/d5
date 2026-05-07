/**
 * Integration tests for BestOfN + LLMJudge full execution chain.
 *
 * Scope:
 * - N=2 with cross-family judge override (:judge=claude): proves command string → parser →
 *   BestOfNStrategy → LLMJudge.evaluate (with override) → suffix written to node title
 * - N=3 denominator propagation
 * - /validate child criteria forwarded to judge
 * - /refine :n=N post-processor gains suffix after parent execution
 * - No-judge fallback when override family is unavailable (:judge=unknownfamily)
 *
 * Out of scope:
 * - All-fail gate (requires injected errors)
 * - SSH/MCP/RPC transports
 * - UI/browser layer
 *
 * Requires env vars:
 *   TEST_MONGO_URI   — mongodb URI for an isolated test database
 *   OPENAI_API_KEY   — OpenAI key (generator)
 *   ANTHROPIC_API_KEY — Anthropic key (judge override target)
 */

import {LLMIntegrationFixture} from './__tests__/fixtures/LLMIntegrationFixture'

const TEST_DB_URI = process.env.TEST_MONGO_URI
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

const canRun = !!(TEST_DB_URI && OPENAI_API_KEY && ANTHROPIC_API_KEY)
const describeIfLLM = canRun ? describe : describe.skip

jest.setTimeout(120000)

const USER_PREFIX = 'bestofN-integration-test-'

describeIfLLM('runCommand — BestOfN real-LLM integration', () => {
  let fixture

  beforeEach(async () => {
    const userId = USER_PREFIX + Date.now()
    fixture = new LLMIntegrationFixture(userId, TEST_DB_URI)
    await fixture.connect()
    await fixture.insertProviders({
      openai: {apiKey: OPENAI_API_KEY, model: 'gpt-4o-mini'},
      claude: {apiKey: ANTHROPIC_API_KEY, model: 'claude-haiku-4-5'},
    })
  })

  afterEach(async () => {
    await fixture.teardown()
  })

  describe('N=2 with :judge=claude override (core path)', () => {
    it('writes [✓ X/2 best of 2] suffix proving judge ran, output is non-empty', async () => {
      const {cellTitle, output} = await fixture.executeCell('/chat :n=2 :judge=claude List 3 primary colors', {
        prompt: 'List 3 primary colors',
      })

      expect(cellTitle).toMatch(/\[✓/)
      expect(cellTitle).toMatch(/\/2 best of 2/)
      expect(output.nodes.length).toBeGreaterThan(0)
    }, 90000)
  })

  describe('No-judge fallback when override family is unavailable', () => {
    it('writes [first-survivor · no judge] suffix when no alternative provider exists', async () => {
      const userId = USER_PREFIX + 'nojudge-' + Date.now()
      const borrowedFixture = new LLMIntegrationFixture(userId, TEST_DB_URI)
      await borrowedFixture.connect()
      await borrowedFixture.insertProviders({
        openai: {apiKey: OPENAI_API_KEY, model: 'gpt-4o-mini'},
      })

      const {cellTitle} = await borrowedFixture.executeCell('/chat :n=2 :judge=unknownfamily List 3 primary colors', {
        prompt: 'List 3 primary colors',
      })

      expect(cellTitle).toMatch(/first-survivor/)
      expect(cellTitle).toMatch(/no judge/)
    }, 90000)
  })

  describe('N=3 denominator propagation', () => {
    it('suffix denominator equals 3', async () => {
      const {cellTitle} = await fixture.executeCell('/chat :n=3 :judge=claude List 3 primary colors', {
        prompt: 'List 3 primary colors',
      })

      expect(cellTitle).toMatch(/\/3/)
    }, 90000)
  })

  describe('/validate child criteria forwarded to judge', () => {
    it('executes without error and writes reliability suffix to parent node', async () => {
      const {cellTitle} = await fixture.executeCell('/chat :n=2 :judge=claude List 3 primary colors', {
        prompt: 'List 3 primary colors',
        children: [{id: 'val-1', command: '/validate Must name specific colors like Red, Blue, or Yellow'}],
      })

      expect(cellTitle).toMatch(/\[✓|✗/)
    }, 90000)
  })

  describe('/refine :n=2 post-processor', () => {
    it('refine child node gains a reliability suffix after parent execution', async () => {
      const {childTitles} = await fixture.executeCell('/chat :n=2 :judge=claude List 3 primary colors', {
        prompt: 'List 3 primary colors',
        children: [{id: 'refine-1', command: '/refine :n=2'}],
      })

      expect(childTitles['refine-1']).toMatch(/\[✓|✗/)
    }, 90000)
  })
})
