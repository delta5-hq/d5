import OwnershipResolver, {UNOWNED, ValidateChildrenError} from './OwnershipResolver'
import Store from '../../commands/utils/Store'

jest.mock('debug', () => {
  const fn = jest.fn(() => fn)
  fn.extend = jest.fn(() => fn)
  return fn
})

const buildStore = nodeMap => new Store({userId: 'user1', nodes: nodeMap})

describe('OwnershipResolver', () => {
  describe('empty / no /validate cells → empty map', () => {
    it('returns empty map for empty tree', () => {
      const store = buildStore({root: {id: 'root', children: []}})
      expect(OwnershipResolver(store.getNode('root'), store).size).toBe(0)
    })

    it('returns empty map when tree has only /chat and /refine nodes', () => {
      const store = buildStore({
        root: {id: 'root', children: ['chat', 'r']},
        chat: {id: 'chat', parent: 'root', command: '/chat do x', children: []},
        r: {id: 'r', parent: 'root', command: '/refine :n=2', children: []},
      })
      expect(OwnershipResolver(store.getNode('root'), store).size).toBe(0)
    })

    it('handles null subtreeRoot without throwing', () => {
      const store = buildStore({})
      expect(() => OwnershipResolver(null, store)).not.toThrow()
      expect(OwnershipResolver(null, store).size).toBe(0)
    })

    it('handles undefined subtreeRoot without throwing', () => {
      const store = buildStore({})
      expect(() => OwnershipResolver(undefined, store)).not.toThrow()
    })
  })

  describe('/validate with no enclosing /refine ancestor → UNOWNED bucket', () => {
    it('assigns /validate to UNOWNED when it has no /refine ancestor', () => {
      /*
       * root
       *   ├── chat (/chat)
       *   └── v (/validate must include numbers)
       */
      const store = buildStore({
        root: {id: 'root', children: ['chat', 'v']},
        chat: {id: 'chat', parent: 'root', command: '/chat', children: []},
        v: {id: 'v', parent: 'root', command: '/validate must include numbers', children: []},
      })
      const map = OwnershipResolver(store.getNode('root'), store)
      expect(map.has(UNOWNED)).toBe(true)
      expect(map.get(UNOWNED).map(n => n.id)).toEqual(['v'])
    })

    it('UNOWNED bucket can hold multiple /validate cells', () => {
      const store = buildStore({
        root: {id: 'root', children: ['v1', 'v2']},
        v1: {id: 'v1', parent: 'root', command: '/validate criterion A', children: []},
        v2: {id: 'v2', parent: 'root', command: '/validate criterion B', children: []},
      })
      const map = OwnershipResolver(store.getNode('root'), store)
      expect(map.get(UNOWNED)).toHaveLength(2)
    })
  })

  describe('ownership rule: nearest enclosing /refine ancestor', () => {
    it('/validate nested directly under /refine parent is owned by that /refine', () => {
      /*
       * parent (/chat)
       *   ├── r (/refine :n=3)
       *   └── v (/validate criterion)
       *
       * v's parent chain: v → parent (not /refine) → root (not /refine) → null
       * → UNOWNED
       *
       * Note: /refine is a sibling of /validate here, not an ancestor.
       */
      const store = buildStore({
        root: {id: 'root', children: ['parent']},
        parent: {id: 'parent', parent: 'root', command: '/chat', children: ['r', 'v']},
        r: {id: 'r', parent: 'parent', command: '/refine :n=3', children: []},
        v: {id: 'v', parent: 'parent', command: '/validate criterion', children: []},
      })
      const map = OwnershipResolver(store.getNode('root'), store)
      expect(map.has(UNOWNED)).toBe(true)
      expect(map.get(UNOWNED).map(n => n.id)).toEqual(['v'])
      expect(map.has('r')).toBe(false)
    })

    it('/validate that IS inside a /refine node (as child of /refine) is owned by that /refine', () => {
      /*
       * refineNode (/refine :n=3)
       *   └── v (/validate criterion)
       *
       * v's parent chain: v → refineNode (isValidRefineCell → yes)
       * → owned by refineNode
       */
      const store = buildStore({
        root: {id: 'root', children: ['refineNode']},
        refineNode: {id: 'refineNode', parent: 'root', command: '/refine :n=3', children: ['v']},
        v: {id: 'v', parent: 'refineNode', command: '/validate criterion', children: []},
      })
      const map = OwnershipResolver(store.getNode('root'), store)
      expect(map.has('refineNode')).toBe(true)
      expect(map.get('refineNode').map(n => n.id)).toEqual(['v'])
    })

    it('nearest-enclosing rule: inner /refine wins over outer /refine', () => {
      /*
       * outerR (/refine :n=2)
       *   └── innerR (/refine :n=3)
       *         └── v (/validate)
       *
       * v's parent chain: v → innerR (isValidRefineCell → yes) → owned by innerR
       */
      const store = buildStore({
        outerR: {id: 'outerR', command: '/refine :n=2', children: ['innerR']},
        innerR: {id: 'innerR', parent: 'outerR', command: '/refine :n=3', children: ['v']},
        v: {id: 'v', parent: 'innerR', command: '/validate criterion', children: []},
      })
      const map = OwnershipResolver(store.getNode('outerR'), store)
      expect(map.has('innerR')).toBe(true)
      expect(map.get('innerR').map(n => n.id)).toEqual(['v'])
      expect(map.has('outerR')).toBe(false)
    })

    it('/validate deeper in the subtree: walks up to find nearest /refine', () => {
      /*
       * refineNode (/refine :n=3)
       *   └── chatChild (/chat)
       *         └── v (/validate criterion)
       *
       * v's parent chain: v → chatChild → refineNode (yes) → owned by refineNode
       */
      const store = buildStore({
        root: {id: 'root', children: ['refineNode']},
        refineNode: {id: 'refineNode', parent: 'root', command: '/refine :n=3', children: ['chatChild']},
        chatChild: {id: 'chatChild', parent: 'refineNode', command: '/chat', children: ['v']},
        v: {id: 'v', parent: 'chatChild', command: '/validate criterion', children: []},
      })
      const map = OwnershipResolver(store.getNode('root'), store)
      expect(map.has('refineNode')).toBe(true)
      expect(map.get('refineNode').map(n => n.id)).toEqual(['v'])
    })
  })

  describe('acceptance test: 4-validate subtree with one nested /refine', () => {
    it('produces correct owner map', () => {
      /*
       * root
       *   ├── outerR (/refine :n=2)
       *   │     ├── vA (/validate A)       ← owned by outerR
       *   │     ├── chat (/chat)
       *   │     │     └── vB (/validate B) ← owned by outerR (no inner /refine)
       *   │     └── innerR (/refine :n=3)
       *   │           └── vC (/validate C) ← owned by innerR (nearest)
       *   └── vD (/validate D)             ← UNOWNED
       */
      const store = buildStore({
        root: {id: 'root', children: ['outerR', 'vD']},
        outerR: {id: 'outerR', parent: 'root', command: '/refine :n=2', children: ['vA', 'chat', 'innerR']},
        vA: {id: 'vA', parent: 'outerR', command: '/validate criterion A', children: []},
        chat: {id: 'chat', parent: 'outerR', command: '/chat', children: ['vB']},
        vB: {id: 'vB', parent: 'chat', command: '/validate criterion B', children: []},
        innerR: {id: 'innerR', parent: 'outerR', command: '/refine :n=3', children: ['vC']},
        vC: {id: 'vC', parent: 'innerR', command: '/validate criterion C', children: []},
        vD: {id: 'vD', parent: 'root', command: '/validate criterion D', children: []},
      })

      const map = OwnershipResolver(store.getNode('root'), store)

      expect(
        map
          .get('outerR')
          .map(n => n.id)
          .sort(),
      ).toEqual(['vA', 'vB'])
      expect(map.get('innerR').map(n => n.id)).toEqual(['vC'])
      expect(map.get(UNOWNED).map(n => n.id)).toEqual(['vD'])
    })
  })

  describe('each /validate is consumed exactly once (no bubbling to outer /refine)', () => {
    it('/validate owned by inner /refine is NOT in outer /refine bucket', () => {
      const store = buildStore({
        outerR: {id: 'outerR', command: '/refine :n=2', children: ['innerR']},
        innerR: {id: 'innerR', parent: 'outerR', command: '/refine :n=3', children: ['v']},
        v: {id: 'v', parent: 'innerR', command: '/validate', children: []},
      })
      const map = OwnershipResolver(store.getNode('outerR'), store)
      expect(map.has('outerR')).toBe(false)
      expect(map.get('innerR').map(n => n.id)).toEqual(['v'])
    })
  })

  describe('multiple /validates owned by the same /refine', () => {
    it('all are collected under that /refine key', () => {
      const store = buildStore({
        refineNode: {id: 'refineNode', command: '/refine :n=2', children: ['v1', 'v2', 'v3']},
        v1: {id: 'v1', parent: 'refineNode', command: '/validate A', children: []},
        v2: {id: 'v2', parent: 'refineNode', command: '/validate B', children: []},
        v3: {id: 'v3', parent: 'refineNode', command: '/validate C', children: []},
      })
      const map = OwnershipResolver(store.getNode('refineNode'), store)
      expect(map.get('refineNode')).toHaveLength(3)
    })
  })

  describe('/validate with children → throws ValidateChildrenError', () => {
    it('throws when a /validate node has children', () => {
      const store = buildStore({
        root: {id: 'root', children: ['v']},
        v: {id: 'v', parent: 'root', command: '/validate criterion', children: ['child']},
        child: {id: 'child', parent: 'v', command: '/chat', children: []},
      })
      expect(() => OwnershipResolver(store.getNode('root'), store)).toThrow(ValidateChildrenError)
    })

    it('error message names the offending node id', () => {
      const store = buildStore({
        root: {id: 'root', children: ['badValidate']},
        badValidate: {
          id: 'badValidate',
          parent: 'root',
          command: '/validate criterion',
          children: ['child'],
        },
        child: {id: 'child', parent: 'badValidate', command: '/chat', children: []},
      })
      expect(() => OwnershipResolver(store.getNode('root'), store)).toThrow(/node 'badValidate'/)
    })

    it('throws even when the /validate has a /refine ancestor', () => {
      const store = buildStore({
        r: {id: 'r', command: '/refine :n=2', children: ['v']},
        v: {id: 'v', parent: 'r', command: '/validate criterion', children: ['child']},
        child: {id: 'child', parent: 'v', command: '/chat', children: []},
      })
      expect(() => OwnershipResolver(store.getNode('r'), store)).toThrow(ValidateChildrenError)
    })
  })

  describe('robustness', () => {
    it('skips child IDs that do not resolve in store', () => {
      const store = buildStore({
        root: {id: 'root', children: ['ghost', 'v']},
        v: {id: 'v', parent: 'root', command: '/validate criterion', children: []},
      })
      const map = OwnershipResolver(store.getNode('root'), store)
      expect(map.get(UNOWNED).map(n => n.id)).toEqual(['v'])
    })

    it('bare /refine (no :n=) is not a valid /refine ancestor — /validate becomes UNOWNED', () => {
      const store = buildStore({
        bareRefine: {id: 'bareRefine', command: '/refine', children: ['v']},
        v: {id: 'v', parent: 'bareRefine', command: '/validate criterion', children: []},
      })
      const map = OwnershipResolver(store.getNode('bareRefine'), store)
      expect(map.has(UNOWNED)).toBe(true)
      expect(map.get(UNOWNED).map(n => n.id)).toEqual(['v'])
    })
  })
})

describe('ValidateChildrenError message structure', () => {
  it('error message contains the offending node id and child count', () => {
    const store = buildStore({
      root: {id: 'root', children: ['v']},
      v: {id: 'v', parent: 'root', command: '/validate criterion', children: ['c1', 'c2']},
      c1: {id: 'c1', parent: 'v', command: '/chat', children: []},
      c2: {id: 'c2', parent: 'v', command: '/chat', children: []},
    })
    let thrown
    try {
      OwnershipResolver(store.getNode('root'), store)
    } catch (e) {
      thrown = e
    }
    expect(thrown).toBeInstanceOf(ValidateChildrenError)
    expect(thrown.message).toMatch(/node 'v'/)
    expect(thrown.message).toMatch(/2/)
    expect(thrown.nodeId).toBe('v')
  })
})

describe('robustness: /validate node with null or missing children field', () => {
  it('/validate with null children is treated as a leaf node (no error)', () => {
    const store = buildStore({
      root: {id: 'root', children: ['v']},
      v: {id: 'v', parent: 'root', command: '/validate criterion', children: null},
    })
    expect(() => OwnershipResolver(store.getNode('root'), store)).not.toThrow()
    const map = OwnershipResolver(store.getNode('root'), store)
    expect(map.get(UNOWNED).map(n => n.id)).toEqual(['v'])
  })

  it('/validate with absent children field is treated as a leaf node (no error)', () => {
    const store = buildStore({
      root: {id: 'root', children: ['v']},
      v: {id: 'v', parent: 'root', command: '/validate criterion'},
    })
    expect(() => OwnershipResolver(store.getNode('root'), store)).not.toThrow()
    const map = OwnershipResolver(store.getNode('root'), store)
    expect(map.get(UNOWNED).map(n => n.id)).toEqual(['v'])
  })
})
