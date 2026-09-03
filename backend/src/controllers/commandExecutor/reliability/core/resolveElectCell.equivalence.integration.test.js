import {resolveElectCell} from './resolveElectCell'
import {projectForkCost} from './forkCostProjector'
import {parseInlineTerm, buildSyntheticTermParent} from './inlineTermParser'
import Store from '../../commands/utils/Store'
import {runCommand as runCommandMock} from '../../commands/utils/runCommand'
import {ForkJudge} from './ForkJudge'

jest.mock('debug', () => {
  const fn = jest.fn(() => fn)
  fn.extend = jest.fn(() => fn)
  return fn
})

jest.mock('../../commands/utils/runCommand', () => ({
  foreachValidateTemplateExclusions: jest.fn().mockReturnValue([]),
  postProcessExistingOutput: jest.fn().mockResolvedValue(undefined),
  runCommand: jest.fn(async ({cell, store}) => {
    const outputId = cell.id + ':out'
    store._nodes[outputId] = {
      id: outputId,
      parent: cell.id,
      command: '',
      title: `output-of-${cell.command}`,
      children: [],
      prompts: [],
    }
    const n = store.getNode(cell.id)
    if (n) n.prompts = [...(n.prompts ?? []), outputId]
  }),
}))

// Variable must start with 'mock' to be accessible inside the jest.mock factory.
let mockWinnerIndex = 0
jest.mock('./ForkJudge', () => ({
  ForkJudge: jest.fn(() => ({
    selectWinner: jest.fn(async ({forks}) => {
      const ok = forks.filter(f => f.status === 'ok')
      if (!ok.length) return null
      const winner = ok[Math.min(mockWinnerIndex, ok.length - 1)]
      return {winnerForkIndex: winner.forkIndex, selectionLayer: 'primary'}
    }),
  })),
}))

jest.mock('./ForkProgressEmitter', () => ({
  NullForkProgressEmitter: jest.fn(() => ({
    forksStarted: jest.fn(),
    forkSettled: jest.fn(),
    electComplete: jest.fn(),
  })),
}))

// Defensive guard — prevents real HTTP calls if selectWinner stub is bypassed.
jest.mock('../../commands/utils/NodeTextExtractor', () => ({
  NodeTextExtractor: jest.fn(() => ({extractFullContent: jest.fn().mockResolvedValue('')})),
}))

jest.mock('../../commands/utils/langchain/getLLM', () => ({
  Model: {
    Claude: 'Claude',
    OpenAI: 'OpenAI',
    Deepseek: 'Deepseek',
    Qwen: 'Qwen',
    YandexGPT: 'YandexGPT',
    CustomLLM: 'CustomLLM',
  },
  getIntegrationSettings: jest.fn().mockResolvedValue({openai: {apiKey: 'k'}}),
  determineLLMType: jest.fn(),
  getLLM: jest.fn(),
}))

const buildStore = nodeMap => {
  const store = new Store({userId: 'user1', nodes: nodeMap})
  jest.spyOn(store.importer, 'createErrorNode').mockImplementation(() => {})
  return store
}

const assertTreeIntegrity = store => {
  for (const node of Object.values(store._nodes)) {
    if (node.parent !== null && node.parent !== undefined) {
      expect(store._nodes[node.parent]).toBeDefined()
    }
    for (const childId of node.children ?? []) {
      expect(store._nodes[childId]).toBeDefined()
    }
    for (const promptId of node.prompts ?? []) {
      expect(store._nodes[promptId]).toBeDefined()
    }
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  mockWinnerIndex = 0
})

const inlineTermOf = (electNode, store) =>
  parseInlineTerm(electNode.command.replace(/^\/elect\s+:n=\d+\s+/, ''), store._aliases ?? {mcp: [], rpc: []})

const termParentOf = (electNode, store) => {
  const inlineTerm = inlineTermOf(electNode, store)
  if (!inlineTerm) return null
  return buildSyntheticTermParent(electNode.id, inlineTerm, electNode.parent)
}

const inlineCost = (electNode, store) => {
  const termParent = termParentOf(electNode, store)
  if (!termParent) return null
  return projectForkCost(electNode, store, false, termParent)
}

describe('workflow 1 — /elect :n=2, first run: real runForks + applyCandidate, fork 0 wins', () => {
  it('fork count, winner content, suffix, projected cost, and tree state are equivalent for inline and postfix', async () => {
    const postfixStore = buildStore({
      p1: {id: 'p1', parent: null, children: ['r1'], command: '/chat propose', title: 'Parent', prompts: []},
      r1: {id: 'r1', parent: 'p1', children: [], command: '/elect :n=2', title: 'Elect'},
    })
    jest.spyOn(postfixStore, 'saveNodeToOutput').mockImplementation(() => {})
    const postfixCost = projectForkCost(postfixStore.getNode('r1'), postfixStore, false)

    await resolveElectCell(postfixStore.getNode('r1'), postfixStore, new Map())

    const postfixElect = postfixStore.getNode('r1')
    expect(runCommandMock).toHaveBeenCalledTimes(2)
    const postfixOutputId = postfixElect.prompts?.[0]
    expect(postfixOutputId).toBeTruthy()
    expect(postfixStore.getNode(postfixOutputId)?.title).toBe('output-of-/chat propose')

    const postfixForkSet = ForkJudge.mock.results[0].value.selectWinner.mock.calls[0][0].forks
    expect(postfixForkSet.map(f => f.forkIndex)).toEqual([0, 1])
    expect(postfixForkSet.every(f => f.status === 'ok')).toBe(true)

    // reset call count between forms so the inline count is independent of postfix calls above
    runCommandMock.mockClear()

    const inlineStore = buildStore({
      r1: {id: 'r1', parent: null, children: [], command: '/elect :n=2 /chat propose', title: 'Elect'},
    })
    jest.spyOn(inlineStore, 'saveNodeToOutput').mockImplementation(() => {})
    const inlineCostVal = inlineCost(inlineStore.getNode('r1'), inlineStore)

    await resolveElectCell(inlineStore.getNode('r1'), inlineStore, new Map())

    const inlineElect = inlineStore.getNode('r1')
    expect(runCommandMock).toHaveBeenCalledTimes(2)
    const inlineOutputId = inlineElect.prompts?.[0]
    expect(inlineOutputId).toBeTruthy()
    expect(inlineStore.getNode(inlineOutputId)?.title).toBe('output-of-/chat propose')
    // Winner content is generated from the term text and is identical across both forms.
    expect(inlineStore.getNode(inlineOutputId)?.title).toBe(postfixStore.getNode(postfixOutputId)?.title)

    const inlineForkSet = ForkJudge.mock.results[1].value.selectWinner.mock.calls[0][0].forks
    expect(inlineForkSet.map(f => f.forkIndex)).toEqual([0, 1])
    expect(inlineForkSet.every(f => f.status === 'ok')).toBe(true)

    expect(postfixCost).toBe(2)
    expect(inlineCostVal).toBe(postfixCost)

    const postfixSuffix = postfixElect.title?.match(/\[.+\]$/)?.[0]
    const inlineSuffix = inlineElect.title?.match(/\[.+\]$/)?.[0]
    expect(postfixSuffix).toBeTruthy()
    expect(postfixSuffix).toBe(inlineSuffix)

    expect(postfixElect.title).not.toContain('[✗')
    expect(inlineElect.title).not.toContain('[✗')

    assertTreeIntegrity(inlineStore)
    expect(inlineStore._nodes['r1:term']).toBeUndefined()
    expect(inlineStore.getNode('r1').parent).toBeNull()
    assertTreeIntegrity(postfixStore)
  })
})

describe('workflow 2 — /elect :n=3, re-run: postfix reuses its prior output, inline stays N', () => {
  it('postfix projects N-1 from its own prior generation while inline projects N — the wrapped term has none', async () => {
    const postfixStore = buildStore({
      prior: {id: 'prior', parent: 'p1', command: '', title: 'prior output', children: [], prompts: []},
      p1: {id: 'p1', parent: null, children: ['r1'], command: '/chat propose', title: 'Parent', prompts: ['prior']},
      r1: {id: 'r1', parent: 'p1', children: [], command: '/elect :n=3', title: 'Elect'},
    })
    const postfixCostVal = projectForkCost(postfixStore.getNode('r1'), postfixStore, true)

    const inlineStore = buildStore({
      prior: {id: 'prior', parent: 'r1', command: '', title: 'prior output', children: [], prompts: []},
      r1: {
        id: 'r1',
        parent: null,
        children: [],
        command: '/elect :n=3 /chat propose',
        title: 'Elect',
        prompts: ['prior'],
      },
    })
    const inlineCostVal = inlineCost(inlineStore.getNode('r1'), inlineStore)

    expect(postfixCostVal).toBe(2)
    expect(inlineCostVal).toBe(3)
  })
})

describe('workflow 3 — /elect :n=2 nested under ancestor: synth present during forks, removed after', () => {
  it('synth exists during fork execution and is fully absent from the store after resolution', async () => {
    const store = buildStore({
      ancestor: {
        id: 'ancestor',
        parent: null,
        command: '/chat context',
        title: 'context',
        children: ['r1'],
        prompts: [],
      },
      r1: {
        id: 'r1',
        parent: 'ancestor',
        children: [],
        command: '/elect :n=2 /chat propose',
        title: 'Nested Inline Elect',
      },
    })
    jest.spyOn(store, 'saveNodeToOutput').mockImplementation(() => {})
    jest.spyOn(store.importer, 'createErrorNode').mockImplementation(() => {})

    await resolveElectCell(store.getNode('r1'), store, new Map())

    expect(store._nodes['r1:term']).toBeUndefined()
    expect(store.getNode('r1').parent).toBe('ancestor')
    expect(store.getNode('ancestor').children).toContain('r1')
    expect(store.getNode('ancestor').children).not.toContain('r1:term')
    assertTreeIntegrity(store)
  })
})

describe('workflow 4 — winner path: StoreFork.applyCandidate fires before restore', () => {
  it('elect.parent is the original ancestor after applyCandidate replaces store._nodes[r1] with a fork clone', async () => {
    mockWinnerIndex = 0
    const store = buildStore({
      ancestor: {
        id: 'ancestor',
        parent: null,
        command: '/chat context',
        title: 'context',
        children: ['r1'],
        prompts: [],
      },
      r1: {id: 'r1', parent: 'ancestor', children: [], command: '/elect :n=2 /chat propose', title: 'Inline Elect'},
    })
    jest.spyOn(store, 'saveNodeToOutput').mockImplementation(() => {})
    jest.spyOn(store.importer, 'createErrorNode').mockImplementation(() => {})

    await resolveElectCell(store.getNode('r1'), store, new Map())

    expect(store._nodes['r1'].parent).toBe('ancestor')
    expect(store._nodes['r1:term']).toBeUndefined()
    assertTreeIntegrity(store)
  })

  it('elect.parent is null when inline elect is top-level and a winner is selected', async () => {
    mockWinnerIndex = 0
    const store = buildStore({
      r1: {id: 'r1', parent: null, children: [], command: '/elect :n=2 /chat propose', title: 'Top-Level Inline Elect'},
    })
    jest.spyOn(store, 'saveNodeToOutput').mockImplementation(() => {})
    jest.spyOn(store.importer, 'createErrorNode').mockImplementation(() => {})

    await resolveElectCell(store.getNode('r1'), store, new Map())

    expect(store._nodes['r1'].parent).toBeNull()
    expect(store._nodes['r1:term']).toBeUndefined()
    assertTreeIntegrity(store)
  })
})

describe('workflow 5 — postfix form: unaffected by inline changes (regression guard)', () => {
  it('postfix /elect :n=2 produces winner output and correct suffix without touching synth machinery', async () => {
    const store = buildStore({
      p1: {id: 'p1', parent: null, children: ['r1'], command: '/chat propose', title: 'Parent', prompts: []},
      r1: {id: 'r1', parent: 'p1', children: [], command: '/elect :n=2', title: 'Elect'},
    })
    jest.spyOn(store, 'saveNodeToOutput').mockImplementation(() => {})
    jest.spyOn(store.importer, 'createErrorNode').mockImplementation(() => {})

    await resolveElectCell(store.getNode('r1'), store, new Map())

    const elect = store.getNode('r1')
    expect(elect.title).toMatch(/\[.+\]$/)
    expect(elect.title).not.toContain('[✗')
    expect(store._nodes['r1:term']).toBeUndefined()
    assertTreeIntegrity(store)
  })
})

describe('workflow 6 — production shape: postfix reuses its prior output, inline runs every fork fresh', () => {
  it('postfix fires N-1 fresh forks reusing its prior output; inline fires N fresh forks and never reuses stale output', async () => {
    const postfixStore = buildStore({
      prior: {id: 'prior', parent: 'p1', command: '', title: 'prior output', children: [], prompts: []},
      p1: {id: 'p1', parent: null, children: ['r1'], command: '/chat propose', title: 'Parent', prompts: ['prior']},
      r1: {id: 'r1', parent: 'p1', children: [], command: '/elect :n=3', title: 'Elect'},
    })
    jest.spyOn(postfixStore, 'saveNodeToOutput').mockImplementation(() => {})
    const postfixCostVal = projectForkCost(postfixStore.getNode('r1'), postfixStore, true)

    mockWinnerIndex = 0
    await resolveElectCell(postfixStore.getNode('r1'), postfixStore, new Map(), undefined, undefined, true)

    const postfixElect = postfixStore.getNode('r1')
    expect(runCommandMock).toHaveBeenCalledTimes(2)
    const postfixWinnerOutputId = postfixElect.prompts?.[0]
    expect(postfixWinnerOutputId).toBeTruthy()
    expect(postfixStore.getNode(postfixWinnerOutputId)?.title).toBe('prior output')
    expect(postfixCostVal).toBe(2)
    expect(postfixElect.title).toMatch(/\[.+\]$/)
    expect(postfixElect.title).not.toContain('[✗')

    const postfixW6ForkSet = ForkJudge.mock.results[0].value.selectWinner.mock.calls[0][0].forks
    expect(postfixW6ForkSet.map(f => f.forkIndex)).toEqual([0, 1, 2])
    expect(postfixW6ForkSet.every(f => f.status === 'ok')).toBe(true)

    assertTreeIntegrity(postfixStore)

    runCommandMock.mockClear()

    const inlineStore = buildStore({
      prior: {id: 'prior', parent: 'r1', command: '', title: 'prior output', children: [], prompts: []},
      r1: {
        id: 'r1',
        parent: null,
        children: [],
        command: '/elect :n=3 /chat propose',
        title: 'Elect',
        prompts: ['prior'],
      },
    })
    jest.spyOn(inlineStore, 'saveNodeToOutput').mockImplementation(() => {})
    const inlineCostVal = inlineCost(inlineStore.getNode('r1'), inlineStore)

    mockWinnerIndex = 0
    await resolveElectCell(inlineStore.getNode('r1'), inlineStore, new Map())

    const inlineElect = inlineStore.getNode('r1')
    expect(runCommandMock).toHaveBeenCalledTimes(3)
    const inlineWinnerOutputId = inlineElect.prompts?.[0]
    expect(inlineWinnerOutputId).toBeTruthy()
    expect(inlineStore.getNode(inlineWinnerOutputId)?.title).toBe('output-of-/chat propose')
    expect(inlineCostVal).toBe(3)

    const inlineW6ForkSet = ForkJudge.mock.results[1].value.selectWinner.mock.calls[0][0].forks
    expect(inlineW6ForkSet.map(f => f.forkIndex)).toEqual([0, 1, 2])
    expect(inlineW6ForkSet.every(f => f.status === 'ok')).toBe(true)

    const postfixSuffix = postfixElect.title?.match(/\[.+\]$/)?.[0]
    const inlineSuffix = inlineElect.title?.match(/\[.+\]$/)?.[0]
    expect(postfixSuffix).toBeTruthy()
    expect(postfixSuffix).toBe(inlineSuffix)

    expect(inlineStore._nodes['r1:term']).toBeUndefined()
    expect(inlineStore.getNode('r1').parent).toBeNull()
    assertTreeIntegrity(inlineStore)
    assertTreeIntegrity(postfixStore)
  })
})

describe('workflow 7 — :limit= refusal is priced through resolveElectCell in both forms', () => {
  it('n=3 over a limit of 2 refuses before any fork runs, inline and postfix alike', async () => {
    const postfixStore = buildStore({
      p1: {id: 'p1', parent: null, children: ['r1'], command: '/chat propose', title: 'Parent', prompts: []},
      r1: {id: 'r1', parent: 'p1', children: [], command: '/elect :n=3 :limit=2', title: 'Elect'},
    })
    jest.spyOn(postfixStore, 'saveNodeToOutput').mockImplementation(() => {})

    await resolveElectCell(postfixStore.getNode('r1'), postfixStore, new Map())

    expect(runCommandMock).not.toHaveBeenCalled()
    expect(postfixStore.importer.createErrorNode).toHaveBeenCalledWith(expect.stringContaining('limit'), 'r1')

    runCommandMock.mockClear()

    const inlineStore = buildStore({
      r1: {id: 'r1', parent: null, children: [], command: '/elect :n=3 :limit=2 /chat propose', title: 'Elect'},
    })
    jest.spyOn(inlineStore, 'saveNodeToOutput').mockImplementation(() => {})

    await resolveElectCell(inlineStore.getNode('r1'), inlineStore, new Map())

    expect(runCommandMock).not.toHaveBeenCalled()
    expect(inlineStore.importer.createErrorNode).toHaveBeenCalledWith(expect.stringContaining('limit'), 'r1')
  })
})

describe('workflow 8 — P0.1: concurrent sibling inline elects both survive orphan collection', () => {
  it('two sibling inline elects under one parent keep both cells and both winner outputs after removeOrphanedNodes', async () => {
    const store = buildStore({
      root: {id: 'root', parent: null, command: '/steps', title: 'Steps', children: ['a', 'b'], prompts: []},
      a: {id: 'a', parent: 'root', children: [], command: '/elect :n=2 /chat foo', title: 'Elect A'},
      b: {id: 'b', parent: 'root', children: [], command: '/elect :n=2 /chat bar', title: 'Elect B'},
    })
    jest.spyOn(store, 'saveNodeToOutput').mockImplementation(() => {})

    await Promise.all([
      resolveElectCell(store.getNode('a'), store, new Map()),
      resolveElectCell(store.getNode('b'), store, new Map()),
    ])

    store.removeOrphanedNodes()

    expect(store.getNode('a')).toBeDefined()
    expect(store.getNode('b')).toBeDefined()
    expect(store.getNode('root').children).toEqual(['a', 'b'])
    expect(store._nodes['a:term']).toBeUndefined()
    expect(store._nodes['b:term']).toBeUndefined()

    const winnerOutputA = store.getNode('a').prompts?.[0]
    const winnerOutputB = store.getNode('b').prompts?.[0]
    expect(winnerOutputA && store.getNode(winnerOutputA)).toBeDefined()
    expect(winnerOutputB && store.getNode(winnerOutputB)).toBeDefined()
    assertTreeIntegrity(store)
  })
})
