import Store from './Store'

jest.mock('debug', () => {
  const fn = jest.fn(() => fn)
  fn.extend = jest.fn(() => fn)
  return fn
})

const makeStore = () =>
  new Store({
    userId: 'user-1',
    workflowId: 'wf-1',
    nodes: {parent: {id: 'parent', title: 'Parent Node'}},
  })

describe('ImportHandler', () => {
  describe('createErrorNode', () => {
    describe('single-node invariant', () => {
      it('produces exactly one output node for a plain string', () => {
        const store = makeStore()
        store.importer.createErrorNode('Error: Unauthorized', 'parent')

        expect(store.getOutput().nodes).toHaveLength(1)
      })

      it('produces exactly one output node when the message contains a paragraph break', () => {
        const store = makeStore()
        store.importer.createErrorNode('Error: Missing credentials.\n\nPlease set OPENAI_API_KEY.', 'parent')

        expect(store.getOutput().nodes).toHaveLength(1)
      })

      it('produces exactly one output node when the message contains multiple paragraph breaks', () => {
        const store = makeStore()
        store.importer.createErrorNode('Error: first line.\n\nsecond paragraph.\n\nthird paragraph.', 'parent')

        expect(store.getOutput().nodes).toHaveLength(1)
      })

      it('produces exactly one output node when the message contains embedded single newlines', () => {
        const store = makeStore()
        store.importer.createErrorNode('Error: line one\nline two\nline three', 'parent')

        expect(store.getOutput().nodes).toHaveLength(1)
      })

      it('produces exactly one output node for an empty message', () => {
        const store = makeStore()
        store.importer.createErrorNode('', 'parent')

        expect(store.getOutput().nodes).toHaveLength(1)
      })
    })

    describe('content fidelity', () => {
      it('stores the original message as the node title without modification', () => {
        const store = makeStore()
        const message = 'Error: Missing credentials.'
        store.importer.createErrorNode(message, 'parent')

        const [node] = store.getOutput().nodes
        expect(node.title).toBe(message)
      })

      it('marks error nodes with a machine-readable execution status', () => {
        const store = makeStore()
        store.importer.createErrorNode('Provider refused credentials', 'parent')

        const [node] = store.getOutput().nodes
        expect(node.executionStatus).toBe('error')
      })

      it('preserves paragraph breaks in the title rather than discarding them', () => {
        const store = makeStore()
        const message = 'Error: first part.\n\nsecond part.'
        store.importer.createErrorNode(message, 'parent')

        const [node] = store.getOutput().nodes
        expect(node.title).toBe(message)
      })

      it('preserves embedded newlines in the title', () => {
        const store = makeStore()
        const message = 'Error: line one\nline two'
        store.importer.createErrorNode(message, 'parent')

        const [node] = store.getOutput().nodes
        expect(node.title).toBe(message)
      })
    })

    describe('store integration', () => {
      it('attaches the node to the given parent id', () => {
        const store = makeStore()
        store.importer.createErrorNode('Error: timeout', 'parent')

        const [node] = store.getOutput().nodes
        expect(node.parent).toBe('parent')
      })

      it('registers the new node as the sole prompt of its parent', () => {
        const store = makeStore()
        store.importer.createErrorNode('Error: timeout', 'parent')

        const [node] = store.getOutput().nodes
        expect(store._nodes.parent.prompts).toEqual([node.id])
      })

      it('replaces any prior prompt on the parent when called again', () => {
        const store = makeStore()
        store.importer.createErrorNode('Error: first', 'parent')
        store.importer.createErrorNode('Error: second', 'parent')

        expect(store._nodes.parent.prompts).toHaveLength(1)
        const [lastPromptId] = store._nodes.parent.prompts
        expect(store._nodes[lastPromptId].title).toBe('Error: second')
      })
    })
  })
})
