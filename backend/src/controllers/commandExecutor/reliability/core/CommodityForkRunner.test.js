import {runCommodityForks, isCommodityForkInProgress, markCommodityForkInProgress} from './CommodityForkRunner'
import Store from '../../commands/utils/Store'
import {CHAT_QUERY_TYPE} from '../../constants/chat'

jest.mock('debug', () => {
  const fn = jest.fn(() => fn)
  fn.extend = jest.fn(() => fn)
  return fn
})

jest.mock('../../commands/utils/runCommand', () => ({
  runCommand: jest.fn(),
}))

const {runCommand: mockRunCommand} = require('../../commands/utils/runCommand')

const buildStore = nodeMap => new Store({userId: 'u1', nodes: nodeMap})

const cellOnlyStore = () =>
  buildStore({
    cell: {id: 'cell', parent: null, children: [], command: '/chat :n=2 hello'},
  })

const cellWithChildStore = existingChildId =>
  buildStore({
    cell: {id: 'cell', parent: null, children: [existingChildId], command: '/chat :n=2 hello'},
    [existingChildId]: {id: existingChildId, parent: 'cell', children: []},
  })

const defaultParams = (store, overrides = {}) => ({
  cell: store.getNode('cell'),
  store,
  n: 2,
  queryType: CHAT_QUERY_TYPE,
  signal: null,
  context: '',
  prompt: '',
  memoMap: (() => {
    const m = new Map()
    markCommodityForkInProgress('cell', m)
    return m
  })(),
  ...overrides,
})

beforeEach(() => {
  mockRunCommand.mockReset()
  mockRunCommand.mockResolvedValue(undefined)
})

describe('isCommodityForkInProgress / markCommodityForkInProgress', () => {
  describe('initial state — returns false', () => {
    it('returns false for null memoMap', () => {
      expect(isCommodityForkInProgress('cell', null)).toBe(false)
    })

    it('returns false when key absent from non-null map', () => {
      expect(isCommodityForkInProgress('cell', new Map())).toBe(false)
    })
  })

  it('returns true after markCommodityForkInProgress', () => {
    const memoMap = new Map()
    markCommodityForkInProgress('cell', memoMap)
    expect(isCommodityForkInProgress('cell', memoMap)).toBe(true)
  })

  it('keys are per-cell — marking one cell does not affect another', () => {
    const memoMap = new Map()
    markCommodityForkInProgress('cell-a', memoMap)
    expect(isCommodityForkInProgress('cell-b', memoMap)).toBe(false)
  })

  it('multiple distinct cells can be marked independently', () => {
    const memoMap = new Map()
    markCommodityForkInProgress('cell-a', memoMap)
    markCommodityForkInProgress('cell-b', memoMap)
    expect(isCommodityForkInProgress('cell-a', memoMap)).toBe(true)
    expect(isCommodityForkInProgress('cell-b', memoMap)).toBe(true)
  })
})

describe('runCommodityForks — fork count', () => {
  it.each([
    [1, 0],
    [2, 1],
    [3, 2],
    [4, 3],
    [5, 4],
  ])('n=%i produces %i runCommand calls (N-1 additional forks)', async (n, expectedCalls) => {
    const store = cellOnlyStore()
    const params = defaultParams(store, {n})

    await runCommodityForks(params)

    expect(mockRunCommand).toHaveBeenCalledTimes(expectedCalls)
  })
})

describe('runCommodityForks — fork call parameters', () => {
  it('passes preventPostProcess: true to every fork', async () => {
    const store = cellOnlyStore()

    await runCommodityForks(defaultParams(store, {n: 3}))

    mockRunCommand.mock.calls.forEach(([params]) => {
      expect(params.preventPostProcess).toBe(true)
    })
  })

  it('forwards context and prompt unchanged to every fork', async () => {
    const store = cellOnlyStore()

    await runCommodityForks(defaultParams(store, {n: 3, context: 'my-context', prompt: 'my-prompt'}))

    mockRunCommand.mock.calls.forEach(([params]) => {
      expect(params.context).toBe('my-context')
      expect(params.prompt).toBe('my-prompt')
    })
  })

  it('forwards queryType unchanged to every fork', async () => {
    const store = cellOnlyStore()

    await runCommodityForks(defaultParams(store, {n: 2, queryType: CHAT_QUERY_TYPE}))

    const [params] = mockRunCommand.mock.calls[0]
    expect(params.queryType).toBe(CHAT_QUERY_TYPE)
  })

  it('propagates abort signal to every fork', async () => {
    const store = cellOnlyStore()
    const signal = new AbortController().signal

    await runCommodityForks(defaultParams(store, {n: 3, signal}))

    mockRunCommand.mock.calls.forEach(([params]) => {
      expect(params.signal).toBe(signal)
    })
  })

  it('passes a copy of memoMap (not the original reference) to each fork', async () => {
    const store = cellOnlyStore()
    const memoMap = new Map()
    markCommodityForkInProgress('cell', memoMap)
    const receivedMemoMaps = []

    mockRunCommand.mockImplementation(async ({memoMap: m}) => {
      receivedMemoMaps.push(m)
    })

    await runCommodityForks(defaultParams(store, {n: 3, memoMap}))

    expect(receivedMemoMaps).toHaveLength(2)
    receivedMemoMaps.forEach(m => expect(m).not.toBe(memoMap))
    expect(receivedMemoMaps[0]).not.toBe(receivedMemoMaps[1])
  })

  it('memoMap copy passed to fork already contains the commodity key', async () => {
    const store = cellOnlyStore()
    const memoMap = new Map()
    markCommodityForkInProgress('cell', memoMap)

    await runCommodityForks(defaultParams(store, {n: 2, memoMap}))

    const [params] = mockRunCommand.mock.calls[0]
    expect(isCommodityForkInProgress('cell', params.memoMap)).toBe(true)
  })
})

describe('runCommodityForks — fork independence', () => {
  it('each fork receives an independent store (not the same reference)', async () => {
    const store = cellOnlyStore()
    const receivedStores = []

    mockRunCommand.mockImplementation(async ({store: forkStore}) => {
      receivedStores.push(forkStore)
    })

    await runCommodityForks(defaultParams(store, {n: 3}))

    expect(receivedStores[0]).not.toBe(receivedStores[1])
    expect(receivedStores[0]).not.toBe(store)
    expect(receivedStores[1]).not.toBe(store)
  })

  it('forks start with the same node data as the source store', async () => {
    const store = cellOnlyStore()
    const receivedStores = []

    mockRunCommand.mockImplementation(async ({store: forkStore}) => {
      receivedStores.push(forkStore)
    })

    await runCommodityForks(defaultParams(store, {n: 2}))

    for (const forkStore of receivedStores) {
      expect(forkStore.getNode('cell')).toBeDefined()
    }
  })

  it('source store is unchanged after forks mutate their own stores', async () => {
    const store = cellOnlyStore()

    mockRunCommand.mockImplementation(async ({store: forkStore}) => {
      forkStore._nodes.cell.title = 'mutated in fork'
    })

    await runCommodityForks(defaultParams(store, {n: 3}))

    expect(store._nodes.cell.title).toBeUndefined()
  })

  it('mutations in one fork do not affect sibling forks', async () => {
    const store = cellOnlyStore()
    const receivedStores = []
    let callCount = 0

    mockRunCommand.mockImplementation(async ({store: forkStore}) => {
      const index = callCount++
      receivedStores[index] = forkStore
      if (index === 0) {
        forkStore._nodes.cell.title = 'mutated in fork 0'
      }
    })

    await runCommodityForks(defaultParams(store, {n: 3}))

    expect(receivedStores[0]._nodes.cell.title).toBe('mutated in fork 0')
    expect(receivedStores[1]._nodes.cell.title).toBeUndefined()
  })

  it('mutations to fork memoMap do not propagate to outer memoMap', async () => {
    const store = cellOnlyStore()
    const memoMap = new Map()
    markCommodityForkInProgress('cell', memoMap)
    let callCount = 0

    mockRunCommand.mockImplementation(async ({memoMap: m}) => {
      callCount++
      m.set(`fork-${callCount}-key`, 'fork-local')
    })

    await runCommodityForks(defaultParams(store, {n: 3, memoMap}))

    expect(memoMap.has('fork-1-key')).toBe(false)
    expect(memoMap.has('fork-2-key')).toBe(false)
  })
})

describe('runCommodityForks — child merging', () => {
  it('new children produced by a fork are merged into the main store', async () => {
    const store = cellOnlyStore()

    mockRunCommand.mockImplementation(async ({store: forkStore, cell: forkCell}) => {
      forkStore._nodes['new-child'] = {id: 'new-child', parent: forkCell.id, children: []}
      forkStore.getNode(forkCell.id).children.push('new-child')
    })

    await runCommodityForks(defaultParams(store))

    expect(store.getNode('new-child')).toBeDefined()
    expect(store.getNode('cell').children).toContain('new-child')
  })

  it('pre-existing children are not duplicated when a fork re-includes them', async () => {
    const store = cellWithChildStore('existing')

    mockRunCommand.mockImplementation(async ({store: forkStore, cell: forkCell}) => {
      forkStore._nodes['fork-child'] = {id: 'fork-child', parent: forkCell.id, children: []}
      forkStore.getNode(forkCell.id).children.push('fork-child')
    })

    await runCommodityForks(defaultParams(store))

    const children = store.getNode('cell').children
    expect(children.filter(id => id === 'existing')).toHaveLength(1)
    expect(children).toContain('fork-child')
  })

  it('each fork contributes its own unique child — no cross-contamination', async () => {
    const store = cellOnlyStore()
    let callIndex = 0

    mockRunCommand.mockImplementation(async ({store: forkStore, cell: forkCell}) => {
      const childId = `fork-child-${callIndex++}`
      forkStore._nodes[childId] = {id: childId, parent: forkCell.id, children: []}
      forkStore.getNode(forkCell.id).children.push(childId)
    })

    await runCommodityForks(defaultParams(store, {n: 3}))

    const children = store.getNode('cell').children
    expect(children).toContain('fork-child-0')
    expect(children).toContain('fork-child-1')
    expect(children).toHaveLength(2)
  })

  it('merged child with its own sub-children is fully transferred to main store', async () => {
    const store = cellOnlyStore()

    mockRunCommand.mockImplementation(async ({store: forkStore, cell: forkCell}) => {
      forkStore._nodes['child'] = {id: 'child', parent: forkCell.id, children: ['grandchild']}
      forkStore._nodes['grandchild'] = {id: 'grandchild', parent: 'child', children: []}
      forkStore.getNode(forkCell.id).children.push('child')
    })

    await runCommodityForks(defaultParams(store))

    expect(store.getNode('child')).toBeDefined()
    expect(store.getNode('grandchild')).toBeDefined()
  })

  it('children from multiple forks are all accumulated in the main store', async () => {
    const store = cellOnlyStore()
    let callIndex = 0

    mockRunCommand.mockImplementation(async ({store: forkStore, cell: forkCell}) => {
      const childId = `child-${callIndex++}`
      forkStore._nodes[childId] = {id: childId, parent: forkCell.id, children: []}
      forkStore.getNode(forkCell.id).children.push(childId)
    })

    await runCommodityForks(defaultParams(store, {n: 4}))

    const children = store.getNode('cell').children
    expect(children).toContain('child-0')
    expect(children).toContain('child-1')
    expect(children).toContain('child-2')
    expect(children).toHaveLength(3)
  })
})

describe('runCommodityForks — fault tolerance', () => {
  it('resolves without throwing even when all forks fail', async () => {
    const store = cellOnlyStore()
    mockRunCommand.mockRejectedValue(new Error('all fail'))

    await expect(runCommodityForks(defaultParams(store, {n: 3}))).resolves.toBeUndefined()
  })

  it('merges children from successful forks when one fork throws', async () => {
    const store = cellOnlyStore()
    let callIndex = 0

    mockRunCommand.mockImplementation(async ({store: forkStore, cell: forkCell}) => {
      if (callIndex++ === 0) throw new Error('LLM failure')
      forkStore._nodes['survivor-child'] = {id: 'survivor-child', parent: forkCell.id, children: []}
      forkStore.getNode(forkCell.id).children.push('survivor-child')
    })

    await runCommodityForks(defaultParams(store, {n: 3}))

    expect(store.getNode('survivor-child')).toBeDefined()
  })

  it('no children are merged when all forks throw', async () => {
    const store = cellOnlyStore()
    mockRunCommand.mockRejectedValue(new Error('all fail'))

    await runCommodityForks(defaultParams(store, {n: 3}))

    expect(store.getNode('cell').children).toHaveLength(0)
  })
})
