import PreviewController from './PreviewController'

jest.mock('./commands/utils/getWorkflowData', () => ({
  getWorkflowData: jest.fn(),
}))

import {getWorkflowData} from './commands/utils/getWorkflowData'

function createMockCtx(body = {}, state = {}) {
  const thrown = []
  return {
    request: {
      json: jest.fn().mockResolvedValue(body),
    },
    state: {userId: 'test-user', ...state},
    body: undefined,
    throw: jest.fn((status, message) => {
      const err = new Error(message)
      err.status = status
      thrown.push(err)
      throw err
    }),
    _thrown: thrown,
  }
}

function makeNode(id, overrides = {}) {
  return {id, title: `Title of ${id}`, children: [], ...overrides}
}

function makeRefNode(id, refName, overrides = {}) {
  return {
    id,
    title: `@${refName} ${overrides.content || 'content'}`,
    children: [],
    ...overrides,
  }
}

describe('PreviewController.resolveReferences', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('input validation', () => {
    it('rejects request without nodeId', async () => {
      const ctx = createMockCtx({workflowNodes: {}})
      await expect(PreviewController.resolveReferences(ctx)).rejects.toThrow('nodeId is required')
      expect(ctx.throw).toHaveBeenCalledWith(400, 'nodeId is required')
    })

    it('rejects null nodeId', async () => {
      const ctx = createMockCtx({nodeId: null, workflowNodes: {}})
      await expect(PreviewController.resolveReferences(ctx)).rejects.toThrow('nodeId is required')
    })

    it('rejects empty string nodeId', async () => {
      const ctx = createMockCtx({nodeId: '', workflowNodes: {}})
      await expect(PreviewController.resolveReferences(ctx)).rejects.toThrow('nodeId is required')
    })

    it('rejects request with nodeId not present in workflow', async () => {
      const ctx = createMockCtx({
        nodeId: 'missing',
        workflowNodes: {other: makeNode('other')},
      })
      await expect(PreviewController.resolveReferences(ctx)).rejects.toThrow('Node not found')
      expect(ctx.throw).toHaveBeenCalledWith(404, 'Node not found')
    })
  })

  describe('plain text without references', () => {
    it('returns unmodified text for node without references', async () => {
      const ctx = createMockCtx({
        nodeId: 'n1',
        workflowNodes: {
          n1: makeNode('n1', {title: 'Hello world', command: 'Hello world'}),
        },
      })
      await PreviewController.resolveReferences(ctx)
      expect(ctx.body.resolvedCommand).toBe('Hello world')
    })

    it('returns empty string for node with empty title', async () => {
      const ctx = createMockCtx({
        nodeId: 'n1',
        workflowNodes: {n1: makeNode('n1', {title: '', command: ''})},
      })
      await PreviewController.resolveReferences(ctx)
      expect(ctx.body.resolvedCommand).toBe('')
    })

    it('returns empty string for node with undefined title', async () => {
      const ctx = createMockCtx({
        nodeId: 'n1',
        workflowNodes: {
          n1: makeNode('n1', {title: undefined, command: undefined}),
        },
      })
      await PreviewController.resolveReferences(ctx)
      expect(ctx.body.resolvedCommand).toBe('')
    })
  })

  describe('@@ reference substitution', () => {
    it('substitutes @@ref with referenced node content', async () => {
      const refNode = makeRefNode('ref', 'greeting', {
        content: 'Hello from ref',
      })
      const mainNode = makeNode('main', {
        title: 'Say: @@greeting',
        command: 'Say: @@greeting',
      })
      const ctx = createMockCtx({
        nodeId: 'main',
        workflowNodes: {main: mainNode, ref: refNode},
      })
      await PreviewController.resolveReferences(ctx)
      expect(ctx.body.resolvedCommand).toContain('Hello from ref')
    })

    it('removes unresolvable @@ref markers', async () => {
      const mainNode = makeNode('main', {
        title: 'Before @@missing after',
        command: 'Before @@missing after',
      })
      const ctx = createMockCtx({
        nodeId: 'main',
        workflowNodes: {main: mainNode},
      })
      await PreviewController.resolveReferences(ctx)
      expect(ctx.body.resolvedCommand).not.toContain('@@missing')
    })

    it('handles multiple @@ref in same command', async () => {
      const refA = makeRefNode('rA', 'alpha', {content: 'A'})
      const refB = makeRefNode('rB', 'beta', {content: 'B'})
      const mainNode = makeNode('main', {
        title: '@@alpha and @@beta',
        command: '@@alpha and @@beta',
      })
      const ctx = createMockCtx({
        nodeId: 'main',
        workflowNodes: {main: mainNode, rA: refA, rB: refB},
      })
      await PreviewController.resolveReferences(ctx)
      expect(ctx.body.resolvedCommand).toContain('A')
      expect(ctx.body.resolvedCommand).toContain('B')
    })
  })

  describe('## hashref substitution', () => {
    it('substitutes ##_hashref with sibling node content', async () => {
      const hashNode = makeNode('h1', {
        title: '#_var Source content',
        parent: 'root',
        depth: 1,
      })
      const mainNode = makeNode('main', {
        title: '##_var here',
        command: '##_var here',
        parent: 'root',
        depth: 1,
      })
      const root = makeNode('root', {
        title: 'Root',
        depth: 0,
        children: ['h1', 'main'],
      })
      const ctx = createMockCtx({
        nodeId: 'main',
        workflowNodes: {main: mainNode, h1: hashNode, root},
      })
      await PreviewController.resolveReferences(ctx)
      expect(ctx.body.resolvedCommand).toContain('Source content')
    })
  })

  describe('child node content aggregation', () => {
    it('includes child node titles in resolution', async () => {
      const child = makeNode('c1', {
        title: 'Child text',
        parent: 'main',
        depth: 2,
      })
      const mainNode = makeNode('main', {
        title: '/chatgpt Parent text',
        command: '/chatgpt Parent text',
        children: ['c1'],
      })
      const ctx = createMockCtx({
        nodeId: 'main',
        workflowNodes: {main: mainNode, c1: child},
      })
      await PreviewController.resolveReferences(ctx)
      expect(ctx.body.resolvedCommand).toContain('Child text')
    })

    it('includes nested grandchild content', async () => {
      const grandchild = makeNode('gc', {
        title: 'Deep content',
        parent: 'c1',
        depth: 3,
      })
      const child = makeNode('c1', {
        title: 'Child',
        parent: 'main',
        depth: 2,
        children: ['gc'],
      })
      const mainNode = makeNode('main', {
        title: '/chatgpt Root',
        command: '/chatgpt Root',
        children: ['c1'],
      })
      const ctx = createMockCtx({
        nodeId: 'main',
        workflowNodes: {main: mainNode, c1: child, gc: grandchild},
      })
      await PreviewController.resolveReferences(ctx)
      expect(ctx.body.resolvedCommand).toContain('Deep content')
    })
  })

  describe('default values for optional fields', () => {
    it('resolves without workflowEdges or workflowFiles', async () => {
      const ctx = createMockCtx({
        nodeId: 'n1',
        workflowNodes: {
          n1: makeNode('n1', {title: 'text', command: 'text'}),
        },
      })
      await PreviewController.resolveReferences(ctx)
      expect(ctx.body.resolvedCommand).toBe('text')
    })

    it('returns 404 when no data source available', async () => {
      const ctx = createMockCtx({nodeId: 'n1'})
      await expect(PreviewController.resolveReferences(ctx)).rejects.toThrow('Node not found')
    })
  })

  describe('database fallback via workflowId', () => {
    it('fetches all workflow data when nothing provided', async () => {
      const dbNodes = {
        n1: makeNode('n1', {title: 'DB content', command: 'DB content'}),
      }
      getWorkflowData.mockResolvedValue({nodes: dbNodes, edges: {}})

      const ctx = createMockCtx({nodeId: 'n1', workflowId: 'wf-123'})
      await PreviewController.resolveReferences(ctx)

      expect(getWorkflowData).toHaveBeenCalledWith('wf-123')
      expect(ctx.body.resolvedCommand).toBe('DB content')
    })

    it('skips database when both nodes and edges provided', async () => {
      const ctx = createMockCtx({
        nodeId: 'n1',
        workflowId: 'wf-123',
        workflowNodes: {
          n1: makeNode('n1', {title: 'Inline', command: 'Inline'}),
        },
        workflowEdges: {},
      })
      await PreviewController.resolveReferences(ctx)

      expect(getWorkflowData).not.toHaveBeenCalled()
      expect(ctx.body.resolvedCommand).toBe('Inline')
    })

    it('fetches missing edges when only nodes provided', async () => {
      getWorkflowData.mockResolvedValue({
        nodes: {},
        edges: {e1: {source: 'n1', target: 'n2'}},
      })

      const clientNodes = {
        n1: makeNode('n1', {title: 'Client', command: 'Client'}),
      }
      const ctx = createMockCtx({
        nodeId: 'n1',
        workflowId: 'wf-123',
        workflowNodes: clientNodes,
      })
      await PreviewController.resolveReferences(ctx)

      expect(getWorkflowData).toHaveBeenCalledWith('wf-123')
      expect(ctx.body.resolvedCommand).toBe('Client')
    })

    it('fetches missing nodes when only edges provided', async () => {
      const dbNodes = {
        n1: makeNode('n1', {title: 'From DB', command: 'From DB'}),
      }
      getWorkflowData.mockResolvedValue({nodes: dbNodes, edges: {}})

      const ctx = createMockCtx({
        nodeId: 'n1',
        workflowId: 'wf-123',
        workflowEdges: {e1: {source: 'n1', target: 'n2'}},
      })
      await PreviewController.resolveReferences(ctx)

      expect(getWorkflowData).toHaveBeenCalledWith('wf-123')
      expect(ctx.body.resolvedCommand).toBe('From DB')
    })

    it('returns 404 when database workflow has no matching node', async () => {
      getWorkflowData.mockResolvedValue({
        nodes: {other: makeNode('other')},
        edges: {},
      })

      const ctx = createMockCtx({nodeId: 'missing', workflowId: 'wf-123'})
      await expect(PreviewController.resolveReferences(ctx)).rejects.toThrow('Node not found')
    })

    it('propagates database errors', async () => {
      getWorkflowData.mockRejectedValue(new Error('DB connection failed'))

      const ctx = createMockCtx({nodeId: 'n1', workflowId: 'wf-123'})
      await expect(PreviewController.resolveReferences(ctx)).rejects.toThrow('DB connection failed')
    })
  })

  describe('auth context', () => {
    it('passes userId from ctx.state to Store', async () => {
      const ctx = createMockCtx(
        {
          nodeId: 'n1',
          workflowNodes: {
            n1: makeNode('n1', {title: 'text', command: 'text'}),
          },
        },
        {userId: 'custom-user-42'},
      )
      await PreviewController.resolveReferences(ctx)
      expect(ctx.body.resolvedCommand).toBe('text')
    })
  })

  describe('combined @@ and ## resolution', () => {
    it('resolves both @@ references and ## hashrefs in same command', async () => {
      const refNode = makeRefNode('ref', 'myref', {
        content: 'RefContent',
        depth: 1,
        parent: 'root',
      })
      const hashNode = makeNode('hvar', {
        title: '#_link LinkedContent',
        parent: 'root',
        depth: 1,
      })
      const mainNode = makeNode('main', {
        title: '@@myref and ##_link',
        command: '@@myref and ##_link',
        parent: 'root',
        depth: 1,
      })
      const root = makeNode('root', {
        title: 'Root',
        depth: 0,
        children: ['ref', 'hvar', 'main'],
      })
      const ctx = createMockCtx({
        nodeId: 'main',
        workflowNodes: {main: mainNode, ref: refNode, hvar: hashNode, root},
      })
      await PreviewController.resolveReferences(ctx)
      expect(ctx.body.resolvedCommand).toContain('RefContent')
      expect(ctx.body.resolvedCommand).toContain('LinkedContent')
    })
  })
})
