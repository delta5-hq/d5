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
          n1: {
            id: 'n1',
            title: 'Original',
            children: ['n2'],
            prompts: ['p1'],
            tags: ['t1'],
          },
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
          n1: {
            id: 'n1',
            title: 'Table',
            gridOptions: {
              columnDefs: [{field: 'name'}],
              rowData: [{name: 'row1'}],
            },
          },
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

    it.each([
      ['empty cache', null],
      ['map cache', new Map([['scope-key', {model: 'OpenAI'}]])],
      ['keyed object cache', {key: 'scope-key', settings: {model: 'OpenAI'}}],
    ])('should preserve the request-scoped integration settings cache: %s', (_caseName, cache) => {
      const original = new Store({userId: 'user1', workflowId: 'wf1'})
      original._integrationSettingsCache = cache

      const fork = StoreFork.createFork(original)

      expect(fork._integrationSettingsCache).toBe(cache)
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

    describe('withinForkExecution — commodity re-fork suppression contract', () => {
      it('Store defaults withinForkExecution to false before any fork operation', () => {
        expect(new Store({userId: 'user1'}).withinForkExecution).toBe(false)
      })

      it('createFork marks the fork store as withinForkExecution', () => {
        const original = new Store({userId: 'user1'})
        const fork = StoreFork.createFork(original)
        expect(fork.withinForkExecution).toBe(true)
      })

      it('createFork does not mutate the source store — withinForkExecution stays false on original', () => {
        const original = new Store({userId: 'user1'})
        StoreFork.createFork(original)
        expect(original.withinForkExecution).toBe(false)
      })

      it('fork of a fork also has withinForkExecution true (nested fork depth)', () => {
        const original = new Store({userId: 'user1'})
        const fork = StoreFork.createFork(original)
        const deepFork = StoreFork.createFork(fork)
        expect(deepFork.withinForkExecution).toBe(true)
      })
    })

    describe('memory guard', () => {
      let warnSpy

      beforeEach(() => {
        warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
      })

      afterEach(() => {
        warnSpy.mockRestore()
      })

      it('should warn when node count exceeds threshold', () => {
        const nodes = {}
        for (let i = 0; i < StoreFork.FORK_WARN_THRESHOLD + 1; i++) {
          nodes[`n${i}`] = {id: `n${i}`, title: `Node ${i}`}
        }
        const store = new Store({userId: 'user1', nodes})

        StoreFork.createFork(store)

        expect(warnSpy).toHaveBeenCalledTimes(1)
        expect(warnSpy.mock.calls[0][0]).toContain(`${StoreFork.FORK_WARN_THRESHOLD + 1} nodes`)
      })

      it('should not warn when node count is exactly at threshold', () => {
        const nodes = {}
        for (let i = 0; i < StoreFork.FORK_WARN_THRESHOLD; i++) {
          nodes[`n${i}`] = {id: `n${i}`, title: `Node ${i}`}
        }
        const store = new Store({userId: 'user1', nodes})

        StoreFork.createFork(store)

        expect(warnSpy).not.toHaveBeenCalled()
      })

      it('should not warn for typical small workflows', () => {
        const store = new Store({
          userId: 'user1',
          nodes: {n1: {id: 'n1', title: 'test'}},
        })

        StoreFork.createFork(store)

        expect(warnSpy).not.toHaveBeenCalled()
      })

      it('should not warn for empty store', () => {
        const store = new Store({userId: 'user1'})

        StoreFork.createFork(store)

        expect(warnSpy).not.toHaveBeenCalled()
      })
    })
  })

  describe('applyCandidate — full subtree transfer', () => {
    it('transfers all nodes reachable from cellId in candidate', () => {
      const target = new Store({userId: 'user1', nodes: {}})

      const candidate = new Store({
        userId: 'user1',
        nodes: {
          cell: {
            id: 'cell',
            title: 'Cell',
            children: ['n1', 'n2'],
            prompts: [],
          },
          n1: {id: 'n1', parent: 'cell', title: 'Child 1', children: []},
          n2: {id: 'n2', parent: 'cell', title: 'Child 2', children: ['n3']},
          n3: {id: 'n3', parent: 'n2', title: 'Grandchild', children: []},
        },
      })

      StoreFork.applyCandidate(target, candidate, 'cell')

      expect(target._nodes.cell).toBeDefined()
      expect(target._nodes.n1).toBeDefined()
      expect(target._nodes.n2).toBeDefined()
      expect(target._nodes.n3).toBeDefined()
    })

    it('does not transfer nodes not reachable from cellId', () => {
      const target = new Store({userId: 'user1', nodes: {}})

      const candidate = new Store({
        userId: 'user1',
        nodes: {
          cell: {id: 'cell', title: 'Cell', children: ['n1'], prompts: []},
          n1: {id: 'n1', parent: 'cell', title: 'In subtree', children: []},
          orphan: {id: 'orphan', title: 'Not in subtree', children: []},
        },
      })

      StoreFork.applyCandidate(target, candidate, 'cell')

      expect(target._nodes.n1).toBeDefined()
      expect(target._nodes.orphan).toBeUndefined()
    })

    it('syncs cell node children and prompts', () => {
      const target = new Store({
        userId: 'user1',
        nodes: {
          cell: {id: 'cell', title: 'Cell', children: [], prompts: []},
        },
      })

      const candidate = new Store({
        userId: 'user1',
        nodes: {
          cell: {
            id: 'cell',
            title: 'Cell',
            children: ['n1', 'n2'],
            prompts: ['p1'],
          },
          n1: {id: 'n1', parent: 'cell', title: 'Child 1', children: []},
          n2: {id: 'n2', parent: 'cell', title: 'Child 2', children: []},
          p1: {id: 'p1', parent: 'cell', title: 'Prompt', children: []},
        },
      })

      StoreFork.applyCandidate(target, candidate, 'cell')

      expect(target._nodes.cell.children).toEqual(['n1', 'n2'])
      expect(target._nodes.cell.prompts).toEqual(['p1'])
      expect(target._nodes.n1).toBeDefined()
      expect(target._nodes.p1).toBeDefined()
    })

    it('transfers edges between subtree nodes', () => {
      const target = new Store({userId: 'user1', edges: {}})

      const candidate = new Store({
        userId: 'user1',
        nodes: {
          cell: {id: 'cell', children: ['n1']},
          n1: {id: 'n1', parent: 'cell', children: []},
        },
        edges: {
          e1: {id: 'e1', start: 'cell', end: 'n1'},
          e2: {id: 'e2', start: 'outsider', end: 'other'},
        },
      })

      StoreFork.applyCandidate(target, candidate, 'cell')

      expect(target._edges.e1).toBeDefined()
      expect(target._edges.e2).toBeUndefined()
    })

    it('transfers new files without overwriting existing ones', () => {
      const target = new Store({
        userId: 'user1',
        files: {f1: 'original content'},
      })

      const candidate = new Store({
        userId: 'user1',
        nodes: {cell: {id: 'cell', children: []}},
        files: {f1: 'should not overwrite', f2: 'new file'},
      })

      StoreFork.applyCandidate(target, candidate, 'cell')

      expect(target._files.f1).toBe('original content')
      expect(target._files.f2).toBe('new file')
    })

    it('handles missing cellId in candidate gracefully', () => {
      const target = new Store({userId: 'user1', nodes: {}})
      const candidate = new Store({userId: 'user1', nodes: {}})

      expect(() => StoreFork.applyCandidate(target, candidate, 'non-existent')).not.toThrow()
    })

    it('rebinds ImportHandler after transfer', () => {
      const target = new Store({userId: 'user1'})
      const candidate = new Store({
        userId: 'user1',
        nodes: {cell: {id: 'cell', children: []}},
      })

      const originalImporter = target.importer

      StoreFork.applyCandidate(target, candidate, 'cell')

      expect(target.importer).not.toBe(originalImporter)
      expect(target.importer.store).toBe(target)
    })

    it('P0.10a acceptance: /steps → /chat → /summarize subtree fully transferred', () => {
      const target = new Store({
        userId: 'user1',
        nodes: {
          steps: {
            id: 'steps',
            command: '/steps',
            children: ['chat', 'refine'],
          },
          chat: {id: 'chat', parent: 'steps', command: '/chat', children: []},
          refine: {
            id: 'refine',
            parent: 'steps',
            command: '/refine :n=2',
            children: [],
          },
        },
      })

      const candidate = new Store({
        userId: 'user1',
        nodes: {
          steps: {
            id: 'steps',
            command: '/steps',
            children: ['chat', 'refine', 'sum'],
          },
          chat: {
            id: 'chat',
            parent: 'steps',
            command: '/chat',
            children: ['out1'],
          },
          out1: {
            id: 'out1',
            parent: 'chat',
            title: 'LLM output',
            children: [],
          },
          sum: {
            id: 'sum',
            parent: 'steps',
            command: '/summarize',
            children: ['sumOut'],
          },
          sumOut: {
            id: 'sumOut',
            parent: 'sum',
            title: 'Summary output',
            children: [],
          },
          refine: {
            id: 'refine',
            parent: 'steps',
            command: '/refine :n=2',
            children: [],
          },
        },
        edges: {
          e1: {id: 'e1', start: 'chat', end: 'out1'},
          e2: {id: 'e2', start: 'sum', end: 'sumOut'},
        },
      })

      StoreFork.applyCandidate(target, candidate, 'steps')

      // All subtree nodes transferred
      expect(target._nodes.steps).toBeDefined()
      expect(target._nodes.chat).toBeDefined()
      expect(target._nodes.out1).toBeDefined()
      expect(target._nodes.sum).toBeDefined()
      expect(target._nodes.sumOut).toBeDefined()
      expect(target._nodes.refine).toBeDefined()

      // Edges transferred
      expect(target._edges.e1).toBeDefined()
      expect(target._edges.e2).toBeDefined()

      // No orphaned nodes — steps.children updated
      expect(target._nodes.steps.children).toContain('sum')
    })

    it('traverses a candidate node with absent children and prompts arrays without error', () => {
      const target = new Store({userId: 'user1', nodes: {}})
      const candidate = new Store({
        userId: 'user1',
        nodes: {cell: {id: 'cell', title: 'Leaf with no arrays'}},
      })
      StoreFork.applyCandidate(target, candidate, 'cell')
      expect(target._nodes.cell).toBeDefined()
      expect(target._nodes.cell.title).toBe('Leaf with no arrays')
    })
  })

  describe('deepClone — structuredClone availability', () => {
    it('delegates to structuredClone when it is available in the runtime', () => {
      const saved = global.structuredClone
      const spy = jest.fn(obj => JSON.parse(JSON.stringify(obj)))
      global.structuredClone = spy
      try {
        const original = new Store({userId: 'user1', nodes: {n1: {id: 'n1', title: 'T', nested: {x: 1}}}})
        StoreFork.createFork(original)
        expect(spy).toHaveBeenCalled()
      } finally {
        global.structuredClone = saved
      }
    })
  })

  describe('applyCandidate — cycle and shared-node safety', () => {
    it('visits a shared node only once when it is reachable from multiple parents', () => {
      const target = new Store({userId: 'user1', nodes: {}})
      const candidate = new Store({
        userId: 'user1',
        nodes: {
          cell: {id: 'cell', title: 'Root', children: ['left', 'shared'], prompts: []},
          left: {id: 'left', title: 'Left', children: ['shared'], prompts: []},
          shared: {id: 'shared', title: 'Shared', children: [], prompts: []},
        },
      })
      StoreFork.applyCandidate(target, candidate, 'cell')
      expect(Object.keys(target._nodes)).toEqual(expect.arrayContaining(['cell', 'left', 'shared']))
      expect(Object.keys(target._nodes)).toHaveLength(3)
    })
  })

  describe('deepClone environment fallback', () => {
    it('falls back to JSON.parse clone when structuredClone is unavailable', () => {
      const saved = global.structuredClone
      try {
        delete global.structuredClone
        const original = new Store({userId: 'user1', nodes: {n1: {id: 'n1', title: 'Before', nested: {x: 1}}}})
        const fork = StoreFork.createFork(original)
        fork._nodes.n1.title = 'After'
        fork._nodes.n1.nested.x = 99
        expect(original._nodes.n1.title).toBe('Before')
        expect(original._nodes.n1.nested.x).toBe(1)
      } finally {
        global.structuredClone = saved
      }
    })
  })
})
