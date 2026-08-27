import { describe, it, expect } from 'vitest'
import type { NodeDatas } from '@shared/base-types'
import { projectForkCost } from '../fork-cost-projector'
import { COMMODITY_N_MAX } from '../commodity-params'

/*
 * Cost model: Σ Nᵢ × Sᵢ  (additive in depth, NOT multiplicative)
 *
 *   Sᵢ = count of executable nodes in /elect-i's immediate scope
 *        Parent node + all non-/elect descendants, accumulating commodity :n=N
 *        Nested /elect cells are scope BOUNDARIES — their subtrees are excluded
 *        from the outer count but contribute their own Nᵢ×Sᵢ term independently
 *
 *   Commodity cells: readCommodityN(command) ≥ 1; a /chat :n=5 contributes 5 to scope
 *   Reliability cells (/elect, /validate): commodity :n=N is SUPPRESSED — always 1
 */

const nodes = (overrides: NodeDatas = {}): NodeDatas => overrides

describe('projectForkCost — guard conditions', () => {
  it('returns 0 when command has no :n=', () => {
    const n = nodes({
      parent: { id: 'parent', children: ['r'] },
      r: { id: 'r', parent: 'parent', command: '/elect', children: [] },
    })
    expect(projectForkCost(n.r, n)).toBe(0)
  })

  it('returns 0 when :n= is below the minimum of 2', () => {
    const n = nodes({
      parent: { id: 'parent', children: ['r'] },
      r: { id: 'r', parent: 'parent', command: '/elect :n=1', children: [] },
    })
    expect(projectForkCost(n.r, n)).toBe(0)
  })

  it('returns 0 when elect node has no parent field', () => {
    const n = nodes({ r: { id: 'r', command: '/elect :n=2', children: [] } })
    expect(projectForkCost(n.r, n)).toBe(0)
  })

  it('returns 0 when parent id is not present in nodes', () => {
    const n = nodes({ r: { id: 'r', parent: 'ghost', command: '/elect :n=3', children: [] } })
    expect(projectForkCost(n.r, n)).toBe(0)
  })

  it('returns 0 for undefined elect node', () => {
    expect(projectForkCost(undefined, nodes())).toBe(0)
  })
})

describe('projectForkCost — flat scope (parent + siblings)', () => {
  it('elect is the only child: cost = N × 1 (parent alone)', () => {
    /*
     * parent   ← 1
     *   └── /elect :n=5   ← excluded
     * scope = 1, cost = 5 × 1 = 5
     */
    const n = nodes({
      parent: { id: 'parent', children: ['r'] },
      r: { id: 'r', parent: 'parent', command: '/elect :n=5', children: [] },
    })
    expect(projectForkCost(n.r, n)).toBe(5)
  })

  it('one plain sibling: cost = N × (parent + sibling)', () => {
    /*
     * parent          ← 1
     *   ├── /chat a   ← 2
     *   └── /elect :n=3   ← excluded
     * scope = 2, cost = 3 × 2 = 6
     */
    const n = nodes({
      parent: { id: 'parent', children: ['s', 'r'] },
      s: { id: 's', parent: 'parent', command: '/chat a', children: [] },
      r: { id: 'r', parent: 'parent', command: '/elect :n=3', children: [] },
    })
    expect(projectForkCost(n.r, n)).toBe(6)
  })

  it('three plain siblings: all counted in scope', () => {
    /*
     * parent             ← 1
     *   ├── /chat a      ← 2
     *   ├── /chat b      ← 3
     *   ├── /chat c      ← 4
     *   └── /elect :n=2 ← excluded
     * scope = 4, cost = 2 × 4 = 8
     */
    const n = nodes({
      parent: { id: 'parent', children: ['s1', 's2', 's3', 'r'] },
      s1: { id: 's1', parent: 'parent', command: '/chat a', children: [] },
      s2: { id: 's2', parent: 'parent', command: '/chat b', children: [] },
      s3: { id: 's3', parent: 'parent', command: '/chat c', children: [] },
      r: { id: 'r', parent: 'parent', command: '/elect :n=2', children: [] },
    })
    expect(projectForkCost(n.r, n)).toBe(8)
  })

  it('a /elect sibling is a scope boundary — excluded from count', () => {
    /*
     * parent                  ← 1
     *   ├── /elect :n=2 (other)  ← excluded (boundary)
     *   └── /elect :n=5 (main)   ← excluded (self)
     * scope = 1, cost = 5 × 1 = 5
     */
    const n = nodes({
      parent: { id: 'parent', children: ['other', 'r'] },
      other: { id: 'other', parent: 'parent', command: '/elect :n=2', children: [] },
      r: { id: 'r', parent: 'parent', command: '/elect :n=5', children: [] },
    })
    expect(projectForkCost(n.r, n)).toBe(5)
  })

  it('/summarize and /memorize siblings are counted as executable nodes', () => {
    /*
     * parent           ← 1
     *   ├── /summarize ← 2
     *   ├── /memorize  ← 3
     *   └── /elect :n=2 ← excluded
     * scope = 3, cost = 2 × 3 = 6
     */
    const n = nodes({
      parent: { id: 'parent', children: ['sum', 'mem', 'r'] },
      sum: { id: 'sum', parent: 'parent', command: '/summarize', children: [] },
      mem: { id: 'mem', parent: 'parent', command: '/memorize', children: [] },
      r: { id: 'r', parent: 'parent', command: '/elect :n=2', children: [] },
    })
    expect(projectForkCost(n.r, n)).toBe(6)
  })

  it('/validate sibling counts as 1 (jury cost, not commodity multiplier)', () => {
    /*
     * parent              ← 1
     *   ├── /validate C   ← 1 (:n= on validate is jury dial, not commodity)
     *   └── /elect :n=3  ← excluded
     * scope = 2, cost = 3 × 2 = 6
     */
    const n = nodes({
      parent: { id: 'parent', children: ['v', 'r'] },
      v: { id: 'v', parent: 'parent', command: '/validate must include numbers', children: [] },
      r: { id: 'r', parent: 'parent', command: '/elect :n=3', children: [] },
    })
    expect(projectForkCost(n.r, n)).toBe(6)
  })

  it('/validate :n=N sibling: :n= jury dial is suppressed; node still costs 1', () => {
    /*
     * parent                   ← 1
     *   ├── /validate :n=5 C   ← 1 (not 5; :n= on validate is jury count)
     *   └── /elect :n=3       ← excluded
     * scope = 2, cost = 3 × 2 = 6
     */
    const n = nodes({
      parent: { id: 'parent', children: ['v', 'r'] },
      v: { id: 'v', parent: 'parent', command: '/validate :n=5 must include numbers', children: [] },
      r: { id: 'r', parent: 'parent', command: '/elect :n=3', children: [] },
    })
    expect(projectForkCost(n.r, n)).toBe(6)
  })

  it('a missing child id in nodes is skipped without error', () => {
    /*
     * parent has a child 'ghost' that is not in the nodes map
     * scope = parent(1) + chatA(1) = 2, ghost skipped
     * cost = 4 × 2 = 8
     */
    const n = nodes({
      parent: { id: 'parent', children: ['chatA', 'ghost', 'r'] },
      chatA: { id: 'chatA', parent: 'parent', command: '/chat a', children: [] },
      r: { id: 'r', parent: 'parent', command: '/elect :n=4', children: [] },
    })
    expect(projectForkCost(n.r, n)).toBe(8)
  })
})

describe('projectForkCost — recursive scope (siblings with subtrees)', () => {
  it('sibling subtree is walked recursively up to a nested /elect boundary', () => {
    /*
     * parent (/steps)       ← 1
     *   ├── step1 (/chat)   ← 2
     *   │     └── sum (/summarize) ← 3
     *   └── /elect :n=2   ← excluded
     * scope = 3, cost = 2 × 3 = 6
     */
    const n = nodes({
      parent: { id: 'parent', command: '/steps', children: ['step1', 'r'] },
      step1: { id: 'step1', parent: 'parent', command: '/chat', children: ['sum'] },
      sum: { id: 'sum', parent: 'step1', command: '/summarize', children: [] },
      r: { id: 'r', parent: 'parent', command: '/elect :n=2', children: [] },
    })
    expect(projectForkCost(n.r, n)).toBe(6)
  })

  it('nested /elect inside sibling is a scope boundary: children beyond it excluded from outer scope', () => {
    /*
     * parent              ← outer scope: 1
     *   ├── mid (/chat)   ← outer scope: 2  (inner /elect is boundary; mid itself counts)
     *   │     └── innerR (/elect :n=2)  ← boundary; inner cost separate
     *   │           ├── c1   ← NOT counted in outer scope; counted in innerR per-fork scope
     *   │           └── c2   ← NOT counted in outer scope; counted in innerR per-fork scope
     *   └── outerR (/elect :n=3)  ← excluded
     * outer scope = 2, outer cost = 3 × 2 = 6
     * innerR elect-child scope = c1(1) + c2(1) = 2, inner cost = 2 × 2 = 4 (P0.30)
     * total = 6 + 4 = 10
     */
    const n = nodes({
      parent: { id: 'parent', children: ['mid', 'outerR'] },
      mid: { id: 'mid', parent: 'parent', command: '/chat', children: ['innerR'] },
      innerR: { id: 'innerR', parent: 'mid', command: '/elect :n=2', children: ['c1', 'c2'] },
      c1: { id: 'c1', parent: 'innerR', command: '/chat a', children: [] },
      c2: { id: 'c2', parent: 'innerR', command: '/chat b', children: [] },
      outerR: { id: 'outerR', parent: 'parent', command: '/elect :n=3', children: [] },
    })
    expect(projectForkCost(n.outerR, n)).toBe(10)
  })
})

describe('projectForkCost — nested /elect produces additive cost, not multiplicative', () => {
  it('inner(n=3) + outer(n=2): additive Σ, not outer×inner product', () => {
    /*
     * outerParent (/steps)              ← outer scope: 1 (self) + 1 (innerParent) = 2
     *   ├── innerParent (/chat)         ← inner scope: 1 (self only; innerR is boundary)
     *   │     └── innerR (/elect :n=3) ← boundary; inner cost = 3 × 1 = 3
     *   └── outerR (/elect :n=2)       ← excluded
     *
     * total = 2×2 + 3 = 7  (additive)
     * multiplicative would give 2×(2+3) = 10  ← wrong
     */
    const n = nodes({
      outerParent: { id: 'outerParent', command: '/steps', children: ['innerParent', 'outerR'] },
      innerParent: { id: 'innerParent', parent: 'outerParent', command: '/chat', children: ['innerR'] },
      innerR: { id: 'innerR', parent: 'innerParent', command: '/elect :n=3', children: [] },
      outerR: { id: 'outerR', parent: 'outerParent', command: '/elect :n=2', children: [] },
    })
    expect(projectForkCost(n.outerR, n)).toBe(7)
  })

  it('three-level nesting: Σ Nᵢ × Sᵢ across all levels', () => {
    /*
     * l1Parent  ← l1R scope: 1+1+1=3  (self, l2Parent, l3Parent; l2R boundary)
     *   ├── l2Parent  ← l2R scope: 1+1=2  (self, l3Parent; l3R boundary)
     *   │     ├── l3Parent  ← l3R scope: 1
     *   │     │     └── l3R (/elect :n=4)  cost: 4×1 = 4
     *   │     └── l2R (/elect :n=3)        cost: 3×2 + 4 = 10
     *   └── l1R (/elect :n=2)              cost: 2×3 + 10 = 16
     */
    const n = nodes({
      l1Parent: { id: 'l1Parent', command: '/chat', children: ['l2Parent', 'l1R'] },
      l2Parent: { id: 'l2Parent', parent: 'l1Parent', command: '/chat', children: ['l3Parent', 'l2R'] },
      l3Parent: { id: 'l3Parent', parent: 'l2Parent', command: '/chat', children: ['l3R'] },
      l3R: { id: 'l3R', parent: 'l3Parent', command: '/elect :n=4', children: [] },
      l2R: { id: 'l2R', parent: 'l2Parent', command: '/elect :n=3', children: [] },
      l1R: { id: 'l1R', parent: 'l1Parent', command: '/elect :n=2', children: [] },
    })
    expect(projectForkCost(n.l1R, n)).toBe(16)
  })

  it('two sibling nested /elect: both inner costs added once', () => {
    /*
     * parent              ← outer scope: 1+1+1=3 (self, branchA, branchB; both innerR are boundaries)
     *   ├── branchA (/chat)  ← 1 (innerRA is boundary)
     *   │     └── innerRA (/elect :n=2)  inner cost: 2×1=2
     *   ├── branchB (/chat)  ← 1 (innerRB is boundary)
     *   │     └── innerRB (/elect :n=3)  inner cost: 3×1=3
     *   └── outerR (/elect :n=5)         cost: 5×3 + 2 + 3 = 20
     */
    const n = nodes({
      parent: { id: 'parent', command: '/steps', children: ['branchA', 'branchB', 'outerR'] },
      branchA: { id: 'branchA', parent: 'parent', command: '/chat', children: ['innerRA'] },
      innerRA: { id: 'innerRA', parent: 'branchA', command: '/elect :n=2', children: [] },
      branchB: { id: 'branchB', parent: 'parent', command: '/chat', children: ['innerRB'] },
      innerRB: { id: 'innerRB', parent: 'branchB', command: '/elect :n=3', children: [] },
      outerR: { id: 'outerR', parent: 'parent', command: '/elect :n=5', children: [] },
    })
    expect(projectForkCost(n.outerR, n)).toBe(20)
  })
})

describe('projectForkCost — commodity :n=N on plain LLM cells', () => {
  it('parent itself is commodity: scope = N, not 1', () => {
    /*
     * parent (/chat :n=5)  ← counts as 5 (commodity)
     *   └── /elect :n=3  ← excluded
     * scope = 5, cost = 3 × 5 = 15
     */
    const n = nodes({
      parent: { id: 'parent', command: '/chat :n=5', children: ['r'] },
      r: { id: 'r', parent: 'parent', command: '/elect :n=3', children: [] },
    })
    expect(projectForkCost(n.r, n)).toBe(15)
  })

  it('commodity sibling: contributes N instead of 1 to scope', () => {
    /*
     * parent (/steps)          ← 1
     *   ├── /chat :n=2         ← 2 (commodity)
     *   └── /elect :n=3       ← excluded
     * scope = 3, cost = 3 × 3 = 9
     */
    const n = nodes({
      parent: { id: 'parent', command: '/steps', children: ['s', 'r'] },
      s: { id: 's', parent: 'parent', command: '/chat :n=2', children: [] },
      r: { id: 'r', parent: 'parent', command: '/elect :n=3', children: [] },
    })
    expect(projectForkCost(n.r, n)).toBe(9)
  })

  it('multiple commodity siblings: each :n=N contributes independently', () => {
    /*
     * parent (/steps)          ← 1
     *   ├── /chat :n=3         ← 3
     *   ├── /chat :n=4         ← 4
     *   └── /elect :n=2       ← excluded
     * scope = 8, cost = 2 × 8 = 16
     */
    const n = nodes({
      parent: { id: 'parent', command: '/steps', children: ['a', 'b', 'r'] },
      a: { id: 'a', parent: 'parent', command: '/chat :n=3', children: [] },
      b: { id: 'b', parent: 'parent', command: '/chat :n=4', children: [] },
      r: { id: 'r', parent: 'parent', command: '/elect :n=2', children: [] },
    })
    expect(projectForkCost(n.r, n)).toBe(16)
  })

  it('commodity :n=1 treated as single run — same as no :n=', () => {
    /*
     * parent (/chat :n=1)  ← readCommodityN returns 1 (n < 2 guard)
     *   └── /elect :n=3  ← excluded
     * scope = 1, cost = 3 × 1 = 3
     */
    const n = nodes({
      parent: { id: 'parent', command: '/chat :n=1', children: ['r'] },
      r: { id: 'r', parent: 'parent', command: '/elect :n=3', children: [] },
    })
    expect(projectForkCost(n.r, n)).toBe(3)
  })

  it('commodity :n= exceeding COMMODITY_N_MAX is capped', () => {
    /*
     * parent (/chat :n=99)  ← capped to COMMODITY_N_MAX
     *   └── /elect :n=2   ← excluded
     * scope = COMMODITY_N_MAX, cost = 2 × COMMODITY_N_MAX
     */
    const n = nodes({
      parent: { id: 'parent', command: '/chat :n=99', children: ['r'] },
      r: { id: 'r', parent: 'parent', command: '/elect :n=2', children: [] },
    })
    expect(projectForkCost(n.r, n)).toBe(2 * COMMODITY_N_MAX)
  })

  it('commodity grandchild: recursive walk accumulates :n=N from nested plain cells', () => {
    /*
     * outerParent (/steps)              ← outer scope: 1
     *   ├── innerParent (/chat :n=2)    ← outer scope: 2 (commodity); inner scope: 2
     *   │     └── innerR (/elect :n=3) ← boundary; inner cost = 3 × 2 = 6
     *   └── outerR (/elect :n=2)       ← excluded
     * outer scope = 1+2 = 3, outer cost = 2×3 + 6 = 12
     */
    const n = nodes({
      outerParent: { id: 'outerParent', command: '/steps', children: ['innerParent', 'outerR'] },
      innerParent: { id: 'innerParent', parent: 'outerParent', command: '/chat :n=2', children: ['innerR'] },
      innerR: { id: 'innerR', parent: 'innerParent', command: '/elect :n=3', children: [] },
      outerR: { id: 'outerR', parent: 'outerParent', command: '/elect :n=2', children: [] },
    })
    expect(projectForkCost(n.outerR, n)).toBe(12)
  })

  it(':limit= on /elect is ignored by the cost projector', () => {
    /*
     * parent (/chat :n=10)          ← counts as 10
     *   └── /elect :n=3 :limit=xs  ← :limit= is a refusal threshold, not a cost modifier
     * scope = 10, cost = 3 × 10 = 30
     */
    const n = nodes({
      parent: { id: 'parent', command: '/chat :n=10', children: ['r'] },
      r: { id: 'r', parent: 'parent', command: '/elect :n=3 :limit=xs', children: [] },
    })
    expect(projectForkCost(n.r, n)).toBe(30)
  })
})

describe('projectForkCost — commodity :n=N as direct child of /elect (P0.30 child scope)', () => {
  it('/elect :n=3 with /chat :n=5 child → cost = 3 × 5 = 15', () => {
    /*
     * parent (/chat)               ← immediate scope (fallback): 1
     *   └── /elect :n=3           ← fork multiplier: 3
     *         └── innerChat (/chat :n=5) ← elect-child scope: 5
     * electChildScope = 5 > 0 → perForkScope = 5; cost = 3 × 5 = 15
     */
    const n = nodes({
      parent: { id: 'parent', command: '/chat', children: ['r'] },
      r: { id: 'r', parent: 'parent', command: '/elect :n=3', children: ['innerChat'] },
      innerChat: { id: 'innerChat', parent: 'r', command: '/chat :n=5', children: [] },
    })
    expect(projectForkCost(n.r, n)).toBe(15)
  })

  it('/validate child of /elect excluded from per-fork child scope', () => {
    /*
     * parent (/chat)                  ← immediate scope (fallback): 1
     *   └── /elect :n=3             ← fork multiplier: 3
     *         ├── innerChat (/chat :n=2) ← counted in elect-child scope: 2
     *         └── /validate C         ← excluded (post-processor)
     * electChildScope = 2; cost = 3 × 2 = 6
     */
    const n = nodes({
      parent: { id: 'parent', command: '/chat', children: ['r'] },
      r: { id: 'r', parent: 'parent', command: '/elect :n=3', children: ['innerChat', 'v'] },
      innerChat: { id: 'innerChat', parent: 'r', command: '/chat :n=2', children: [] },
      v: { id: 'v', parent: 'r', command: '/validate must mention revenue', children: [] },
    })
    expect(projectForkCost(n.r, n)).toBe(6)
  })

  it('no non-post-processor children → falls back to parent immediate scope', () => {
    /*
     * parent (/chat :n=4)            ← immediate scope (fallback): 4
     *   └── /elect :n=2            ← fork multiplier: 2
     *         └── /validate C        ← excluded; electChildScope = 0
     * electChildScope = 0 → perForkScope = 4; cost = 2 × 4 = 8
     */
    const n = nodes({
      parent: { id: 'parent', command: '/chat :n=4', children: ['r'] },
      r: { id: 'r', parent: 'parent', command: '/elect :n=2', children: ['v'] },
      v: { id: 'v', parent: 'r', command: '/validate must mention revenue', children: [] },
    })
    expect(projectForkCost(n.r, n)).toBe(8)
  })
})
