import {projectForkCost} from './forkCostProjector'
import Store from '../../commands/utils/Store'

jest.mock('debug', () => {
  const fn = jest.fn(() => fn)
  fn.extend = jest.fn(() => fn)
  return fn
})

const buildStore = nodeMap => new Store({userId: 'user1', nodes: nodeMap})

/*
 * Cost model: Σ Nᵢ × Sᵢ (additive in depth)
 *   Sᵢ = number of executable nodes in /refine-i's immediate scope
 *          (the /refine cell itself is excluded; nested /refine zones are boundaries)
 *   Nested /refine costs are added once, NOT multiplied by outer N
 */

describe('projectForkCost', () => {
  describe('degenerate inputs → 0', () => {
    it('returns 0 when refineNode has no :n= param', () => {
      const store = buildStore({
        parent: {id: 'parent', command: '/chat', children: ['r']},
        r: {id: 'r', parent: 'parent', command: '/refine', children: []},
      })
      expect(projectForkCost(store.getNode('r'), store)).toBe(0)
    })

    it('returns 0 when :n= is below the minimum of 2', () => {
      const store = buildStore({
        parent: {id: 'parent', command: '/chat', children: ['r']},
        r: {id: 'r', parent: 'parent', command: '/refine :n=1', children: []},
      })
      expect(projectForkCost(store.getNode('r'), store)).toBe(0)
    })

    it('returns 0 when refineNode has no parent field', () => {
      const store = buildStore({
        r: {id: 'r', command: '/refine :n=3', children: []},
      })
      expect(projectForkCost(store.getNode('r'), store)).toBe(0)
    })

    it('returns 0 when parent id does not resolve in store', () => {
      const store = buildStore({
        r: {id: 'r', parent: 'ghost', command: '/refine :n=3', children: []},
      })
      expect(projectForkCost(store.getNode('r'), store)).toBe(0)
    })

    it('returns 0 for null refineNode', () => {
      const store = buildStore({})
      expect(projectForkCost(null, store)).toBe(0)
    })

    it('returns 0 for undefined refineNode', () => {
      const store = buildStore({})
      expect(projectForkCost(undefined, store)).toBe(0)
    })
  })

  describe('flat subtree (no nesting)', () => {
    it('acceptance test: /refine :n=10 on a 3-node subtree → 30', () => {
      /*
       * parent (/chat)     ← 1
       *   ├── chatA        ← 2
       *   ├── chatB        ← 3
       *   └── /refine :n=10   ← excluded (the refine cell itself)
       *
       * scope = 3, cost = 10 × 3 = 30
       */
      const store = buildStore({
        parent: {id: 'parent', command: '/chat', children: ['chatA', 'chatB', 'refine']},
        chatA: {id: 'chatA', parent: 'parent', command: '/chat a', children: []},
        chatB: {id: 'chatB', parent: 'parent', command: '/chat b', children: []},
        refine: {id: 'refine', parent: 'parent', command: '/refine :n=10', children: []},
      })
      expect(projectForkCost(store.getNode('refine'), store)).toBe(30)
    })

    it('parent alone (no non-refine children): N × 1', () => {
      /*
       * parent (/chat)   ← 1
       *   └── /refine :n=5   ← excluded
       *
       * scope = 1, cost = 5 × 1 = 5
       */
      const store = buildStore({
        parent: {id: 'parent', command: '/chat', children: ['refine']},
        refine: {id: 'refine', parent: 'parent', command: '/refine :n=5', children: []},
      })
      expect(projectForkCost(store.getNode('refine'), store)).toBe(5)
    })

    it('counts summarize/memorize/outline siblings as executable nodes', () => {
      /*
       * parent            ← 1
       *   ├── /summarize  ← 2
       *   ├── /memorize   ← 3
       *   └── /refine :n=2  ← excluded
       *
       * scope = 3, cost = 2 × 3 = 6
       */
      const store = buildStore({
        parent: {id: 'parent', command: '/chat', children: ['sum', 'mem', 'r']},
        sum: {id: 'sum', parent: 'parent', command: '/summarize', children: []},
        mem: {id: 'mem', parent: 'parent', command: '/memorize', children: []},
        r: {id: 'r', parent: 'parent', command: '/refine :n=2', children: []},
      })
      expect(projectForkCost(store.getNode('r'), store)).toBe(6)
    })

    it('counts /validate siblings (they run LLM juror calls per fork)', () => {
      /*
       * parent            ← 1
       *   ├── /validate C ← 2
       *   └── /refine :n=3  ← excluded
       *
       * scope = 2, cost = 3 × 2 = 6
       */
      const store = buildStore({
        parent: {id: 'parent', command: '/chat', children: ['v', 'r']},
        v: {id: 'v', parent: 'parent', command: '/validate must include numbers', children: []},
        r: {id: 'r', parent: 'parent', command: '/refine :n=3', children: []},
      })
      expect(projectForkCost(store.getNode('r'), store)).toBe(6)
    })

    it('counts grandchildren of the parent (recursive scope)', () => {
      /*
       * parent (/steps)       ← 1
       *   ├── step1 (/chat)   ← 2
       *   │     └── sum (/summarize)  ← 3
       *   └── /refine :n=2   ← excluded
       *
       * scope = 3, cost = 2 × 3 = 6
       */
      const store = buildStore({
        parent: {id: 'parent', command: '/steps', children: ['step1', 'r']},
        step1: {id: 'step1', parent: 'parent', command: '/chat', children: ['sum']},
        sum: {id: 'sum', parent: 'step1', command: '/summarize', children: []},
        r: {id: 'r', parent: 'parent', command: '/refine :n=2', children: []},
      })
      expect(projectForkCost(store.getNode('r'), store)).toBe(6)
    })

    it('missing child id in store is skipped without error', () => {
      const store = buildStore({
        parent: {id: 'parent', command: '/chat', children: ['chatA', 'ghost', 'r']},
        chatA: {id: 'chatA', parent: 'parent', command: '/chat a', children: []},
        r: {id: 'r', parent: 'parent', command: '/refine :n=4', children: []},
      })
      // scope = parent(1) + chatA(1) = 2, ghost skipped
      expect(projectForkCost(store.getNode('r'), store)).toBe(8)
    })
  })

  describe('nested /refine → additive cost, NOT multiplicative', () => {
    it('inner(n=3) + outer(n=2) produces additive cost, not 2×3=6 times base', () => {
      /*
       * outerParent (/steps)           ← outer scope: 1 (self) + 1 (innerParent) = 2
       *   ├── innerParent (/chat)      ← inner scope: 1 (self only, inner /refine boundary)
       *   │     └── innerRefine (/refine :n=3)  ← boundary; inner cost = 3×1 = 3
       *   └── outerRefine (/refine :n=2)        ← excluded from outer scope
       *
       * outer cost = 2 × 2 + 3 = 7   (additive)
       * multiplicative would be:       2 × (2 + 3×1) = 10   ← wrong
       */
      const store = buildStore({
        outerParent: {id: 'outerParent', command: '/steps', children: ['innerParent', 'outerRefine']},
        innerParent: {id: 'innerParent', parent: 'outerParent', command: '/chat', children: ['innerRefine']},
        innerRefine: {id: 'innerRefine', parent: 'innerParent', command: '/refine :n=3', children: []},
        outerRefine: {id: 'outerRefine', parent: 'outerParent', command: '/refine :n=2', children: []},
      })
      expect(projectForkCost(store.getNode('outerRefine'), store)).toBe(7)
    })

    it('inner nested deep in a branch: outer scope stops at /refine boundary', () => {
      /*
       * outerParent          ← scope: 1 (self)
       *   ├── chatA          ← scope: 2
       *   ├── mid (/chat)    ← scope: 3  (inner /refine is a boundary; mid itself counts)
       *   │     └── innerR (/refine :n=3)  boundary; inner cost = 3×1=3
       *   └── outerR (/refine :n=4)  ← excluded
       *
       * outer scope = 3, outer cost = 4 × 3 + 3 = 15
       */
      const store = buildStore({
        outerParent: {id: 'outerParent', command: '/chat', children: ['chatA', 'mid', 'outerR']},
        chatA: {id: 'chatA', parent: 'outerParent', command: '/chat', children: []},
        mid: {id: 'mid', parent: 'outerParent', command: '/chat', children: ['innerR']},
        innerR: {id: 'innerR', parent: 'mid', command: '/refine :n=3', children: []},
        outerR: {id: 'outerR', parent: 'outerParent', command: '/refine :n=4', children: []},
      })
      expect(projectForkCost(store.getNode('outerR'), store)).toBe(15)
    })

    it('three-level nesting: costs are added at each level separately', () => {
      /*
       * l1Parent (/chat)                                            ← l1R scope: 1
       *   ├── l2Parent (/chat)                                      ← l1R scope: 2
       *   │     ├── l3Parent (/chat)                                ← l1R scope: 3, l2R scope: 2
       *   │     │     └── l3R (/refine :n=4) ← boundary (scope stops); l3R cost: 4×1=4
       *   │     └── l2R (/refine :n=3)       ← boundary (scope stops); l2R cost: 3×2+4=10
       *   └── l1R (/refine :n=2)             ← excluded; l1R cost: 2×3+10=16
       *
       * l3R nearest ancestor: l3R→l3Parent→l2Parent→l2R(IS refine) → owned by l2R
       * l2R nearest ancestor: l2R→l2Parent→l1Parent→l1R(IS refine) → owned by l1R
       * Σ Nᵢ × Sᵢ = 4×1 + 3×2 + 2×3 = 4 + 6 + 6 = 16
       */
      const store = buildStore({
        l1Parent: {id: 'l1Parent', command: '/chat', children: ['l2Parent', 'l1R']},
        l2Parent: {id: 'l2Parent', parent: 'l1Parent', command: '/chat', children: ['l3Parent', 'l2R']},
        l3Parent: {id: 'l3Parent', parent: 'l2Parent', command: '/chat', children: ['l3R']},
        l3R: {id: 'l3R', parent: 'l3Parent', command: '/refine :n=4', children: []},
        l2R: {id: 'l2R', parent: 'l2Parent', command: '/refine :n=3', children: []},
        l1R: {id: 'l1R', parent: 'l1Parent', command: '/refine :n=2', children: []},
      })
      expect(projectForkCost(store.getNode('l1R'), store)).toBe(16)
    })

    it('two sibling nested /refine cells: both inner costs are added', () => {
      /*
       * parent              scope: 1 (self; both nested /refines are boundaries)
       *   ├── branchA       scope contribution: 1 (boundary at innerRA)
       *   │     └── innerRA (/refine :n=2)  inner cost: 2×1=2
       *   ├── branchB       scope contribution: 1 (boundary at innerRB)
       *   │     └── innerRB (/refine :n=3)  inner cost: 3×1=3
       *   └── outerR (/refine :n=5)
       *
       * outer scope = 1(parent) + 1(branchA) + 1(branchB) = 3
       * outer cost  = 5 × 3 + 2 + 3 = 20
       */
      const store = buildStore({
        parent: {id: 'parent', command: '/steps', children: ['branchA', 'branchB', 'outerR']},
        branchA: {id: 'branchA', parent: 'parent', command: '/chat', children: ['innerRA']},
        innerRA: {id: 'innerRA', parent: 'branchA', command: '/refine :n=2', children: []},
        branchB: {id: 'branchB', parent: 'parent', command: '/chat', children: ['innerRB']},
        innerRB: {id: 'innerRB', parent: 'branchB', command: '/refine :n=3', children: []},
        outerR: {id: 'outerR', parent: 'parent', command: '/refine :n=5', children: []},
      })
      expect(projectForkCost(store.getNode('outerR'), store)).toBe(20)
    })
  })

  describe('only the /refine cell itself is excluded from scope (not its siblings)', () => {
    it('a sibling /refine is a scope boundary but not a cost responsibility of the other sibling', () => {
      /*
       * parent (/chat, root — no parent)
       *   ├── sibling (/refine :n=2) ← scope boundary for main
       *   └── main (/refine :n=5)    ← excluded
       *
       * main scope = 1 (just parent; sibling is a /refine boundary)
       * sibling nearest ancestor: sibling→parent→null (parent has no /refine ancestor)
       * → sibling NOT owned by main; its cost is computed separately by the orchestrator
       * main cost = 5 × 1 = 5
       */
      const store = buildStore({
        parent: {id: 'parent', command: '/chat', children: ['sibling', 'main']},
        sibling: {id: 'sibling', parent: 'parent', command: '/refine :n=2', children: []},
        main: {id: 'main', parent: 'parent', command: '/refine :n=5', children: []},
      })
      expect(projectForkCost(store.getNode('main'), store)).toBe(5)
    })
  })

  describe('commodity :n=N on plain LLM cell: counted N times in scope', () => {
    it('/chat :n=N parent: scope counts N instead of 1', () => {
      /*
       * parent (/chat :n=5)   ← counts as 5 (commodity)
       *   └── /refine :n=3    ← excluded
       *
       * scope = 5, cost = 3 × 5 = 15
       */
      const store = buildStore({
        parent: {id: 'parent', command: '/chat :n=5', children: ['refine']},
        refine: {id: 'refine', parent: 'parent', command: '/refine :n=3', children: []},
      })
      expect(projectForkCost(store.getNode('refine'), store)).toBe(15)
    })

    it('/chat :n=N sibling: counted alongside plain siblings by its commodity value', () => {
      /*
       * parent (/steps)           ← 1
       *   ├── chatA (/chat :n=2)  ← 2  (commodity)
       *   └── /refine :n=3        ← excluded
       *
       * scope = 3, cost = 3 × 3 = 9
       */
      const store = buildStore({
        parent: {id: 'parent', command: '/steps', children: ['chatA', 'refine']},
        chatA: {id: 'chatA', parent: 'parent', command: '/chat :n=2', children: []},
        refine: {id: 'refine', parent: 'parent', command: '/refine :n=3', children: []},
      })
      expect(projectForkCost(store.getNode('refine'), store)).toBe(9)
    })

    it(':n=1 below the minimum threshold returns 1, same as no :n= param', () => {
      /*
       * parent (/chat :n=1)  ← readCommodityN returns 1 (n < 2 guard)
       *   └── /refine :n=3   ← excluded
       *
       * scope = 1, cost = 3 × 1 = 3
       */
      const store = buildStore({
        parent: {id: 'parent', command: '/chat :n=1', children: ['refine']},
        refine: {id: 'refine', parent: 'parent', command: '/refine :n=3', children: []},
      })
      expect(projectForkCost(store.getNode('refine'), store)).toBe(3)
    })

    it(':n=N exceeding COMMODITY_N_MAX=10 is capped at 10', () => {
      /*
       * parent (/chat :n=99)  ← capped to 10
       *   └── /refine :n=2   ← excluded
       *
       * scope = 10, cost = 2 × 10 = 20
       */
      const store = buildStore({
        parent: {id: 'parent', command: '/chat :n=99', children: ['refine']},
        refine: {id: 'refine', parent: 'parent', command: '/refine :n=2', children: []},
      })
      expect(projectForkCost(store.getNode('refine'), store)).toBe(20)
    })

    it('/validate :n=N is immune — jury count does not affect execution cost', () => {
      /*
       * parent (/chat)           ← 1
       *   ├── /validate :n=5 C  ← 1 (validate filtered; :n= is jury count, not runs)
       *   └── /refine :n=3      ← excluded
       *
       * scope = 2, cost = 3 × 2 = 6
       */
      const store = buildStore({
        parent: {id: 'parent', command: '/chat', children: ['v', 'refine']},
        v: {id: 'v', parent: 'parent', command: '/validate :n=5 must include numbers', children: []},
        refine: {id: 'refine', parent: 'parent', command: '/refine :n=3', children: []},
      })
      expect(projectForkCost(store.getNode('refine'), store)).toBe(6)
    })

    it('multiple commodity siblings: each sibling :n=N contributes independently to scope', () => {
      /*
       * parent (/steps)          ← 1
       *   ├── chatA (/chat :n=3) ← 3
       *   ├── chatB (/chat :n=4) ← 4
       *   └── /refine :n=2       ← excluded
       *
       * scope = 1 + 3 + 4 = 8, cost = 2 × 8 = 16
       */
      const store = buildStore({
        parent: {id: 'parent', command: '/steps', children: ['chatA', 'chatB', 'refine']},
        chatA: {id: 'chatA', parent: 'parent', command: '/chat :n=3', children: []},
        chatB: {id: 'chatB', parent: 'parent', command: '/chat :n=4', children: []},
        refine: {id: 'refine', parent: 'parent', command: '/refine :n=2', children: []},
      })
      expect(projectForkCost(store.getNode('refine'), store)).toBe(16)
    })

    it('commodity grandchild: recursive scope walk accumulates :n=N from nested plain LLM cells', () => {
      /*
       * outerParent (/steps)           ← outer scope: 1
       *   ├── innerParent (/chat :n=2) ← outer scope: 2 (commodity); inner scope: 2
       *   │     └── innerR (/refine :n=3) ← boundary; inner cost = 3 × 2 = 6
       *   └── outerR (/refine :n=2)    ← excluded
       *
       * outer scope = 1 + 2 = 3, outer cost = 2 × 3 + 6 = 12
       */
      const store = buildStore({
        outerParent: {id: 'outerParent', command: '/steps', children: ['innerParent', 'outerR']},
        innerParent: {id: 'innerParent', parent: 'outerParent', command: '/chat :n=2', children: ['innerR']},
        innerR: {id: 'innerR', parent: 'innerParent', command: '/refine :n=3', children: []},
        outerR: {id: 'outerR', parent: 'outerParent', command: '/refine :n=2', children: []},
      })
      expect(projectForkCost(store.getNode('outerR'), store)).toBe(12)
    })

    it(':limit= on /refine does not affect cost — only :n= determines the fork multiplier', () => {
      /*
       * parent (/chat :n=10)          ← counts as 10
       *   └── /refine :n=3 :limit=xs  ← :limit= ignored by projector
       *
       * scope = 10, cost = 3 × 10 = 30
       */
      const store = buildStore({
        parent: {id: 'parent', command: '/chat :n=10', children: ['refine']},
        refine: {id: 'refine', parent: 'parent', command: '/refine :n=3 :limit=xs', children: []},
      })
      expect(projectForkCost(store.getNode('refine'), store)).toBe(30)
    })
  })
})
