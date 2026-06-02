import {ForeachCommand} from './ForeachCommand'
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

jest.mock('./utils/runCommand', () => ({
  runCommand: jest.fn().mockResolvedValue(undefined),
}))

const {runCommand: mockRunCommand} = require('./utils/runCommand')

// ─── topology builders ────────────────────────────────────────────────────────

function buildForeachStore({foreachPrompt, leaves = null, extraNodes = {}} = {}) {
  const defaultLeaves = {
    leaf1: {id: 'leaf1', parent: 'parent', title: 'Company Alpha', children: []},
    leaf2: {id: 'leaf2', parent: 'parent', title: 'Company Beta', children: []},
  }
  const leafNodes = leaves ?? defaultLeaves
  const leafIds = Object.keys(leafNodes)
  return new Store({
    userId: 'user1',
    nodes: {
      gp: {id: 'gp', parent: null, children: ['parent']},
      parent: {
        id: 'parent',
        parent: 'gp',
        command: '/chat task',
        children: ['fe', ...leafIds],
        prompts: leafIds,
      },
      fe: {id: 'fe', parent: 'parent', command: `/foreach ${foreachPrompt}`, children: []},
      ...leafNodes,
      ...extraNodes,
    },
  })
}

function makeCmd(store) {
  const cmd = new ForeachCommand('user1', 'wf1', store, {
    add: jest.fn(async l => l),
    remove: jest.fn(),
    dispose: jest.fn(),
  })
  cmd.logError = jest.fn()
  return cmd
}

// ─── helpers ──────────────────────────────────────────────────────────────────

const capturedCellCommands = () => mockRunCommand.mock.calls.map(([{cell}]) => cell.command)

beforeEach(() => jest.clearAllMocks())

// ─── @@ token substitution contract ──────────────────────────────────────────

describe('/foreach @@ substitution — resolved command delivered to runCommand', () => {
  it('@@ is replaced with each leaf title — one runCommand call per leaf with substituted command', async () => {
    const store = buildForeachStore({foreachPrompt: '/chat analyze @@'})
    await makeCmd(store).run(store.getNode('fe'), {})

    const commands = capturedCellCommands()
    expect(commands).toHaveLength(2)
    expect(commands).toContain('/chat analyze Company Alpha')
    expect(commands).toContain('/chat analyze Company Beta')
  })

  it('@@ token does not survive substitution — never reaches runCommand verbatim', async () => {
    const store = buildForeachStore({foreachPrompt: '/chat analyze @@'})
    await makeCmd(store).run(store.getNode('fe'), {})

    capturedCellCommands().forEach(cmd => expect(cmd).not.toContain('@@'))
  })

  it('prompt without @@ passes through unchanged — no substitution applied', async () => {
    const store = buildForeachStore({foreachPrompt: '/chat generic task'})
    await makeCmd(store).run(store.getNode('fe'), {})

    const commands = capturedCellCommands()
    expect(commands).toHaveLength(2)
    commands.forEach(cmd => expect(cmd).toBe('/chat generic task'))
  })

  it('multiple @@ occurrences in one prompt — every occurrence is replaced by the leaf title', async () => {
    const store = buildForeachStore({foreachPrompt: '/chat analyze @@ and compare with @@'})
    await makeCmd(store).run(store.getNode('fe'), {})

    const commands = capturedCellCommands()
    expect(commands).toContain('/chat analyze Company Alpha and compare with Company Alpha')
    expect(commands).toContain('/chat analyze Company Beta and compare with Company Beta')
  })

  it('@ref token present alongside @@ is preserved verbatim after substitution', async () => {
    const store = buildForeachStore({foreachPrompt: '/chat compare @@ with context from @ref'})
    await makeCmd(store).run(store.getNode('fe'), {})

    const commands = capturedCellCommands()
    expect(commands).toContain('/chat compare Company Alpha with context from @ref')
    expect(commands).toContain('/chat compare Company Beta with context from @ref')
    commands.forEach(cmd => expect(cmd).toContain('@ref'))
  })

  it('#_ref token present alongside @@ is preserved verbatim after substitution', async () => {
    const store = buildForeachStore({foreachPrompt: '/chat process @@ referencing #_someNode'})
    await makeCmd(store).run(store.getNode('fe'), {})

    const commands = capturedCellCommands()
    expect(commands).toContain('/chat process Company Alpha referencing #_someNode')
    expect(commands).toContain('/chat process Company Beta referencing #_someNode')
    commands.forEach(cmd => expect(cmd).toContain('#_someNode'))
  })

  it('each leaf receives its own independent substitution — N leaves → N distinct commands', async () => {
    const store = buildForeachStore({foreachPrompt: '/chat research @@'})
    await makeCmd(store).run(store.getNode('fe'), {})

    const commands = capturedCellCommands()
    expect(new Set(commands).size).toBe(2)
  })

  it('single-leaf foreach — exactly one substituted runCommand call', async () => {
    const store = buildForeachStore({
      foreachPrompt: '/chat analyze @@',
      leaves: {
        only: {id: 'only', parent: 'parent', title: 'Solo Corp', children: []},
      },
    })
    await makeCmd(store).run(store.getNode('fe'), {})

    const commands = capturedCellCommands()
    expect(commands).toHaveLength(1)
    expect(commands[0]).toBe('/chat analyze Solo Corp')
  })

  it('zero-leaf parent — no runCommand calls issued', async () => {
    const store = buildForeachStore({
      foreachPrompt: '/chat analyze @@',
      leaves: {},
    })
    await makeCmd(store).run(store.getNode('fe'), {})

    expect(mockRunCommand).not.toHaveBeenCalled()
  })

  it('leaf with empty string title — silently excluded from iteration (empty title is not a valid substitution target)', async () => {
    const store = buildForeachStore({
      foreachPrompt: '/chat analyze @@',
      leaves: {
        empty: {id: 'empty', parent: 'parent', title: '', children: []},
      },
    })
    await makeCmd(store).run(store.getNode('fe'), {})

    expect(mockRunCommand).not.toHaveBeenCalled()
  })

  it('@@ substitution applies in both parallel (default) and sequential (--parallel=no) execution modes', async () => {
    const parallelStore = buildForeachStore({foreachPrompt: '/chat analyze @@'})
    await makeCmd(parallelStore).run(parallelStore.getNode('fe'), {})
    const parallelCommands = capturedCellCommands()

    jest.clearAllMocks()

    const seqStore = buildForeachStore({foreachPrompt: '/chat analyze @@ --parallel=no'})
    await makeCmd(seqStore).run(seqStore.getNode('fe'), {})
    const seqCommands = capturedCellCommands()

    expect(parallelCommands).toHaveLength(2)
    expect(parallelCommands).not.toContain(expect.stringContaining('@@'))
    parallelCommands.forEach(cmd => expect(cmd).toMatch(/Company (Alpha|Beta)/))

    expect(seqCommands).toHaveLength(2)
    seqCommands.forEach(cmd => {
      expect(cmd).not.toContain('@@')
      expect(cmd).toMatch(/Company (Alpha|Beta)/)
    })
  })
})

describe('/foreach @@ substitution — cell.command update persisted in store before runCommand', () => {
  it('the store node command is already substituted at the moment runCommand fires', async () => {
    const store = buildForeachStore({foreachPrompt: '/chat analyze @@'})

    mockRunCommand.mockImplementation(async ({cell}) => {
      expect(cell.command).toMatch(/^\/chat analyze Company (Alpha|Beta)$/)
    })

    await makeCmd(store).run(store.getNode('fe'), {})
    expect(mockRunCommand).toHaveBeenCalledTimes(2)
  })
})
