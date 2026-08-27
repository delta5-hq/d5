/**
 * /validate fires inside each fork during resolveElectCell execution.
 *
 * Covers three behavioral invariants for both canonical placements
 * (DESCENDANT: /validate child of /elect; SIBLING: /validate sibling of /elect):
 *   (1) ValidateCommand.run call count scales linearly with N forks.
 *   (2) Outer-store output reflects the per-placement verdict after real fork execution.
 *   (3) Both placements produce identical final state for the same input.
 */

jest.mock('debug', () => {
  const fn = jest.fn(() => fn)
  fn.extend = jest.fn(() => fn)
  return fn
})

jest.mock('../../commands/utils/langchain/getLLM', () => ({
  Model: {Claude: 'Claude', OpenAI: 'OpenAI'},
  getIntegrationSettings: jest.fn().mockResolvedValue({openai: {apiKey: 'test-key'}}),
  determineLLMType: jest.fn().mockReturnValue('openai'),
  getLLM: jest.fn(),
}))

jest.mock('../../commands/utils/NodeTextExtractor', () => ({
  NodeTextExtractor: jest.fn(),
}))

jest.mock('./ForkJudge', () => ({ForkJudge: jest.fn()}))

import {resolveElectCell} from './resolveElectCell'
import {ValidateCommand} from './ValidateCommand'
import {ChatCommand} from '../../commands/ChatCommand'
import {ForkJudge} from './ForkJudge'
import Store from '../../commands/utils/Store'
import {NodeTextExtractor} from '../../commands/utils/NodeTextExtractor'
import {getLLM} from '../../commands/utils/langchain/getLLM'

// ─── constants ────────────────────────────────────────────────────────────────

const CHAT_CONTENT = 'Market analysis: Competitor Alpha holds 40% revenue share.'
const PURE_VALIDATE = '/validate must mention revenue'
const DEFAULT_VALIDATE = '/validate must mention revenue'

// ─── verdict factories ────────────────────────────────────────────────────────

const winnerVerdictFor = forkIndex => ({
  winnerForkIndex: forkIndex,
  perCriterionVerdict: [],
  mode: 'strict',
  selectionLayer: 'primary',
  noSignal: false,
  judgeQualityWarnings: [],
})

const allFailVerdict = () => ({
  winnerForkIndex: null,
  perCriterionVerdict: [],
  mode: 'strict',
  selectionLayer: 'none',
  noSignal: false,
  judgeQualityWarnings: [],
})

// ─── judge setup helpers ──────────────────────────────────────────────────────

const setupPassJudge = () => {
  getLLM.mockReturnValue({
    llm: {invoke: jest.fn().mockResolvedValue({content: 'YES'})},
  })
  ForkJudge.mockImplementation(() => ({
    selectWinner: jest.fn().mockResolvedValue(winnerVerdictFor(0)),
  }))
}

const setupFailJudge = () => {
  getLLM.mockReturnValue({
    llm: {
      invoke: jest.fn().mockResolvedValue({content: 'NO: output does not mention revenue'}),
    },
  })
  ForkJudge.mockImplementation(() => ({
    selectWinner: jest.fn().mockResolvedValue(allFailVerdict()),
  }))
}

// ─── store builders ───────────────────────────────────────────────────────────

const buildDescendantStore = ({validateCommand = DEFAULT_VALIDATE, n = 2} = {}) =>
  new Store({
    userId: 'test',
    nodes: {
      root: {id: 'root', children: ['parent']},
      parent: {
        id: 'parent',
        parent: 'root',
        command: '/chat Analyze competitors',
        children: ['elect'],
      },
      elect: {
        id: 'elect',
        parent: 'parent',
        command: `/elect :n=${n}`,
        children: ['validate'],
      },
      validate: {
        id: 'validate',
        parent: 'elect',
        command: validateCommand,
        title: validateCommand,
        children: [],
      },
    },
  })

const buildSiblingStore = ({validateCommand = DEFAULT_VALIDATE, n = 2} = {}) =>
  new Store({
    userId: 'test',
    nodes: {
      root: {id: 'root', children: ['parent']},
      parent: {
        id: 'parent',
        parent: 'root',
        command: '/chat Analyze competitors',
        children: ['elect', 'validate'],
      },
      elect: {
        id: 'elect',
        parent: 'parent',
        command: `/elect :n=${n}`,
        children: [],
      },
      validate: {
        id: 'validate',
        parent: 'parent',
        command: validateCommand,
        title: validateCommand,
        children: [],
      },
    },
  })

const buildDescendantMultiCriterionStore = () =>
  new Store({
    userId: 'test',
    nodes: {
      root: {id: 'root', children: ['parent']},
      parent: {
        id: 'parent',
        parent: 'root',
        command: '/chat Analyze competitors',
        children: ['elect'],
      },
      elect: {
        id: 'elect',
        parent: 'parent',
        command: '/elect :n=2',
        children: ['v1', 'v2'],
      },
      v1: {
        id: 'v1',
        parent: 'elect',
        command: DEFAULT_VALIDATE,
        title: DEFAULT_VALIDATE,
        children: [],
      },
      v2: {
        id: 'v2',
        parent: 'elect',
        command: '/validate must mention market share',
        title: '/validate must mention market share',
        children: [],
      },
    },
  })

const buildNoValidateStore = () =>
  new Store({
    userId: 'test',
    nodes: {
      root: {id: 'root', children: ['parent']},
      parent: {
        id: 'parent',
        parent: 'root',
        command: '/chat Analyze competitors',
        children: ['elect'],
      },
      elect: {
        id: 'elect',
        parent: 'parent',
        command: '/elect :n=2',
        children: [],
      },
    },
  })

// ─── test suite ───────────────────────────────────────────────────────────────

describe('/validate executes inside each fork', () => {
  let validateSpy
  let chatSpy

  beforeEach(() => {
    jest.clearAllMocks()
    NodeTextExtractor.mockImplementation(() => ({
      extractFullContent: jest.fn().mockResolvedValue(CHAT_CONTENT),
    }))
    validateSpy = jest.spyOn(ValidateCommand.prototype, 'run')
    chatSpy = jest.spyOn(ChatCommand.prototype, 'run')
    chatSpy.mockImplementation(async function (node) {
      this.store.importer.createNodes(CHAT_CONTENT, node.id)
    })
  })

  afterEach(() => {
    validateSpy.mockRestore()
    chatSpy.mockRestore()
  })

  // ── (1) execution count ────────────────────────────────────────────────────

  describe('ValidateCommand.run call count scales linearly with N forks', () => {
    it('descendant N=2, pure validate → exactly 2 calls', async () => {
      setupFailJudge()
      const store = buildDescendantStore({
        validateCommand: PURE_VALIDATE,
      })
      await resolveElectCell(store.getNode('elect'), store, new Map())
      expect(validateSpy).toHaveBeenCalledTimes(2)
    })

    it('descendant N=3, pure validate → exactly 3 calls — linear not constant', async () => {
      setupFailJudge()
      const store = buildDescendantStore({
        validateCommand: PURE_VALIDATE,
        n: 3,
      })
      await resolveElectCell(store.getNode('elect'), store, new Map())
      expect(validateSpy).toHaveBeenCalledTimes(3)
    })

    it('sibling N=2, pure validate → exactly 2 calls', async () => {
      setupFailJudge()
      const store = buildSiblingStore({validateCommand: PURE_VALIDATE})
      await resolveElectCell(store.getNode('elect'), store, new Map())
      expect(validateSpy).toHaveBeenCalledTimes(2)
    })

    it('sibling N=3, pure validate → exactly 3 calls — linear not constant', async () => {
      setupFailJudge()
      const store = buildSiblingStore({
        validateCommand: PURE_VALIDATE,
        n: 3,
      })
      await resolveElectCell(store.getNode('elect'), store, new Map())
      expect(validateSpy).toHaveBeenCalledTimes(3)
    })

    it('two criteria descendant N=2 → exactly 4 calls (N × criteria count)', async () => {
      setupPassJudge()
      const store = buildDescendantMultiCriterionStore()
      await resolveElectCell(store.getNode('elect'), store, new Map())
      expect(validateSpy).toHaveBeenCalledTimes(4)
    })

    it('no validate children N=2 → 0 calls', async () => {
      setupPassJudge()
      const store = buildNoValidateStore()
      await resolveElectCell(store.getNode('elect'), store, new Map())
      expect(validateSpy).toHaveBeenCalledTimes(0)
    })
  })

  // ── (2) outer-store output state ───────────────────────────────────────────

  describe('outer store carries per-placement verdict after fork execution', () => {
    it('descendant all-pass: validate node carries [✓] suffix', async () => {
      setupPassJudge()
      const store = buildDescendantStore()
      await resolveElectCell(store.getNode('elect'), store, new Map())
      const validateOut = store.getOutput().nodes.find(n => n.id === 'validate')
      expect(validateOut?.title).toMatch(/\[✓/)
    })

    it('descendant all-fail: validate carries [✗] and elect carries [✗ 0/2]', async () => {
      setupFailJudge()
      const store = buildDescendantStore({
        validateCommand: PURE_VALIDATE,
      })
      await resolveElectCell(store.getNode('elect'), store, new Map())
      const out = store.getOutput().nodes
      expect(out.find(n => n.id === 'validate')?.title).toMatch(/\[✗\]/)
      expect(out.find(n => n.id === 'elect')?.title).toMatch(/\[✗ 0\/2\]/)
    })

    it('sibling all-pass: sibling validate node carries [✓] suffix', async () => {
      setupPassJudge()
      const store = buildSiblingStore()
      await resolveElectCell(store.getNode('elect'), store, new Map())
      const validateOut = store.getOutput().nodes.find(n => n.id === 'validate')
      expect(validateOut?.title).toMatch(/\[✓/)
    })

    it('sibling all-fail: sibling validate carries [✗] and elect carries [✗ 0/2]', async () => {
      setupFailJudge()
      const store = buildSiblingStore({validateCommand: PURE_VALIDATE})
      await resolveElectCell(store.getNode('elect'), store, new Map())
      const out = store.getOutput().nodes
      expect(out.find(n => n.id === 'validate')?.title).toMatch(/\[✗\]/)
      expect(out.find(n => n.id === 'elect')?.title).toMatch(/\[✗ 0\/2\]/)
    })
  })

  // ── (3) placement equivalence ──────────────────────────────────────────────

  describe('both placements produce identical final state', () => {
    it('descendant and sibling both carry [✓] after all-pass', async () => {
      setupPassJudge()
      const descendantStore = buildDescendantStore()
      await resolveElectCell(descendantStore.getNode('elect'), descendantStore, new Map())
      const siblingStore = buildSiblingStore()
      await resolveElectCell(siblingStore.getNode('elect'), siblingStore, new Map())
      expect(descendantStore.getOutput().nodes.find(n => n.id === 'validate')?.title).toMatch(/\[✓/)
      expect(siblingStore.getOutput().nodes.find(n => n.id === 'validate')?.title).toMatch(/\[✓/)
    })

    it('descendant and sibling both carry [✗] after all-fail', async () => {
      setupFailJudge()
      const descendantStore = buildDescendantStore({
        validateCommand: PURE_VALIDATE,
      })
      await resolveElectCell(descendantStore.getNode('elect'), descendantStore, new Map())
      const siblingStore = buildSiblingStore({
        validateCommand: PURE_VALIDATE,
      })
      await resolveElectCell(siblingStore.getNode('elect'), siblingStore, new Map())
      expect(descendantStore.getOutput().nodes.find(n => n.id === 'validate')?.title).toMatch(/\[✗\]/)
      expect(siblingStore.getOutput().nodes.find(n => n.id === 'validate')?.title).toMatch(/\[✗\]/)
    })
  })

  // ── (4) grandchild /validate topology (P0.39 fix) ────────────────────────────
  // /validate is a grandchild of /elect: child of a /chat that is itself a
  // child of /elect. The inner /chat must execute inside each fork so the
  // /validate has content to check. Before the P0.39 fix, the inner /chat was
  // never executed (postProcessNode silently skipped non-post-processor children
  // of /elect), producing bare subtrees and false-passing judges.

  describe('/validate as grandchild of /elect (inner /chat executes inside forks)', () => {
    const buildGrandchildStore = ({validateCommand = DEFAULT_VALIDATE, n = 2} = {}) =>
      new Store({
        userId: 'test',
        nodes: {
          root: {id: 'root', children: ['parent']},
          parent: {
            id: 'parent',
            parent: 'root',
            command: '/chat Start elect',
            children: ['elect'],
          },
          elect: {
            id: 'elect',
            parent: 'parent',
            command: `/elect :n=${n}`,
            children: ['innerChat'],
          },
          innerChat: {
            id: 'innerChat',
            parent: 'elect',
            command: '/chat Reply with: HELLO',
            children: ['validate'],
          },
          validate: {
            id: 'validate',
            parent: 'innerChat',
            command: validateCommand,
            title: validateCommand,
            children: [],
          },
        },
      })

    it('ValidateCommand.run called N times (once per fork) — not zero', async () => {
      setupFailJudge()
      const store = buildGrandchildStore({
        validateCommand: PURE_VALIDATE,
      })
      await resolveElectCell(store.getNode('elect'), store, new Map())
      expect(validateSpy).toHaveBeenCalledTimes(2)
    })

    it('N=3 scales linearly — 3 calls not 0', async () => {
      setupFailJudge()
      const store = buildGrandchildStore({
        validateCommand: PURE_VALIDATE,
        n: 3,
      })
      await resolveElectCell(store.getNode('elect'), store, new Map())
      expect(validateSpy).toHaveBeenCalledTimes(3)
    })

    it('ChatCommand.run called for innerChat in each fork', async () => {
      setupFailJudge()
      const store = buildGrandchildStore({
        validateCommand: PURE_VALIDATE,
      })
      await resolveElectCell(store.getNode('elect'), store, new Map())
      // chatSpy captures BOTH parent /chat and inner /chat runs; inner chat must fire
      const callNodeIds = chatSpy.mock.calls.map(args => args[0]?.id)
      expect(callNodeIds).toContain('innerChat')
    })

    it('outer store validate title shows [✗] after all-fail (strict)', async () => {
      setupFailJudge()
      const store = buildGrandchildStore({
        validateCommand: PURE_VALIDATE,
      })
      await resolveElectCell(store.getNode('elect'), store, new Map())
      expect(store.getOutput().nodes.find(n => n.id === 'validate')?.title).toMatch(/\[✗\]/)
    })

    it('outer store validate title shows [✓] after all-pass (strict, winner selected)', async () => {
      setupPassJudge()
      const store = buildGrandchildStore()
      await resolveElectCell(store.getNode('elect'), store, new Map())
      const validateOut = store.getOutput().nodes.find(n => n.id === 'validate')
      expect(validateOut?.title).toMatch(/\[✓/)
    })
  })
})
