import {buildExecutionResult, buildPreStoreErrorResult} from './ExecutorResponse'
import {generateNodeId} from '../../shared/utils/generateId'

jest.mock('../../shared/utils/generateId')

const makeStore = ({outputNodes = [], outputEdges = [], nodes = {}, files = {}, edges = {}} = {}) => ({
  getOutput: () => ({nodes: outputNodes, edges: outputEdges}),
  getNode: id => nodes[id],
  _nodes: nodes,
  _files: files,
  _edges: edges,
})

describe('buildPreStoreErrorResult', () => {
  const cell = {id: 'cell-1', command: '/test'}
  const error = new Error('something went wrong')

  beforeEach(() => {
    generateNodeId.mockReturnValue('generated-id')
  })

  describe('error node structure', () => {
    it('title carries Error: prefix followed by error message', () => {
      const {nodesChanged} = buildPreStoreErrorResult(cell, 'wf-1', error)
      expect(nodesChanged[0].title).toBe('Error: something went wrong')
    })

    it('id is taken from generateNodeId', () => {
      generateNodeId.mockReturnValueOnce('specific-id')
      const {nodesChanged} = buildPreStoreErrorResult(cell, 'wf-1', error)
      expect(nodesChanged[0].id).toBe('specific-id')
    })

    it('parent is cell.id', () => {
      const {nodesChanged} = buildPreStoreErrorResult(cell, 'wf-1', error)
      expect(nodesChanged[0].parent).toBe('cell-1')
    })

    it('children is empty array', () => {
      const {nodesChanged} = buildPreStoreErrorResult(cell, 'wf-1', error)
      expect(nodesChanged[0].children).toEqual([])
    })
  })

  describe('nodesChanged shape', () => {
    it('is an array', () => {
      const {nodesChanged} = buildPreStoreErrorResult(cell, 'wf-1', error)
      expect(Array.isArray(nodesChanged)).toBe(true)
    })

    it('contains exactly one node', () => {
      const {nodesChanged} = buildPreStoreErrorResult(cell, 'wf-1', error)
      expect(nodesChanged).toHaveLength(1)
    })
  })

  describe('response envelope', () => {
    it('edgesChanged is empty array', () => {
      const {edgesChanged} = buildPreStoreErrorResult(cell, 'wf-1', error)
      expect(edgesChanged).toEqual([])
    })

    it('workflowId is forwarded', () => {
      const {workflowId} = buildPreStoreErrorResult(cell, 'wf-42', error)
      expect(workflowId).toBe('wf-42')
    })

    it('null workflowId is forwarded as null', () => {
      const {workflowId} = buildPreStoreErrorResult(cell, null, error)
      expect(workflowId).toBeNull()
    })

    it('cell is forwarded by reference', () => {
      const {cell: returnedCell} = buildPreStoreErrorResult(cell, 'wf-1', error)
      expect(returnedCell).toBe(cell)
    })
  })

  describe('error message variants', () => {
    it('empty error message produces "Error: " title', () => {
      const {nodesChanged} = buildPreStoreErrorResult(cell, 'wf-1', new Error(''))
      expect(nodesChanged[0].title).toBe('Error: ')
    })

    it('message with special characters is preserved verbatim', () => {
      const msg = 'DB timeout: connection refused (code=ECONNREFUSED)'
      const {nodesChanged} = buildPreStoreErrorResult(cell, 'wf-1', new Error(msg))
      expect(nodesChanged[0].title).toBe(`Error: ${msg}`)
    })
  })

  describe('generateNodeId usage', () => {
    it('calls generateNodeId exactly once per invocation', () => {
      generateNodeId.mockClear()
      buildPreStoreErrorResult(cell, 'wf-1', error)
      expect(generateNodeId).toHaveBeenCalledTimes(1)
    })

    it('successive calls each invoke generateNodeId independently', () => {
      generateNodeId.mockReturnValueOnce('id-a').mockReturnValueOnce('id-b')
      const first = buildPreStoreErrorResult(cell, 'wf-1', error)
      const second = buildPreStoreErrorResult(cell, 'wf-1', error)
      expect(first.nodesChanged[0].id).toBe('id-a')
      expect(second.nodesChanged[0].id).toBe('id-b')
    })
  })
})

describe('buildExecutionResult', () => {
  const cell = {id: 'cell-a', command: '/chat'}
  const otherData = {cell, queryType: 'chat'}

  describe('node and edge extraction from store output', () => {
    it('nodesChanged comes from store.getOutput().nodes', () => {
      const node = {id: 'n1', title: 'hello'}
      const store = makeStore({outputNodes: [node]})
      const {nodesChanged} = buildExecutionResult(otherData, store, 'wf-1')
      expect(nodesChanged).toContain(node)
    })

    it('edgesChanged comes from store.getOutput().edges', () => {
      const edge = {id: 'e1', start: 'n1', end: 'n2'}
      const store = makeStore({outputEdges: [edge]})
      const {edgesChanged} = buildExecutionResult(otherData, store, 'wf-1')
      expect(edgesChanged).toContain(edge)
    })

    it('nodesChanged is empty array when store produced no output', () => {
      const store = makeStore()
      const {nodesChanged} = buildExecutionResult(otherData, store, 'wf-1')
      expect(nodesChanged).toEqual([])
    })

    it('edgesChanged is empty array when store produced no output', () => {
      const store = makeStore()
      const {edgesChanged} = buildExecutionResult(otherData, store, 'wf-1')
      expect(edgesChanged).toEqual([])
    })
  })

  describe('otherData passthrough', () => {
    it('spreads arbitrary otherData fields into result', () => {
      const store = makeStore()
      const data = {
        cell,
        queryType: 'chat',
        context: 'some context',
        prompt: 'hello',
      }
      const result = buildExecutionResult(data, store, 'wf-1')
      expect(result.context).toBe('some context')
      expect(result.prompt).toBe('hello')
    })

    it('workflowId argument overrides any workflowId present in otherData', () => {
      const store = makeStore()
      const data = {cell, workflowId: 'stale-id'}
      const result = buildExecutionResult(data, store, 'override-id')
      expect(result.workflowId).toBe('override-id')
    })
  })

  describe('cell resolution', () => {
    it('resolves cell from store using otherData.cell.id', () => {
      const storedCell = {id: 'cell-a', title: 'updated by command'}
      const store = makeStore({nodes: {'cell-a': storedCell}})
      const {cell: resultCell} = buildExecutionResult(otherData, store, 'wf-1')
      expect(resultCell).toBe(storedCell)
    })

    it('cell is undefined when store has no node matching otherData.cell.id', () => {
      const store = makeStore({nodes: {}})
      const {cell: resultCell} = buildExecutionResult(otherData, store, 'wf-1')
      expect(resultCell).toBeUndefined()
    })
  })

  describe('store state snapshot', () => {
    it('workflowNodes is store._nodes by reference', () => {
      const nodes = {n1: {id: 'n1'}}
      const store = makeStore({nodes})
      const {workflowNodes} = buildExecutionResult(otherData, store, 'wf-1')
      expect(workflowNodes).toBe(nodes)
    })

    it('workflowFiles is store._files by reference', () => {
      const files = {f1: 'content'}
      const store = makeStore({files})
      const {workflowFiles} = buildExecutionResult(otherData, store, 'wf-1')
      expect(workflowFiles).toBe(files)
    })

    it('workflowEdges is store._edges by reference', () => {
      const edges = {e1: {id: 'e1'}}
      const store = makeStore({edges})
      const {workflowEdges} = buildExecutionResult(otherData, store, 'wf-1')
      expect(workflowEdges).toBe(edges)
    })
  })

  describe('workflowId forwarding', () => {
    it('forwards provided workflowId', () => {
      const store = makeStore()
      const {workflowId} = buildExecutionResult(otherData, store, 'wf-99')
      expect(workflowId).toBe('wf-99')
    })

    it('null workflowId is forwarded as null', () => {
      const store = makeStore()
      const {workflowId} = buildExecutionResult(otherData, store, null)
      expect(workflowId).toBeNull()
    })
  })
})
