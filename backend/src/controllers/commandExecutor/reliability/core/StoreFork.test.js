import StoreFork from './StoreFork'
import Store from '../../commands/utils/Store'

jest.mock('debug', () => {
  const fn = jest.fn(() => fn)
  fn.extend = jest.fn(() => fn)
  return fn
})

describe('StoreFork', () => {
  describe('createFork', () => {
    it('should create independent clone of store state', () => {
      const original = new Store({
        userId: 'user1',
        workflowId: 'wf1',
        nodes: {n1: {id: 'n1', title: 'Original', children: ['n2']}},
        edges: {e1: {id: 'e1', start: 'n1', end: 'n2'}},
        files: {f1: 'content1'},
      })

      const fork = StoreFork.createFork(original)

      expect(fork._userId).toBe('user1')
      expect(fork._workflowId).toBe('wf1')
      expect(fork._nodes).toEqual(original._nodes)
      expect(fork._edges).toEqual(original._edges)
      expect(fork._files).toEqual(original._files)

      expect(fork._nodes).not.toBe(original._nodes)
      expect(fork._edges).not.toBe(original._edges)
      expect(fork._files).not.toBe(original._files)
    })

    it('should isolate nested array mutations between fork and original', () => {
      const original = new Store({
        userId: 'user1',
        nodes: {
          n1: {id: 'n1', title: 'Original', children: ['n2'], prompts: ['p1'], tags: ['t1']},
        },
      })

      const fork = StoreFork.createFork(original)

      fork._nodes.n1.title = 'Modified in Fork'
      fork._nodes.n1.children.push('n3')
      fork._nodes.n1.prompts.push('p2')
      fork._nodes.n1.tags.push('t2')

      expect(original._nodes.n1.title).toBe('Original')
      expect(original._nodes.n1.children).toEqual(['n2'])
      expect(original._nodes.n1.prompts).toEqual(['p1'])
      expect(original._nodes.n1.tags).toEqual(['t1'])
    })

    it('should isolate nested object mutations between fork and original', () => {
      const original = new Store({
        userId: 'user1',
        nodes: {
          n1: {id: 'n1', title: 'Table', gridOptions: {columnDefs: [{field: 'name'}], rowData: [{name: 'row1'}]}},
        },
      })

      const fork = StoreFork.createFork(original)

      fork._nodes.n1.gridOptions.columnDefs.push({field: 'age'})
      fork._nodes.n1.gridOptions.rowData[0].name = 'modified'

      expect(original._nodes.n1.gridOptions.columnDefs).toEqual([{field: 'name'}])
      expect(original._nodes.n1.gridOptions.rowData[0].name).toBe('row1')
    })

    it('should clone empty store without errors', () => {
      const original = new Store({userId: 'user1'})

      const fork = StoreFork.createFork(original)

      expect(fork._userId).toBe('user1')
      expect(fork._nodes).toEqual({})
      expect(fork._edges).toEqual({})
      expect(fork._files).toEqual({})
      expect(fork._output.nodes).toEqual([])
      expect(fork._output.edges).toEqual([])
    })

    it('should preserve ImportHandler binding to forked store', () => {
      const original = new Store({
        userId: 'user1',
        nodes: {n1: {id: 'n1', title: 'Test'}},
      })

      const fork = StoreFork.createFork(original)

      expect(fork.importer).toBeDefined()
      expect(fork.importer.store).toBe(fork)
      expect(fork.importer.store).not.toBe(original)
    })

    it('should reset output arrays in fork', () => {
      const original = new Store({
        userId: 'user1',
        nodes: {n1: {id: 'n1', title: 'Test'}},
      })

      original.saveNodeToOutput('n1')
      original.saveEdgeToOutput('e1')

      const fork = StoreFork.createFork(original)

      expect(fork._output.nodes).toEqual([])
      expect(fork._output.edges).toEqual([])
      expect(original._output.nodes).toEqual(['n1'])
      expect(original._output.edges).toEqual(['e1'])
    })

    it('should handle store without workflowId', () => {
      const original = new Store({
        userId: 'user1',
        nodes: {n1: {id: 'n1', title: 'Test'}},
      })

      const fork = StoreFork.createFork(original)

      expect(fork._userId).toBe('user1')
      expect(fork._workflowId).toBeUndefined()
      expect(fork._nodes).toEqual(original._nodes)
    })
  })

  describe('applyCandidate', () => {
    it('should merge only new nodes from candidate output', () => {
      const target = new Store({
        userId: 'user1',
        nodes: {n1: {id: 'n1', title: 'Existing'}},
      })

      const candidate = new Store({
        userId: 'user1',
        nodes: {
          n1: {id: 'n1', title: 'Existing'},
          n2: {id: 'n2', title: 'New from candidate'},
        },
      })
      candidate.saveNodeToOutput('n2')

      StoreFork.applyCandidate(target, candidate, 'n1')

      expect(target._nodes.n2).toEqual({id: 'n2', title: 'New from candidate'})
      expect(target._output.nodes).toContain('n2')
    })

    it('should merge multiple new nodes from candidate output', () => {
      const target = new Store({userId: 'user1', nodes: {}})

      const candidate = new Store({
        userId: 'user1',
        nodes: {
          n1: {id: 'n1', title: 'Node 1'},
          n2: {id: 'n2', title: 'Node 2'},
          n3: {id: 'n3', title: 'Node 3'},
        },
      })
      candidate.saveNodeToOutput('n1')
      candidate.saveNodeToOutput('n2')
      candidate.saveNodeToOutput('n3')

      StoreFork.applyCandidate(target, candidate, 'cell')

      expect(target._nodes.n1).toEqual({id: 'n1', title: 'Node 1'})
      expect(target._nodes.n2).toEqual({id: 'n2', title: 'Node 2'})
      expect(target._nodes.n3).toEqual({id: 'n3', title: 'Node 3'})
      expect(target._output.nodes).toEqual(['n1', 'n2', 'n3'])
    })

    it('should not merge nodes not in candidate output', () => {
      const target = new Store({userId: 'user1', nodes: {}})

      const candidate = new Store({
        userId: 'user1',
        nodes: {
          n1: {id: 'n1', title: 'In output'},
          n2: {id: 'n2', title: 'Not in output'},
        },
      })
      candidate.saveNodeToOutput('n1')

      StoreFork.applyCandidate(target, candidate, 'cell')

      expect(target._nodes.n1).toBeDefined()
      expect(target._nodes.n2).toBeUndefined()
    })

    it('should merge only new edges from candidate output', () => {
      const target = new Store({
        userId: 'user1',
        edges: {},
      })

      const candidate = new Store({
        userId: 'user1',
        edges: {e1: {id: 'e1', start: 'n1', end: 'n2'}},
      })
      candidate.saveEdgeToOutput('e1')

      StoreFork.applyCandidate(target, candidate, 'n1')

      expect(target._edges.e1).toEqual({id: 'e1', start: 'n1', end: 'n2'})
      expect(target._output.edges).toContain('e1')
    })

    it('should not merge edges not in candidate output', () => {
      const target = new Store({userId: 'user1', edges: {}})

      const candidate = new Store({
        userId: 'user1',
        edges: {
          e1: {id: 'e1', start: 'n1', end: 'n2'},
          e2: {id: 'e2', start: 'n2', end: 'n3'},
        },
      })
      candidate.saveEdgeToOutput('e1')

      StoreFork.applyCandidate(target, candidate, 'cell')

      expect(target._edges.e1).toBeDefined()
      expect(target._edges.e2).toBeUndefined()
    })

    it('should merge new files without overwriting existing ones', () => {
      const target = new Store({
        userId: 'user1',
        files: {f1: 'original content'},
      })

      const candidate = new Store({
        userId: 'user1',
        files: {f1: 'should not overwrite', f2: 'new file'},
      })

      StoreFork.applyCandidate(target, candidate, 'n1')

      expect(target._files.f1).toBe('original content')
      expect(target._files.f2).toBe('new file')
    })

    it('should handle empty candidate files without errors', () => {
      const target = new Store({
        userId: 'user1',
        files: {f1: 'original'},
      })

      const candidate = new Store({userId: 'user1', files: {}})

      StoreFork.applyCandidate(target, candidate, 'cell')

      expect(target._files.f1).toBe('original')
    })

    it('should sync cell node state including children and prompts', () => {
      const target = new Store({
        userId: 'user1',
        nodes: {cell1: {id: 'cell1', title: 'Cell', children: [], prompts: []}},
      })

      const candidate = new Store({
        userId: 'user1',
        nodes: {cell1: {id: 'cell1', title: 'Cell', children: ['n2', 'n3'], prompts: ['p1']}},
      })

      StoreFork.applyCandidate(target, candidate, 'cell1')

      expect(target._nodes.cell1.children).toEqual(['n2', 'n3'])
      expect(target._nodes.cell1.prompts).toEqual(['p1'])
    })

    it('should handle missing cell node gracefully', () => {
      const target = new Store({userId: 'user1', nodes: {}})
      const candidate = new Store({userId: 'user1', nodes: {}})

      expect(() => StoreFork.applyCandidate(target, candidate, 'non-existent')).not.toThrow()
    })

    it('should rebind ImportHandler after merge', () => {
      const target = new Store({userId: 'user1'})
      const candidate = new Store({userId: 'user1'})

      const originalImporter = target.importer

      StoreFork.applyCandidate(target, candidate, 'cell1')

      expect(target.importer).not.toBe(originalImporter)
      expect(target.importer.store).toBe(target)
    })

    it('should handle complex merge with nodes, edges, and files', () => {
      const target = new Store({
        userId: 'user1',
        nodes: {existing: {id: 'existing', title: 'Existing Node'}},
        edges: {e0: {id: 'e0', start: 'a', end: 'b'}},
        files: {f0: 'existing file'},
      })

      const candidate = new Store({
        userId: 'user1',
        nodes: {
          cell: {id: 'cell', title: 'Cell', children: ['new1', 'new2']},
          new1: {id: 'new1', title: 'New Node 1'},
          new2: {id: 'new2', title: 'New Node 2'},
        },
        edges: {e1: {id: 'e1', start: 'new1', end: 'new2'}},
        files: {f1: 'new file'},
      })
      candidate.saveNodeToOutput('new1')
      candidate.saveNodeToOutput('new2')
      candidate.saveEdgeToOutput('e1')

      StoreFork.applyCandidate(target, candidate, 'cell')

      expect(target._nodes.existing).toBeDefined()
      expect(target._nodes.new1).toBeDefined()
      expect(target._nodes.new2).toBeDefined()
      expect(target._nodes.cell.children).toEqual(['new1', 'new2'])
      expect(target._edges.e0).toBeDefined()
      expect(target._edges.e1).toBeDefined()
      expect(target._files.f0).toBe('existing file')
      expect(target._files.f1).toBe('new file')
    })
  })
})
