import {extractForkLeafOutputs, LEAF_PREVIEW_MAX_CHARS} from './ForkLeafExtractor'

const makeStore = nodes => ({
  getNode: id => nodes[id] ?? null,
})

describe('extractForkLeafOutputs', () => {
  describe('null/absent inputs', () => {
    it('returns [] for null forkStore', () => {
      expect(extractForkLeafOutputs(null, 'parent')).toEqual([])
    })

    it('returns [] for undefined forkStore', () => {
      expect(extractForkLeafOutputs(undefined, 'parent')).toEqual([])
    })

    it('returns [] when parent node is not in forkStore', () => {
      const store = makeStore({})
      expect(extractForkLeafOutputs(store, 'missing')).toEqual([])
    })

    it('returns [] when parent has no prompts field', () => {
      const store = makeStore({parent: {id: 'parent'}})
      expect(extractForkLeafOutputs(store, 'parent')).toEqual([])
    })

    it('returns [] when parent has empty prompts array', () => {
      const store = makeStore({parent: {id: 'parent', prompts: []}})
      expect(extractForkLeafOutputs(store, 'parent')).toEqual([])
    })

    it('returns [] when parent has null prompts (null-coalesces to empty)', () => {
      const store = makeStore({parent: {id: 'parent', prompts: null}})
      expect(extractForkLeafOutputs(store, 'parent')).toEqual([])
    })
  })

  describe('single prompt node', () => {
    it('returns one LeafOutput with nodeId and content', () => {
      const store = makeStore({
        parent: {id: 'parent', prompts: ['out1']},
        out1: {id: 'out1', title: 'LLM response text'},
      })
      expect(extractForkLeafOutputs(store, 'parent')).toEqual([{nodeId: 'out1', content: 'LLM response text'}])
    })

    it('preserves executionStatus when the prompt node is a machine-tagged error', () => {
      const store = makeStore({
        parent: {id: 'parent', prompts: ['out1']},
        out1: {id: 'out1', title: 'Error: failed', executionStatus: 'error'},
      })

      expect(extractForkLeafOutputs(store, 'parent')).toEqual([
        {nodeId: 'out1', content: 'Error: failed', executionStatus: 'error'},
      ])
    })

    it('preserves deterministic tool failure fields for the structural gate', () => {
      const store = makeStore({
        parent: {id: 'parent', prompts: ['out1']},
        out1: {
          id: 'out1',
          title: 'Error: failed',
          isError: true,
          httpStatus: 503,
          exitCode: 126,
        },
      })

      expect(extractForkLeafOutputs(store, 'parent')).toEqual([
        {
          nodeId: 'out1',
          content: 'Error: failed',
          isError: true,
          httpStatus: 503,
          exitCode: 126,
        },
      ])
    })

    it('preserves isError: false — boolean false passes through so the gate receives the full MCP signal, not just error-flagged nodes', () => {
      const store = makeStore({
        parent: {id: 'parent', prompts: ['out1']},
        out1: {id: 'out1', title: 'success response', isError: false},
      })

      expect(extractForkLeafOutputs(store, 'parent')).toEqual([
        {nodeId: 'out1', content: 'success response', isError: false},
      ])
    })

    it('excludes non-integer httpStatus and exitCode from output — Number.isInteger rejects NaN and string values so the gate only sees type-safe integers', () => {
      const store = makeStore({
        parent: {id: 'parent', prompts: ['out1']},
        out1: {id: 'out1', title: 'response', httpStatus: NaN, exitCode: '126'},
      })
      const result = extractForkLeafOutputs(store, 'parent')
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({nodeId: 'out1', content: 'response'})
      expect(result[0].httpStatus).toBeUndefined()
      expect(result[0].exitCode).toBeUndefined()
    })

    it('excludes executionStatus when it is an empty string — truthy guard requires a non-empty machine-tag so no-status nodes are not mis-classified as execution errors', () => {
      const store = makeStore({
        parent: {id: 'parent', prompts: ['out1']},
        out1: {id: 'out1', title: 'response', executionStatus: ''},
      })
      expect(extractForkLeafOutputs(store, 'parent')).toEqual([{nodeId: 'out1', content: 'response'}])
    })

    it('skips prompt node that is absent from store', () => {
      const store = makeStore({
        parent: {id: 'parent', prompts: ['missing']},
      })
      expect(extractForkLeafOutputs(store, 'parent')).toEqual([])
    })

    it('skips prompt node with no title', () => {
      const store = makeStore({
        parent: {id: 'parent', prompts: ['out1']},
        out1: {id: 'out1'},
      })
      expect(extractForkLeafOutputs(store, 'parent')).toEqual([])
    })

    it('skips prompt node with empty-string title', () => {
      const store = makeStore({
        parent: {id: 'parent', prompts: ['out1']},
        out1: {id: 'out1', title: ''},
      })
      expect(extractForkLeafOutputs(store, 'parent')).toEqual([])
    })
  })

  describe('multiple prompt nodes', () => {
    it('returns one LeafOutput per prompt node', () => {
      const store = makeStore({
        parent: {id: 'parent', prompts: ['out1', 'out2']},
        out1: {id: 'out1', title: 'First'},
        out2: {id: 'out2', title: 'Second'},
      })
      const result = extractForkLeafOutputs(store, 'parent')
      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({nodeId: 'out1', content: 'First'})
      expect(result[1]).toEqual({nodeId: 'out2', content: 'Second'})
    })

    it('skips absent nodes among multiple prompts', () => {
      const store = makeStore({
        parent: {id: 'parent', prompts: ['out1', 'missing', 'out2']},
        out1: {id: 'out1', title: 'First'},
        out2: {id: 'out2', title: 'Second'},
      })
      expect(extractForkLeafOutputs(store, 'parent')).toHaveLength(2)
    })
  })

  describe('content truncation', () => {
    it('truncates content at LEAF_PREVIEW_MAX_CHARS', () => {
      const longText = 'x'.repeat(LEAF_PREVIEW_MAX_CHARS + 100)
      const store = makeStore({
        parent: {id: 'parent', prompts: ['out1']},
        out1: {id: 'out1', title: longText},
      })
      const result = extractForkLeafOutputs(store, 'parent')
      expect(result[0].content).toHaveLength(LEAF_PREVIEW_MAX_CHARS)
    })

    it('does not truncate content shorter than LEAF_PREVIEW_MAX_CHARS', () => {
      const text = 'short'
      const store = makeStore({
        parent: {id: 'parent', prompts: ['out1']},
        out1: {id: 'out1', title: text},
      })
      expect(extractForkLeafOutputs(store, 'parent')[0].content).toBe(text)
    })

    it('content at exact LEAF_PREVIEW_MAX_CHARS is not truncated', () => {
      const text = 'y'.repeat(LEAF_PREVIEW_MAX_CHARS)
      const store = makeStore({
        parent: {id: 'parent', prompts: ['out1']},
        out1: {id: 'out1', title: text},
      })
      expect(extractForkLeafOutputs(store, 'parent')[0].content).toHaveLength(LEAF_PREVIEW_MAX_CHARS)
    })
  })

  describe('parent cells without prompts (complex subtrees)', () => {
    it('returns [] for a parent that has children but no prompts — complex subtree case', () => {
      const store = makeStore({
        parent: {id: 'parent', children: ['step1', 'refine']},
        step1: {id: 'step1', prompts: ['out1']},
        out1: {id: 'out1', title: 'step output'},
      })
      expect(extractForkLeafOutputs(store, 'parent')).toEqual([])
    })
  })
})
