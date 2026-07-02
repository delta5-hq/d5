import {runCommand} from './utils/runCommand'
import {FOREACH_QUERY_TYPE} from '../constants/foreach'
import {CHAT_QUERY_TYPE} from '../constants/chat'
import {
  MOCK_VERIFIER_FAIL_KEYWORD,
  MOCK_VALIDATE_FAIL_CONDITIONAL_PREFIX,
} from './utils/langchain/noopLLM/ResponsePlanner'
import Store from './utils/Store'

jest.mock('debug', () => {
  const fn = jest.fn(() => fn)
  fn.extend = jest.fn(() => fn)
  return fn
})

jest.mock('../ProgressReporter', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    add: jest.fn(async label => label),
    remove: jest.fn(),
    dispose: jest.fn(),
    registerChild: jest.fn(),
  })),
}))

jest.mock('../reliability/core/resolveRefineCell', () => ({resolveRefineCell: jest.fn()}))
jest.mock('../reliability/core/RefineTopology', () => jest.fn(() => []))

function buildForeachStore({
  leafTitles = ['Alpha', 'Beta', 'Gamma'],
  validateCommands = ['/validate :retry=0 criterion'],
  parallel = false,
} = {}) {
  const leafIds = leafTitles.map(t => t.toLowerCase())
  const vtIds = validateCommands.map((_, i) => `vt${i}`)
  const foreachCmd = parallel ? '/foreach /chat @@' : '/foreach /chat @@ --parallel=no'

  const leafNodes = Object.fromEntries(
    leafTitles.map((title, i) => [leafIds[i], {id: leafIds[i], parent: 'batch', title, children: []}]),
  )
  const vtNodes = Object.fromEntries(
    validateCommands.map((cmd, i) => [`vt${i}`, {id: `vt${i}`, parent: 'fe', command: cmd, title: cmd, children: []}]),
  )

  const store = new Store({
    userId: 'user1',
    nodes: {
      root: {id: 'root', parent: null, children: ['batch']},
      batch: {id: 'batch', parent: 'root', title: 'Batch', children: [...leafIds, 'fe']},
      fe: {id: 'fe', parent: 'batch', command: foreachCmd, title: foreachCmd, children: vtIds},
      ...vtNodes,
      ...leafNodes,
    },
  })
  store._integrationSettingsCache = {}
  return store
}

const isValidateNode = n => (n.command ?? '').startsWith('/validate')

const templateValidatesInOutput = (store, foreachId = 'fe') =>
  store.getOutput().nodes.filter(n => isValidateNode(n) && n.parent === foreachId)

// Valid only for stores where iteration clones are the sole non-foreach-parented validates
// (no other /validate nodes exist outside the foreach subtree in the test store).
const iterationValidatesInOutput = (store, foreachId = 'fe') =>
  store.getOutput().nodes.filter(n => isValidateNode(n) && n.parent !== foreachId)

describe('/foreach /validate integrated execution contract', () => {
  const savedMock = process.env.MOCK_EXTERNAL_SERVICES
  beforeAll(() => {
    process.env.MOCK_EXTERNAL_SERVICES = 'true'
  })
  afterAll(() => {
    if (savedMock === undefined) delete process.env.MOCK_EXTERNAL_SERVICES
    else process.env.MOCK_EXTERNAL_SERVICES = savedMock
  })

  describe('template isolation — authored /validate node survives outer execution unmodified', () => {
    it.each([
      ['all-pass', '/validate :retry=0 always pass criterion'],
      ['all-fail', `/validate :retry=0 ${MOCK_VERIFIER_FAIL_KEYWORD} reject all`],
      ['mixed (content-keyed)', `/validate :retry=0 ${MOCK_VALIDATE_FAIL_CONDITIONAL_PREFIX}Beta`],
    ])('template title is verbatim after outer runCommand: %s', async (_label, validateCommand) => {
      const store = buildForeachStore({validateCommands: [validateCommand]})

      await runCommand({queryType: FOREACH_QUERY_TYPE, cell: store.getNode('fe'), store}).catch(() => {})

      expect(store.getNode('vt0').title).toBe(validateCommand)
    })

    it('template node is not emitted into getOutput() — only iteration clones are', async () => {
      const store = buildForeachStore()

      await runCommand({queryType: FOREACH_QUERY_TYPE, cell: store.getNode('fe'), store}).catch(() => {})

      expect(templateValidatesInOutput(store)).toHaveLength(0)
    })

    it('two template children: both template titles preserved verbatim after execution', async () => {
      const cmdA = '/validate :retry=0 criterion A'
      const cmdB = '/validate :retry=0 criterion B'
      const store = buildForeachStore({validateCommands: [cmdA, cmdB]})

      await runCommand({queryType: FOREACH_QUERY_TYPE, cell: store.getNode('fe'), store}).catch(() => {})

      expect(store.getNode('vt0').title).toBe(cmdA)
      expect(store.getNode('vt1').title).toBe(cmdB)
      expect(templateValidatesInOutput(store)).toHaveLength(0)
    })

    it.each([
      ['sequential', false],
      ['parallel', true],
    ])('%s mode: template title and output isolation hold across both execution modes', async (_label, parallel) => {
      const cmd = '/validate :retry=0 criterion'
      const store = buildForeachStore({validateCommands: [cmd], parallel})

      await runCommand({queryType: FOREACH_QUERY_TYPE, cell: store.getNode('fe'), store}).catch(() => {})

      expect(store.getNode('vt0').title).toBe(cmd)
      expect(templateValidatesInOutput(store)).toHaveLength(0)
    })
  })

  describe('iteration verdict count — N leaves × M templates produces N×M verdict nodes', () => {
    it.each([
      [['Alpha'], 1, false],
      [['Alpha', 'Beta', 'Gamma'], 1, false],
      [['Alpha'], 2, false],
      [['Alpha', 'Beta'], 2, false],
      [['Alpha', 'Beta', 'Gamma'], 1, true],
      [['Alpha', 'Beta', 'Gamma'], 2, true],
    ])('leaves=%j, templates=%d, parallel=%s', async (leafTitles, templateCount, parallel) => {
      const validateCommands = Array.from({length: templateCount}, (_, i) => `/validate :retry=0 criterion-${i}`)
      const store = buildForeachStore({leafTitles, validateCommands, parallel})

      await runCommand({queryType: FOREACH_QUERY_TYPE, cell: store.getNode('fe'), store}).catch(() => {})

      expect(iterationValidatesInOutput(store)).toHaveLength(leafTitles.length * templateCount)
    })
  })

  describe('iteration verdict ownership — every verdict node is parented under its leaf', () => {
    it('single leaf: the verdict node parent is the leaf, not the foreach cell', async () => {
      const store = buildForeachStore({leafTitles: ['Alpha']})

      await runCommand({queryType: FOREACH_QUERY_TYPE, cell: store.getNode('fe'), store}).catch(() => {})

      const [verdict] = iterationValidatesInOutput(store)
      expect(verdict.parent).toBe('alpha')
    })

    it('three leaves: verdict node parents equal {alpha, beta, gamma}', async () => {
      const store = buildForeachStore({leafTitles: ['Alpha', 'Beta', 'Gamma']})

      await runCommand({queryType: FOREACH_QUERY_TYPE, cell: store.getNode('fe'), store}).catch(() => {})

      const parentIds = new Set(iterationValidatesInOutput(store).map(n => n.parent))
      expect(parentIds).toEqual(new Set(['alpha', 'beta', 'gamma']))
    })

    it('2 templates × 2 leaves: all four verdict nodes are parented under their respective leaves', async () => {
      const store = buildForeachStore({
        leafTitles: ['Alpha', 'Beta'],
        validateCommands: ['/validate :retry=0 criterion A', '/validate :retry=0 criterion B'],
      })

      await runCommand({queryType: FOREACH_QUERY_TYPE, cell: store.getNode('fe'), store}).catch(() => {})

      const iterationNodes = iterationValidatesInOutput(store)
      expect(iterationNodes).toHaveLength(4)
      iterationNodes.forEach(n => expect(['alpha', 'beta']).toContain(n.parent))

      const alphaClones = iterationNodes.filter(n => n.parent === 'alpha')
      const betaClones = iterationNodes.filter(n => n.parent === 'beta')
      expect(alphaClones).toHaveLength(2)
      expect(betaClones).toHaveLength(2)
    })

    it('no iteration verdict node is parented under the foreach cell itself', async () => {
      const store = buildForeachStore()

      await runCommand({queryType: FOREACH_QUERY_TYPE, cell: store.getNode('fe'), store}).catch(() => {})

      iterationValidatesInOutput(store).forEach(n => expect(n.parent).not.toBe('fe'))
    })
  })

  describe('iteration verdict content — each iteration reflects its own generated output', () => {
    it('all iterations pass: every verdict node carries [✓]', async () => {
      const store = buildForeachStore()

      await runCommand({queryType: FOREACH_QUERY_TYPE, cell: store.getNode('fe'), store}).catch(() => {})

      iterationValidatesInOutput(store).forEach(n => expect(n.title).toMatch(/\[✓\]/))
    })

    it('all iterations fail: every verdict node carries [✗ N attempts]', async () => {
      const store = buildForeachStore({
        validateCommands: [`/validate :retry=0 ${MOCK_VERIFIER_FAIL_KEYWORD} reject all`],
      })

      await runCommand({queryType: FOREACH_QUERY_TYPE, cell: store.getNode('fe'), store}).catch(() => {})

      iterationValidatesInOutput(store).forEach(n => expect(n.title).toMatch(/\[✗\s+\d+\s+attempts\]/))
    })

    it.each([
      ['sequential', false],
      ['parallel', true],
    ])('conditional sentinel (%s): only the leaf whose content contains the token fails', async (_label, parallel) => {
      const store = buildForeachStore({
        leafTitles: ['Alpha', 'Beta', 'Gamma'],
        validateCommands: [`/validate :retry=0 ${MOCK_VALIDATE_FAIL_CONDITIONAL_PREFIX}Beta`],
        parallel,
      })

      await runCommand({queryType: FOREACH_QUERY_TYPE, cell: store.getNode('fe'), store}).catch(() => {})

      const verdicts = iterationValidatesInOutput(store)
      expect(verdicts.filter(n => /\[✓\]/.test(n.title))).toHaveLength(2)
      expect(verdicts.filter(n => /\[✗\s+\d+\s+attempts\]/.test(n.title))).toHaveLength(1)
    })

    it('two template criteria: each criterion is independently stamped per leaf', async () => {
      const store = buildForeachStore({
        leafTitles: ['Alpha'],
        validateCommands: [
          '/validate :retry=0 criterion A',
          `/validate :retry=0 ${MOCK_VERIFIER_FAIL_KEYWORD} reject B`,
        ],
      })

      await runCommand({queryType: FOREACH_QUERY_TYPE, cell: store.getNode('fe'), store}).catch(() => {})

      const verdicts = iterationValidatesInOutput(store)
      expect(verdicts).toHaveLength(2)
      expect(verdicts.filter(n => /\[✓\]/.test(n.title))).toHaveLength(1)
      expect(verdicts.filter(n => /\[✗\s+\d+\s+attempts\]/.test(n.title))).toHaveLength(1)
    })

    it('two templates × three leaves: each criterion verdict is content-keyed to its iteration independently', async () => {
      const store = buildForeachStore({
        leafTitles: ['Alpha', 'Beta', 'Gamma'],
        validateCommands: [
          `/validate :retry=0 ${MOCK_VALIDATE_FAIL_CONDITIONAL_PREFIX}Beta`,
          `/validate :retry=0 ${MOCK_VALIDATE_FAIL_CONDITIONAL_PREFIX}Gamma`,
        ],
      })

      await runCommand({queryType: FOREACH_QUERY_TYPE, cell: store.getNode('fe'), store}).catch(() => {})

      const verdicts = iterationValidatesInOutput(store)
      expect(verdicts).toHaveLength(6)

      const alphaVerdicts = verdicts.filter(n => n.parent === 'alpha')
      expect(alphaVerdicts).toHaveLength(2)
      expect(alphaVerdicts.every(n => /\[✓\]/.test(n.title))).toBe(true)

      const betaVerdicts = verdicts.filter(n => n.parent === 'beta')
      expect(betaVerdicts.filter(n => /\[✓\]/.test(n.title))).toHaveLength(1)
      expect(betaVerdicts.filter(n => /\[✗\s+\d+\s+attempts\]/.test(n.title))).toHaveLength(1)

      const gammaVerdicts = verdicts.filter(n => n.parent === 'gamma')
      expect(gammaVerdicts.filter(n => /\[✓\]/.test(n.title))).toHaveLength(1)
      expect(gammaVerdicts.filter(n => /\[✗\s+\d+\s+attempts\]/.test(n.title))).toHaveLength(1)
    })
  })

  describe('error propagation — outer foreach call completes regardless of per-leaf verdict', () => {
    it('resolves without throwing when all iterations pass', async () => {
      const store = buildForeachStore({validateCommands: ['/validate :retry=0 always passes']})

      await expect(runCommand({queryType: FOREACH_QUERY_TYPE, cell: store.getNode('fe'), store})).resolves.not.toThrow()
    })

    it('resolves without throwing even when all iterations fail — per-leaf errors are iteration-scoped', async () => {
      const store = buildForeachStore({
        validateCommands: [`/validate :retry=0 ${MOCK_VERIFIER_FAIL_KEYWORD} reject all`],
      })

      await expect(runCommand({queryType: FOREACH_QUERY_TYPE, cell: store.getNode('fe'), store})).resolves.not.toThrow()
    })

    it('resolves without throwing when iteration outcomes are mixed (some pass, some fail)', async () => {
      const store = buildForeachStore({
        leafTitles: ['Alpha', 'Beta', 'Gamma'],
        validateCommands: [`/validate :retry=0 ${MOCK_VALIDATE_FAIL_CONDITIONAL_PREFIX}Beta`],
      })

      await expect(runCommand({queryType: FOREACH_QUERY_TYPE, cell: store.getNode('fe'), store})).resolves.not.toThrow()
    })

    it('output contains all verdict nodes regardless of individual iteration outcomes', async () => {
      const store = buildForeachStore({
        leafTitles: ['Alpha', 'Beta', 'Gamma'],
        validateCommands: [`/validate :retry=0 ${MOCK_VERIFIER_FAIL_KEYWORD} reject all`],
      })

      await runCommand({queryType: FOREACH_QUERY_TYPE, cell: store.getNode('fe'), store}).catch(() => {})

      expect(iterationValidatesInOutput(store)).toHaveLength(3)
    })
  })

  describe('no /validate template children — no-op baseline', () => {
    it('produces no validate nodes in output when foreach has no /validate children', async () => {
      const store = buildForeachStore({validateCommands: []})

      await runCommand({queryType: FOREACH_QUERY_TYPE, cell: store.getNode('fe'), store}).catch(() => {})

      const allValidates = store.getOutput().nodes.filter(n => (n.command ?? '').startsWith('/validate'))
      expect(allValidates).toHaveLength(0)
    })

    it('completes without error when foreach has no /validate children', async () => {
      const store = buildForeachStore({validateCommands: []})

      await expect(runCommand({queryType: FOREACH_QUERY_TYPE, cell: store.getNode('fe'), store})).resolves.not.toThrow()
    })
  })

  describe('non-foreach parent cells — /validate children fire as normal post-processors', () => {
    it('/chat cell with a /validate child: the validate verdict is still written after execution', async () => {
      const store = new Store({
        userId: 'user1',
        nodes: {
          root: {id: 'root', parent: null, children: ['chat']},
          chat: {
            id: 'chat',
            parent: 'root',
            command: '/chat always passes',
            title: '/chat always passes',
            children: ['vc'],
          },
          vc: {
            id: 'vc',
            parent: 'chat',
            command: '/validate :retry=0 always passes',
            title: '/validate :retry=0 always passes',
            children: [],
          },
        },
      })
      store._integrationSettingsCache = {}

      await runCommand({queryType: CHAT_QUERY_TYPE, cell: store.getNode('chat'), store})

      expect(store.getNode('vc').title).toMatch(/\[(?:✓|✗)/)
    })
  })
})
