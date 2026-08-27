import ElectTopology from './ElectTopology'
import Store from '../../commands/utils/Store'

jest.mock('debug', () => {
  const fn = jest.fn(() => fn)
  fn.extend = jest.fn(() => fn)
  return fn
})

const buildStore = nodeMap => new Store({userId: 'user1', nodes: nodeMap})

/*
 * All tree shapes use ASCII diagrams in comments. Depth values are relative
 * to the subtreeRoot passed into ElectTopology (depth=0 for root itself).
 */

describe('ElectTopology', () => {
  // Empty / trivial results

  describe('result is empty when no valid /elect cells exist', () => {
    it('empty tree (no children)', () => {
      const store = buildStore({root: {id: 'root', children: []}})
      expect(ElectTopology(store.getNode('root'), store)).toEqual([])
    })

    it('tree with only non-elect commands', () => {
      const store = buildStore({
        root: {id: 'root', children: ['chat', 'summarize']},
        chat: {
          id: 'chat',
          parent: 'root',
          command: '/chat do something',
          children: [],
        },
        summarize: {
          id: 'summarize',
          parent: 'root',
          command: '/summarize',
          children: [],
        },
      })
      expect(ElectTopology(store.getNode('root'), store)).toEqual([])
    })

    it('bare /elect (no :n=) is excluded — it is a parse-time error', () => {
      const store = buildStore({
        root: {id: 'root', children: ['r']},
        r: {id: 'r', parent: 'root', command: '/elect', children: []},
      })
      expect(ElectTopology(store.getNode('root'), store)).toEqual([])
    })

    it('/elect :n=1 is excluded — N below the minimum of 2', () => {
      const store = buildStore({
        root: {id: 'root', children: ['r']},
        r: {id: 'r', parent: 'root', command: '/elect :n=1', children: []},
      })
      expect(ElectTopology(store.getNode('root'), store)).toEqual([])
    })

    it('/refinement :n=3 is excluded — word-boundary mismatch', () => {
      const store = buildStore({
        root: {id: 'root', children: ['r']},
        r: {
          id: 'r',
          parent: 'root',
          command: '/refinement :n=3',
          children: [],
        },
      })
      expect(ElectTopology(store.getNode('root'), store)).toEqual([])
    })
  })

  // Entry shape

  describe('ElectEntry shape', () => {
    it('each entry exposes electNode, depth, n, and parallelGroup with correct types', () => {
      const store = buildStore({
        root: {id: 'root', children: ['r']},
        r: {id: 'r', parent: 'root', command: '/elect :n=3', children: []},
      })

      const [entry] = ElectTopology(store.getNode('root'), store)

      expect(entry).toMatchObject({
        electNode: expect.objectContaining({id: 'r'}),
        depth: expect.any(Number),
        n: expect.any(Number),
        parallelGroup: expect.any(Number),
      })
    })

    it('electNode is the actual node object from the store', () => {
      const store = buildStore({
        root: {id: 'root', children: ['r']},
        r: {id: 'r', parent: 'root', command: '/elect :n=2', children: []},
      })

      const [entry] = ElectTopology(store.getNode('root'), store)

      expect(entry.electNode).toBe(store.getNode('r'))
    })

    it('n matches the :n= value parsed from the cell command', () => {
      const store = buildStore({
        root: {id: 'root', children: ['r']},
        r: {id: 'r', parent: 'root', command: '/elect :n=7', children: []},
      })

      const [entry] = ElectTopology(store.getNode('root'), store)
      expect(entry.n).toBe(7)
    })

    it('command field takes precedence over title for command recognition', () => {
      const store = buildStore({
        root: {id: 'root', children: ['r']},
        r: {
          id: 'r',
          parent: 'root',
          command: '/elect :n=4',
          title: '/chat something else',
          children: [],
        },
      })

      const result = ElectTopology(store.getNode('root'), store)
      expect(result).toHaveLength(1)
      expect(result[0].n).toBe(4)
    })

    it('falls back to title when command is absent', () => {
      const store = buildStore({
        root: {id: 'root', children: ['r']},
        r: {id: 'r', parent: 'root', title: '/elect :n=2', children: []},
      })

      const result = ElectTopology(store.getNode('root'), store)
      expect(result).toHaveLength(1)
      expect(result[0].n).toBe(2)
    })

    it(':fallback flag does not affect n or inclusion', () => {
      const store = buildStore({
        root: {id: 'root', children: ['r']},
        r: {
          id: 'r',
          parent: 'root',
          command: '/elect :n=3 :fallback',
          children: [],
        },
      })

      const result = ElectTopology(store.getNode('root'), store)
      expect(result).toHaveLength(1)
      expect(result[0].n).toBe(3)
    })
  })

  // Depth measurement

  describe('depth is the distance from the subtreeRoot', () => {
    it('direct child of root has depth=1', () => {
      const store = buildStore({
        root: {id: 'root', children: ['r']},
        r: {id: 'r', parent: 'root', command: '/elect :n=2', children: []},
      })

      const [entry] = ElectTopology(store.getNode('root'), store)
      expect(entry.depth).toBe(1)
    })

    it('grandchild (2 hops from root) has depth=2', () => {
      const store = buildStore({
        root: {id: 'root', children: ['mid']},
        mid: {id: 'mid', parent: 'root', command: '/chat', children: ['r']},
        r: {id: 'r', parent: 'mid', command: '/elect :n=2', children: []},
      })

      const [entry] = ElectTopology(store.getNode('root'), store)
      expect(entry.depth).toBe(2)
    })

    it('node passed as subtreeRoot has depth=0', () => {
      const store = buildStore({
        r: {id: 'r', command: '/elect :n=2', children: []},
      })

      const [entry] = ElectTopology(store.getNode('r'), store)
      expect(entry.depth).toBe(0)
    })
  })

  // Deepest-first ordering

  describe('deepest-first ordering', () => {
    it('2-level nesting: inner before outer', () => {
      /*
       * root
       *   └── outer  (/elect :n=2, depth=1)
       *         └── inner  (/elect :n=3, depth=2)
       */
      const store = buildStore({
        root: {id: 'root', children: ['outer']},
        outer: {
          id: 'outer',
          parent: 'root',
          command: '/elect :n=2',
          children: ['inner'],
        },
        inner: {
          id: 'inner',
          parent: 'outer',
          command: '/elect :n=3',
          children: [],
        },
      })

      const result = ElectTopology(store.getNode('root'), store)

      expect(result.map(e => e.electNode.id)).toEqual(['inner', 'outer'])
    })

    it('3-level nesting: deepest first throughout', () => {
      /*
       * root
       *   └── r1  (depth=1)
       *         └── r2  (depth=2)
       *               └── r3  (depth=3)
       */
      const store = buildStore({
        root: {id: 'root', children: ['r1']},
        r1: {
          id: 'r1',
          parent: 'root',
          command: '/elect :n=2',
          children: ['r2'],
        },
        r2: {
          id: 'r2',
          parent: 'r1',
          command: '/elect :n=3',
          children: ['r3'],
        },
        r3: {id: 'r3', parent: 'r2', command: '/elect :n=4', children: []},
      })

      const result = ElectTopology(store.getNode('root'), store)

      expect(result.map(e => e.electNode.id)).toEqual(['r3', 'r2', 'r1'])
      expect(result.map(e => e.depth)).toEqual([3, 2, 1])
      expect(result.map(e => e.n)).toEqual([4, 3, 2])
    })

    it('mixed depths across branches: deepest of any branch is first', () => {
      /*
       * root
       *   ├── left   (/elect :n=2, depth=1)
       *   └── mid    (/chat, depth=1)
       *         └── deep   (/elect :n=5, depth=2)
       */
      const store = buildStore({
        root: {id: 'root', children: ['left', 'mid']},
        left: {
          id: 'left',
          parent: 'root',
          command: '/elect :n=2',
          children: [],
        },
        mid: {
          id: 'mid',
          parent: 'root',
          command: '/chat',
          children: ['deep'],
        },
        deep: {
          id: 'deep',
          parent: 'mid',
          command: '/elect :n=5',
          children: [],
        },
      })

      const result = ElectTopology(store.getNode('root'), store)

      expect(result[0].electNode.id).toBe('deep')
      expect(result[0].depth).toBe(2)
      expect(result[1].electNode.id).toBe('left')
      expect(result[1].depth).toBe(1)
    })
  })

  // Parallel groups

  describe('parallelGroup assignment', () => {
    it('a single entry receives parallelGroup=0', () => {
      const store = buildStore({
        root: {id: 'root', children: ['r']},
        r: {id: 'r', parent: 'root', command: '/elect :n=2', children: []},
      })

      const [entry] = ElectTopology(store.getNode('root'), store)
      expect(entry.parallelGroup).toBe(0)
    })

    it('two siblings at the same depth share one parallelGroup', () => {
      /*
       * root
       *   ├── rA  (depth=1)
       *   └── rB  (depth=1)
       */
      const store = buildStore({
        root: {id: 'root', children: ['rA', 'rB']},
        rA: {id: 'rA', parent: 'root', command: '/elect :n=2', children: []},
        rB: {id: 'rB', parent: 'root', command: '/elect :n=3', children: []},
      })

      const result = ElectTopology(store.getNode('root'), store)

      expect(result).toHaveLength(2)
      expect(result[0].parallelGroup).toBe(result[1].parallelGroup)
    })

    it('entries at different depths receive different parallelGroups', () => {
      const store = buildStore({
        root: {id: 'root', children: ['r1', 'chat']},
        r1: {id: 'r1', parent: 'root', command: '/elect :n=2', children: []},
        chat: {
          id: 'chat',
          parent: 'root',
          command: '/chat',
          children: ['r2'],
        },
        r2: {id: 'r2', parent: 'chat', command: '/elect :n=3', children: []},
      })

      const result = ElectTopology(store.getNode('root'), store)

      expect(result).toHaveLength(2)
      expect(result.find(e => e.depth === 2).parallelGroup).not.toBe(result.find(e => e.depth === 1).parallelGroup)
    })

    it('nodes at the same depth but under different parents share a parallelGroup', () => {
      /*
       * root
       *   ├── branchA  (/chat)
       *   │     └── rA  (/elect :n=2, depth=2)
       *   └── branchB  (/chat)
       *         └── rB  (/elect :n=3, depth=2)
       *
       * rA and rB are not siblings (different parents) but share depth=2 →
       * same parallelGroup, safe to run concurrently.
       */
      const store = buildStore({
        root: {id: 'root', children: ['branchA', 'branchB']},
        branchA: {
          id: 'branchA',
          parent: 'root',
          command: '/chat',
          children: ['rA'],
        },
        branchB: {
          id: 'branchB',
          parent: 'root',
          command: '/chat',
          children: ['rB'],
        },
        rA: {
          id: 'rA',
          parent: 'branchA',
          command: '/elect :n=2',
          children: [],
        },
        rB: {
          id: 'rB',
          parent: 'branchB',
          command: '/elect :n=3',
          children: [],
        },
      })

      const result = ElectTopology(store.getNode('root'), store)

      expect(result).toHaveLength(2)
      expect(result[0].parallelGroup).toBe(result[1].parallelGroup)
    })

    it('parallelGroup values form a compact sequence starting at 0 with no gaps', () => {
      /*
       * root
       *   ├── r1  (depth=1)
       *   ├── chat
       *   │     ├── r2A  (depth=2)
       *   │     └── r2B  (depth=2)
       *   └── chat2
       *         └── chat3
       *               └── r3  (depth=3)
       */
      const store = buildStore({
        root: {id: 'root', children: ['r1', 'chat', 'chat2']},
        r1: {id: 'r1', parent: 'root', command: '/elect :n=2', children: []},
        chat: {
          id: 'chat',
          parent: 'root',
          command: '/chat',
          children: ['r2A', 'r2B'],
        },
        r2A: {
          id: 'r2A',
          parent: 'chat',
          command: '/elect :n=3',
          children: [],
        },
        r2B: {
          id: 'r2B',
          parent: 'chat',
          command: '/elect :n=4',
          children: [],
        },
        chat2: {
          id: 'chat2',
          parent: 'root',
          command: '/chat',
          children: ['chat3'],
        },
        chat3: {
          id: 'chat3',
          parent: 'chat2',
          command: '/chat',
          children: ['r3'],
        },
        r3: {
          id: 'r3',
          parent: 'chat3',
          command: '/elect :n=5',
          children: [],
        },
      })

      const result = ElectTopology(store.getNode('root'), store)

      expect(result).toHaveLength(4)
      const groups = [...new Set(result.map(e => e.parallelGroup))].sort((a, b) => a - b)
      expect(groups[0]).toBe(0)
      expect(groups[groups.length - 1]).toBe(groups.length - 1)
    })

    it('deepest entries receive the lowest parallelGroup number', () => {
      /*
       * Deepest-first sort means deepest entries are assigned parallelGroup=0 first.
       */
      const store = buildStore({
        root: {id: 'root', children: ['r1', 'chat']},
        r1: {id: 'r1', parent: 'root', command: '/elect :n=2', children: []},
        chat: {
          id: 'chat',
          parent: 'root',
          command: '/chat',
          children: ['r2'],
        },
        r2: {id: 'r2', parent: 'chat', command: '/elect :n=3', children: []},
      })

      const result = ElectTopology(store.getNode('root'), store)

      const deepest = result.find(e => e.depth === 2)
      const shallow = result.find(e => e.depth === 1)
      expect(deepest.parallelGroup).toBeLessThan(shallow.parallelGroup)
    })
  })

  // Traversal completeness

  describe('traversal finds /elect cells at any depth through any node type', () => {
    it('traverses through /steps, /foreach, and /chat nodes', () => {
      /*
       * root
       *   └── steps (/steps)
       *         └── foreach (/foreach)
       *               └── chat (/chat)
       *                     └── r (/elect :n=2, depth=4)
       */
      const store = buildStore({
        root: {id: 'root', children: ['steps']},
        steps: {
          id: 'steps',
          parent: 'root',
          command: '/steps',
          children: ['foreach'],
        },
        foreach: {
          id: 'foreach',
          parent: 'steps',
          command: '/foreach',
          children: ['chat'],
        },
        chat: {
          id: 'chat',
          parent: 'foreach',
          command: '/chat',
          children: ['r'],
        },
        r: {id: 'r', parent: 'chat', command: '/elect :n=2', children: []},
      })

      const result = ElectTopology(store.getNode('root'), store)

      expect(result).toHaveLength(1)
      expect(result[0].electNode.id).toBe('r')
      expect(result[0].depth).toBe(4)
    })

    it('finds all /elect cells in a wide flat tree', () => {
      const children = ['r1', 'r2', 'r3', 'r4', 'r5']
      const nodes = {root: {id: 'root', children}}
      children.forEach(id => {
        nodes[id] = {
          id,
          parent: 'root',
          command: '/elect :n=2',
          children: [],
        }
      })

      const result = ElectTopology(buildStore(nodes).getNode('root'), buildStore(nodes))
      expect(result).toHaveLength(5)
      expect(result.every(e => e.depth === 1)).toBe(true)
      expect(result.every(e => e.parallelGroup === result[0].parallelGroup)).toBe(true)
    })

    it('collects elect cells from both branches of a forked tree', () => {
      /*
       * root
       *   ├── branchA
       *   │     └── rA  (/elect :n=2)
       *   └── branchB
       *         └── rB  (/elect :n=3)
       */
      const store = buildStore({
        root: {id: 'root', children: ['branchA', 'branchB']},
        branchA: {
          id: 'branchA',
          parent: 'root',
          command: '/chat',
          children: ['rA'],
        },
        rA: {
          id: 'rA',
          parent: 'branchA',
          command: '/elect :n=2',
          children: [],
        },
        branchB: {
          id: 'branchB',
          parent: 'root',
          command: '/chat',
          children: ['rB'],
        },
        rB: {
          id: 'rB',
          parent: 'branchB',
          command: '/elect :n=3',
          children: [],
        },
      })

      const result = ElectTopology(store.getNode('root'), store)
      const ids = result.map(e => e.electNode.id).sort()
      expect(ids).toEqual(['rA', 'rB'])
    })
  })

  // Robustness against malformed store state

  describe('robustness against malformed or incomplete store data', () => {
    it('does not throw when a node has no children field', () => {
      const store = buildStore({
        root: {id: 'root', children: ['chat', 'r']},
        chat: {id: 'chat', parent: 'root', command: '/chat'},
        r: {id: 'r', parent: 'root', command: '/elect :n=2', children: []},
      })

      const result = ElectTopology(store.getNode('root'), store)
      expect(result).toHaveLength(1)
      expect(result[0].electNode.id).toBe('r')
    })

    it('skips child IDs that do not resolve in the store and continues traversal', () => {
      const store = buildStore({
        root: {id: 'root', children: ['ghost', 'r']},
        r: {id: 'r', parent: 'root', command: '/elect :n=2', children: []},
      })

      const result = ElectTopology(store.getNode('root'), store)
      expect(result).toHaveLength(1)
      expect(result[0].electNode.id).toBe('r')
    })

    it('handles null subtreeRoot without throwing', () => {
      const store = buildStore({})
      expect(() => ElectTopology(null, store)).not.toThrow()
      expect(ElectTopology(null, store)).toEqual([])
    })

    it('handles undefined subtreeRoot without throwing', () => {
      const store = buildStore({})
      expect(() => ElectTopology(undefined, store)).not.toThrow()
      expect(ElectTopology(undefined, store)).toEqual([])
    })
  })
})
