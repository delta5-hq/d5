import {ForeachCommand} from './ForeachCommand'
import {ChatCommand} from './ChatCommand'
import {ValidateCommand} from '../reliability/core/ValidateCommand'
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
const realRunCommand = jest.requireActual('./utils/runCommand').runCommand

/**
 * Standard 2-item foreach topology:
 *
 *   gp
 *   └── p  (prompts: [i1, i2])
 *       ├── fe  /foreach /chat @@[--parallel=no]  (children: validate templates)
 *       │   ├── vt0  validateCommand
 *       │   └── vt1  extraValidates[0]  (if provided)
 *       ├── i1  Item 1
 *       └── i2  Item 2
 */
function buildForeachStore({
  validateCommand = '/validate criterion',
  extraValidates = [],
  parallel = true,
  itemCount = 2,
} = {}) {
  const vtIds = ['vt0', ...extraValidates.map((_, i) => `vt${i + 1}`)]
  const allVtCommands = [validateCommand, ...extraValidates]
  const foreachCmd = parallel ? '/foreach /chat @@' : '/foreach /chat @@ --parallel=no'
  const itemIds = Array.from({length: itemCount}, (_, i) => `i${i + 1}`)

  const validateNodes = Object.fromEntries(
    vtIds.map((id, i) => [id, {id, parent: 'fe', command: allVtCommands[i], title: allVtCommands[i], children: []}]),
  )
  const itemNodes = Object.fromEntries(
    itemIds.map((id, i) => [id, {id, parent: 'p', title: `Item ${i + 1}`, children: []}]),
  )

  return new Store({
    userId: 'user1',
    nodes: {
      gp: {id: 'gp', parent: null, children: ['p']},
      p: {
        id: 'p',
        parent: 'gp',
        command: '/chat task',
        children: ['fe', ...itemIds],
        prompts: itemIds,
      },
      fe: {id: 'fe', parent: 'p', command: foreachCmd, children: vtIds},
      ...validateNodes,
      ...itemNodes,
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

beforeEach(() => jest.clearAllMocks())

describe('ForeachCommand — /validate template cloning', () => {
  describe('template identification', () => {
    it('foreach with no /validate children runs without cloning any child', async () => {
      const store = new Store({
        userId: 'user1',
        nodes: {
          gp: {id: 'gp', parent: null, children: ['p']},
          p: {
            id: 'p',
            parent: 'gp',
            command: '/chat task',
            children: ['fe', 'i1'],
            prompts: ['i1'],
          },
          fe: {id: 'fe', parent: 'p', command: '/foreach /chat @@', children: []},
          i1: {id: 'i1', parent: 'p', title: 'Item 1', children: []},
        },
      })
      await makeCmd(store).run(store.getNode('fe'), {})

      expect(mockRunCommand).toHaveBeenCalledTimes(1)
      expect(store.getNode('i1').children).toHaveLength(0)
    })

    it('only /validate-prefixed children are cloned; non-/validate siblings of the template are ignored', async () => {
      const store = new Store({
        userId: 'user1',
        nodes: {
          gp: {id: 'gp', parent: null, children: ['p']},
          p: {
            id: 'p',
            parent: 'gp',
            command: '/chat task',
            children: ['fe', 'i1'],
            prompts: ['i1'],
          },
          fe: {
            id: 'fe',
            parent: 'p',
            command: '/foreach /chat @@',
            children: ['vt0', 'other'],
          },
          vt0: {
            id: 'vt0',
            parent: 'fe',
            command: '/validate criterion',
            title: '/validate criterion',
            children: [],
          },
          other: {id: 'other', parent: 'fe', command: '/summarize', title: '/summarize', children: []},
          i1: {id: 'i1', parent: 'p', title: 'Item 1', children: []},
        },
      })
      await makeCmd(store).run(store.getNode('fe'), {})

      const [[{cell}]] = mockRunCommand.mock.calls
      const leaf = store.getNode(cell.id)
      expect(leaf.children).toHaveLength(1)
      expect(store.getNode(leaf.children[0]).command).toMatch(/^\/validate/)
    })

    it.each(['/validate criterion', '/validate :retry=1 criterion', '/validate :n=2 criterion'])(
      'recognizes "%s" as a validate template',
      async validateCmd => {
        const store = buildForeachStore({validateCommand: validateCmd})
        await makeCmd(store).run(store.getNode('fe'), {})

        mockRunCommand.mock.calls.forEach(([{cell}]) => {
          expect(store.getNode(cell.id).children).toHaveLength(1)
        })
      },
    )
  })

  describe('clone structure', () => {
    it('each clone has a fresh id distinct from the template id', async () => {
      const store = buildForeachStore()
      await makeCmd(store).run(store.getNode('fe'), {})

      mockRunCommand.mock.calls.forEach(([{cell}]) => {
        const leaf = store.getNode(cell.id)
        leaf.children.forEach(cloneId => {
          expect(cloneId).not.toBe('vt0')
        })
      })
    })

    it('each clone is parented to the iteration leaf, not the foreach node', async () => {
      const store = buildForeachStore()
      await makeCmd(store).run(store.getNode('fe'), {})

      mockRunCommand.mock.calls.forEach(([{cell}]) => {
        const leaf = store.getNode(cell.id)
        leaf.children.forEach(cloneId => {
          expect(store.getNode(cloneId).parent).toBe(leaf.id)
        })
      })
    })

    it('each clone preserves the template command verbatim', async () => {
      const store = buildForeachStore()
      await makeCmd(store).run(store.getNode('fe'), {})

      mockRunCommand.mock.calls.forEach(([{cell}]) => {
        const leaf = store.getNode(cell.id)
        leaf.children.forEach(cloneId => {
          expect(store.getNode(cloneId).command).toBe('/validate criterion')
        })
      })
    })

    it('template with nested children: entire subtree cloned recursively under each leaf', async () => {
      const store = new Store({
        userId: 'user1',
        nodes: {
          gp: {id: 'gp', parent: null, children: ['p']},
          p: {id: 'p', parent: 'gp', command: '/chat task', children: ['fe', 'i1'], prompts: ['i1']},
          fe: {id: 'fe', parent: 'p', command: '/foreach /chat @@', children: ['vt0']},
          vt0: {
            id: 'vt0',
            parent: 'fe',
            command: '/validate criterion',
            title: '/validate criterion',
            children: ['vt0child'],
          },
          vt0child: {
            id: 'vt0child',
            parent: 'vt0',
            title: 'sub-criterion detail',
            command: '',
            children: [],
          },
          i1: {id: 'i1', parent: 'p', title: 'Item 1', children: []},
        },
      })
      await makeCmd(store).run(store.getNode('fe'), {})

      const [[{cell}]] = mockRunCommand.mock.calls
      const leaf = store.getNode(cell.id)
      expect(leaf.children).toHaveLength(1)

      const clonedValidate = store.getNode(leaf.children[0])
      expect(clonedValidate.children).toHaveLength(1)

      const clonedChild = store.getNode(clonedValidate.children[0])
      expect(clonedChild.title).toBe('sub-criterion detail')
      expect(clonedChild.parent).toBe(clonedValidate.id)
      expect(clonedValidate.children[0]).not.toBe('vt0child')
    })
  })

  describe('clone multiplicity', () => {
    it('one validate template → exactly one clone per iteration leaf', async () => {
      const store = buildForeachStore()
      await makeCmd(store).run(store.getNode('fe'), {})

      mockRunCommand.mock.calls.forEach(([{cell}]) => {
        expect(store.getNode(cell.id).children).toHaveLength(1)
      })
    })

    it('two validate templates → exactly two clones per leaf, one per template command', async () => {
      const store = buildForeachStore({extraValidates: ['/validate criterion B']})
      await makeCmd(store).run(store.getNode('fe'), {})

      mockRunCommand.mock.calls.forEach(([{cell}]) => {
        const leaf = store.getNode(cell.id)
        expect(leaf.children).toHaveLength(2)
        const cloneCmds = leaf.children.map(id => store.getNode(id).command)
        expect(cloneCmds).toContain('/validate criterion')
        expect(cloneCmds).toContain('/validate criterion B')
      })
    })
  })

  describe('clone independence across iterations', () => {
    it('clones for distinct iteration leaves have unique ids — no shared node references', async () => {
      const store = buildForeachStore()
      await makeCmd(store).run(store.getNode('fe'), {})

      const allCloneIds = mockRunCommand.mock.calls.flatMap(([{cell}]) => store.getNode(cell.id).children)
      expect(new Set(allCloneIds).size).toBe(allCloneIds.length)
    })

    it('two templates: all four clone ids across two leaves are pairwise distinct', async () => {
      const store = buildForeachStore({extraValidates: ['/validate criterion B']})
      await makeCmd(store).run(store.getNode('fe'), {})

      const allCloneIds = mockRunCommand.mock.calls.flatMap(([{cell}]) => store.getNode(cell.id).children)
      expect(allCloneIds).toHaveLength(4)
      expect(new Set(allCloneIds).size).toBe(4)
    })
  })

  describe('parallel vs sequential parity', () => {
    it.each([
      ['parallel', true],
      ['sequential', false],
    ])('%s: runCommand is called once per iteration leaf', async (_label, parallel) => {
      const store = buildForeachStore({parallel})
      await makeCmd(store).run(store.getNode('fe'), {})

      expect(mockRunCommand).toHaveBeenCalledTimes(2)
    })

    it.each([
      ['parallel', true],
      ['sequential', false],
    ])('%s: each leaf has exactly one cloned /validate child at runCommand call time', async (_label, parallel) => {
      const store = buildForeachStore({parallel})
      await makeCmd(store).run(store.getNode('fe'), {})

      mockRunCommand.mock.calls.forEach(([{cell}]) => {
        const leaf = store.getNode(cell.id)
        expect(leaf.children).toHaveLength(1)
        expect(store.getNode(leaf.children[0]).command).toBe('/validate criterion')
      })
    })

    it.each([
      ['parallel', true],
      ['sequential', false],
    ])('%s: validate template node is never passed directly as a runCommand cell', async (_label, parallel) => {
      const store = buildForeachStore({parallel})
      await makeCmd(store).run(store.getNode('fe'), {})

      const callCellIds = mockRunCommand.mock.calls.map(([{cell}]) => cell.id)
      expect(callCellIds).not.toContain('vt0')
    })
  })

  describe('edge cases', () => {
    it('foreach at tree root (parent has no grandparent) — no execution, no clones created', async () => {
      const store = new Store({
        userId: 'user1',
        nodes: {
          p: {id: 'p', parent: null, children: ['fe', 'i1'], prompts: ['i1']},
          fe: {id: 'fe', parent: 'p', command: '/foreach /chat @@', children: ['vt0']},
          vt0: {id: 'vt0', parent: 'fe', command: '/validate criterion', children: []},
          i1: {id: 'i1', parent: 'p', title: 'Item 1', children: []},
        },
      })
      await makeCmd(store).run(store.getNode('fe'), {})

      expect(mockRunCommand).not.toHaveBeenCalled()
      expect(store.getNode('i1').children).toHaveLength(0)
    })

    it('silently skips a validate template id that resolves to null in the store — no crash, no clone created', () => {
      const store = buildForeachStore()
      const cmd = makeCmd(store)

      expect(() => cmd._cloneValidateTemplatesUnder('i1', ['non-existent-template-id'])).not.toThrow()
      expect(store.getNode('i1').children).toHaveLength(0)
    })
  })
})

describe('ForeachCommand end-to-end — cloned /validate verdict written into store', () => {
  it('passing validate: cloned validate cell carries [✓] suffix; template title unchanged', async () => {
    const store = buildForeachStore()

    await makeCmd(store).run(store.getNode('fe'), {})
    const i1 = store.getNode('i1')
    expect(i1.children).toHaveLength(1)
    const cloneId = i1.children[0]
    expect(store.getNode(cloneId).command).toBe('/validate criterion')
    expect(cloneId).not.toBe('vt0')

    const chatSpy = jest.spyOn(ChatCommand.prototype, 'run').mockResolvedValue({})
    const validateSpy = jest.spyOn(ValidateCommand.prototype, 'run').mockResolvedValue({
      passed: true,
      criterion: 'criterion',
      reason: '',
    })

    await realRunCommand({queryType: 'chat', cell: store.getNode('i1'), store}, null)

    expect(store.getNode(cloneId).title).toMatch(/✓/)
    expect(store.getNode('vt0').title).toBe('/validate criterion')
    expect(validateSpy).toHaveBeenCalledTimes(1)

    chatSpy.mockRestore()
    validateSpy.mockRestore()
  })

  it('failing validate: cloned validate cell carries [✗] suffix; template title unchanged', async () => {
    const store = buildForeachStore({validateCommand: '/validate :retry=0 criterion'})

    await makeCmd(store).run(store.getNode('fe'), {})
    const i1 = store.getNode('i1')
    expect(i1.children).toHaveLength(1)
    const cloneId = i1.children[0]

    const chatSpy = jest.spyOn(ChatCommand.prototype, 'run').mockResolvedValue({})
    const validateSpy = jest.spyOn(ValidateCommand.prototype, 'run').mockResolvedValue({
      passed: false,
      criterion: 'criterion',
      reason: 'fail',
    })

    await realRunCommand({queryType: 'chat', cell: store.getNode('i1'), store}, null).catch(() => {})

    expect(store.getNode(cloneId).title).toMatch(/✗/)
    expect(store.getNode('vt0').title).toBe('/validate :retry=0 criterion')
    expect(validateSpy).toHaveBeenCalled()

    chatSpy.mockRestore()
    validateSpy.mockRestore()
  })

  it('three iteration leaves each receive their own independent verdict suffix — pass/fail/pass pattern', async () => {
    const store = buildForeachStore({
      parallel: false,
      itemCount: 3,
      validateCommand: '/validate :retry=0 criterion',
    })

    await makeCmd(store).run(store.getNode('fe'), {})

    const [cloneId1, cloneId2, cloneId3] = ['i1', 'i2', 'i3'].map(id => store.getNode(id).children[0])
    expect(new Set([cloneId1, cloneId2, cloneId3]).size).toBe(3)

    const chatSpy = jest.spyOn(ChatCommand.prototype, 'run').mockResolvedValue({})
    const outcomes = [
      {passed: true, criterion: 'criterion', reason: ''},
      {passed: false, criterion: 'criterion', reason: 'fail'},
      {passed: true, criterion: 'criterion', reason: ''},
    ]
    let callIdx = 0
    const validateSpy = jest.spyOn(ValidateCommand.prototype, 'run').mockImplementation(async () => outcomes[callIdx++])

    await realRunCommand({queryType: 'chat', cell: store.getNode('i1'), store}, null)
    await realRunCommand({queryType: 'chat', cell: store.getNode('i2'), store}, null).catch(() => {})
    await realRunCommand({queryType: 'chat', cell: store.getNode('i3'), store}, null)

    expect(store.getNode(cloneId1).title).toMatch(/✓/)
    expect(store.getNode(cloneId2).title).toMatch(/✗/)
    expect(store.getNode(cloneId3).title).toMatch(/✓/)
    expect(store.getNode('vt0').title).toBe('/validate :retry=0 criterion')

    chatSpy.mockRestore()
    validateSpy.mockRestore()
  })

  it('each of the two iteration leaves receives its own independent verdict suffix — no cross-contamination', async () => {
    const store = buildForeachStore({parallel: false})

    await makeCmd(store).run(store.getNode('fe'), {})

    const i1 = store.getNode('i1')
    const i2 = store.getNode('i2')
    expect(i1.children).toHaveLength(1)
    expect(i2.children).toHaveLength(1)
    const cloneId1 = i1.children[0]
    const cloneId2 = i2.children[0]
    expect(cloneId1).not.toBe(cloneId2)

    const chatSpy = jest.spyOn(ChatCommand.prototype, 'run').mockResolvedValue({})
    let validateCallIdx = 0
    const validateSpy = jest.spyOn(ValidateCommand.prototype, 'run').mockImplementation(async () => {
      validateCallIdx++
      return validateCallIdx === 1
        ? {passed: true, criterion: 'criterion', reason: ''}
        : {passed: false, criterion: 'criterion', reason: 'fail'}
    })

    await realRunCommand({queryType: 'chat', cell: store.getNode('i1'), store}, null)
    await realRunCommand({queryType: 'chat', cell: store.getNode('i2'), store}, null).catch(() => {})

    expect(store.getNode(cloneId1).title).toMatch(/✓/)
    expect(store.getNode(cloneId2).title).toMatch(/✗/)
    expect(store.getNode('vt0').title).toBe('/validate criterion')

    chatSpy.mockRestore()
    validateSpy.mockRestore()
  })

  it('parallel (default): 2 concurrent iterations with mixed pass/fail — each clone carries the correct independent verdict', async () => {
    const store = buildForeachStore({parallel: true, validateCommand: '/validate :retry=0 criterion'})

    await makeCmd(store).run(store.getNode('fe'), {})

    const cloneId1 = store.getNode('i1').children[0]
    const cloneId2 = store.getNode('i2').children[0]
    expect(cloneId1).not.toBe(cloneId2)

    const chatSpy = jest.spyOn(ChatCommand.prototype, 'run').mockResolvedValue({})
    const passingCloneIds = new Set([cloneId1])
    const validateSpy = jest.spyOn(ValidateCommand.prototype, 'run').mockImplementation(async validateNode => {
      const passed = passingCloneIds.has(validateNode.id)
      return {passed, criterion: 'criterion', reason: passed ? '' : 'fail'}
    })

    await Promise.all([
      realRunCommand({queryType: 'chat', cell: store.getNode('i1'), store}, null),
      realRunCommand({queryType: 'chat', cell: store.getNode('i2'), store}, null).catch(() => {}),
    ])

    expect(store.getNode(cloneId1).title).toMatch(/✓/)
    expect(store.getNode(cloneId2).title).toMatch(/✗/)
    expect(store.getNode('vt0').title).toBe('/validate :retry=0 criterion')

    chatSpy.mockRestore()
    validateSpy.mockRestore()
  })

  it('parallel (default): 2 validate templates per iteration — all template clones across all leaves receive their verdict suffix', async () => {
    const store = buildForeachStore({parallel: true, extraValidates: ['/validate criterion B']})

    await makeCmd(store).run(store.getNode('fe'), {})

    const i1Clones = store.getNode('i1').children.map(id => store.getNode(id))
    const i2Clones = store.getNode('i2').children.map(id => store.getNode(id))
    expect(i1Clones).toHaveLength(2)
    expect(i2Clones).toHaveLength(2)

    const chatSpy = jest.spyOn(ChatCommand.prototype, 'run').mockResolvedValue({})
    const validateSpy = jest.spyOn(ValidateCommand.prototype, 'run').mockResolvedValue({
      passed: true,
      criterion: 'criterion',
      reason: '',
    })

    await Promise.all([
      realRunCommand({queryType: 'chat', cell: store.getNode('i1'), store}, null),
      realRunCommand({queryType: 'chat', cell: store.getNode('i2'), store}, null),
    ])
    ;[...i1Clones, ...i2Clones].forEach(clone => {
      expect(clone.title).toMatch(/✓/)
    })
    expect(store.getNode('vt0').title).toBe('/validate criterion')
    expect(store.getNode('vt1').title).toBe('/validate criterion B')

    chatSpy.mockRestore()
    validateSpy.mockRestore()
  })

  it('parallel (default): 3 concurrent iterations — each clone carries its own independent verdict, no cross-contamination', async () => {
    const store = buildForeachStore({
      parallel: true,
      itemCount: 3,
      validateCommand: '/validate :retry=0 criterion',
    })

    await makeCmd(store).run(store.getNode('fe'), {})

    const cloneId1 = store.getNode('i1').children[0]
    const cloneId2 = store.getNode('i2').children[0]
    const cloneId3 = store.getNode('i3').children[0]
    expect(new Set([cloneId1, cloneId2, cloneId3]).size).toBe(3)

    const chatSpy = jest.spyOn(ChatCommand.prototype, 'run').mockResolvedValue({})
    const passingCloneIds = new Set([cloneId1, cloneId3])
    const validateSpy = jest.spyOn(ValidateCommand.prototype, 'run').mockImplementation(async validateNode => {
      const passed = passingCloneIds.has(validateNode.id)
      return {passed, criterion: 'criterion', reason: passed ? '' : 'fail'}
    })

    await Promise.all([
      realRunCommand({queryType: 'chat', cell: store.getNode('i1'), store}, null),
      realRunCommand({queryType: 'chat', cell: store.getNode('i2'), store}, null).catch(() => {}),
      realRunCommand({queryType: 'chat', cell: store.getNode('i3'), store}, null),
    ])

    expect(store.getNode(cloneId1).title).toMatch(/✓/)
    expect(store.getNode(cloneId2).title).toMatch(/✗/)
    expect(store.getNode(cloneId3).title).toMatch(/✓/)
    expect(store.getNode('vt0').title).toBe('/validate :retry=0 criterion')

    chatSpy.mockRestore()
    validateSpy.mockRestore()
  })
})
