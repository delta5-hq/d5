import {extractCommandAlias, createUnknownCommandNode} from './unknownCommandNode'

describe('extractCommandAlias', () => {
  describe('command with prompt text', () => {
    it('returns the leading slash-command from a command with trailing prompt', () => {
      expect(extractCommandAlias('/cmd hello world')).toBe('/cmd')
    })

    it('returns the leading slash-command when prompt contains multiple spaces', () => {
      expect(extractCommandAlias('/cmd   spaced  prompt')).toBe('/cmd')
    })

    it('returns the first token when command has no prompt (alias only)', () => {
      expect(extractCommandAlias('/cmd')).toBe('/cmd')
    })
  })

  describe('ordered-prefix commands', () => {
    it('returns the step prefix token, not the alias, for ordered commands like #1 /alias', () => {
      expect(extractCommandAlias('#1 /cmd prompt')).toBe('#1')
    })
  })

  describe('absent or empty command', () => {
    it('returns (unknown) for undefined command', () => {
      expect(extractCommandAlias(undefined)).toBe('(unknown)')
    })

    it('returns (unknown) for null command', () => {
      expect(extractCommandAlias(null)).toBe('(unknown)')
    })

    it('returns (unknown) for empty string', () => {
      expect(extractCommandAlias('')).toBe('(unknown)')
    })

    it('returns (unknown) for whitespace-only string', () => {
      expect(extractCommandAlias('   ')).toBe('(unknown)')
    })
  })
})

describe('createUnknownCommandNode', () => {
  const makeStore = () => ({
    importer: {createNodes: jest.fn()},
  })

  it('creates a node whose title contains the extracted alias', () => {
    const store = makeStore()
    const cell = {id: 'cell-1', command: '/deleted-alias run something'}

    createUnknownCommandNode(store, cell)

    expect(store.importer.createNodes).toHaveBeenCalledWith('Error: Unknown command "/deleted-alias"', 'cell-1')
  })

  it('creates a node parented to the cell id', () => {
    const store = makeStore()
    const cell = {id: 'target-cell', command: '/gone'}

    createUnknownCommandNode(store, cell)

    const [, parentId] = store.importer.createNodes.mock.calls[0]
    expect(parentId).toBe('target-cell')
  })

  it('creates a node with (unknown) alias when cell has no command', () => {
    const store = makeStore()
    const cell = {id: 'cell-2', command: undefined}

    createUnknownCommandNode(store, cell)

    expect(store.importer.createNodes).toHaveBeenCalledWith('Error: Unknown command "(unknown)"', 'cell-2')
  })

  it('error message always starts with "Error:" prefix matching the codebase convention', () => {
    const store = makeStore()
    const cell = {id: 'cell-3', command: '/any-alias'}

    createUnknownCommandNode(store, cell)

    const [message] = store.importer.createNodes.mock.calls[0]
    expect(message).toMatch(/^Error:/)
  })
})
