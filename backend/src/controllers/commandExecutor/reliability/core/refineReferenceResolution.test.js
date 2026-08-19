/**
 * Cross-module system property: after the refine winner is committed to the refine cell
 * via copyParentPromptOutputToRefine, downstream @@<refineCell> reference resolution
 * behaves as a first-class reference definition.
 *
 * Covers four orthogonal algorithm aspects:
 *   1. Reference-model consistency  — /refine obeys the universal @-def prefix rule
 *   2. Winner isolation             — only the winning fork output is exposed; discarded fork
 *                                     candidates from the parent /chat do not bleed through
 *   3. Command-child filtering      — command siblings (e.g. /validate) are excluded from
 *                                     @@refine output by isAnyCommand in indentedText
 *   4. Multi-prompt winner          — all output nodes from the winning fork are accessible
 *
 * Companion coverage:
 *   refineWinnerOutput.test.js — copyParentPromptOutputToRefine in isolation
 *   forkLocalRef.test.js       — reference resolution is fork-local across store clones
 *   ValidateCommand.test.js    — /validate checks refine-owned winner, not grandparent content
 */
import Store from '../../commands/utils/Store'
import {copyParentPromptOutputToRefine} from './refineWinnerOutput'
import {substituteReferences} from '../../commands/references/substitution'

const buildStore = nodeMap => new Store({userId: 'user1', nodes: nodeMap})

const WINNER_TEXT = 'WINNER: the one correct answer with all required content'
const LOSER_A_TEXT = 'LOSER-ALPHA: discarded fork candidate'
const LOSER_B_TEXT = 'LOSER-BETA: discarded fork candidate'
const WINNER_PART_1 = 'WINNER-PART-ONE: first output node of the winning fork'
const WINNER_PART_2 = 'WINNER-PART-TWO: second output node of the winning fork'

const REF_NAME = 'MyRefine'
const AT_TITLE = `@${REF_NAME} [✓ 1/3]`
const BARE_TITLE = `${REF_NAME} [✓ 1/3]`

const resolve = store => substituteReferences(`@@${REF_NAME}`, 0, store)

// The refine cell is empty until commitWinner() transfers the winner.
const buildTargetStore = (refineTitle, extraRefineChildren = []) => {
  const refineChildren = [...extraRefineChildren]
  const extraNodes = extraRefineChildren.reduce((acc, child) => {
    acc[child.id] = child
    return acc
  }, {})

  return buildStore({
    root: {id: 'root', parent: null, depth: 0, title: '', children: ['parent']},
    parent: {
      id: 'parent',
      parent: 'root',
      depth: 1,
      command: '/chat do task',
      children: ['loserA', 'loserB', 'refine'],
      prompts: ['loserA', 'loserB'],
    },
    loserA: {id: 'loserA', parent: 'parent', depth: 2, title: LOSER_A_TEXT, children: []},
    loserB: {id: 'loserB', parent: 'parent', depth: 2, title: LOSER_B_TEXT, children: []},
    refine: {
      id: 'refine',
      parent: 'parent',
      depth: 2,
      command: '/refine :n=3',
      title: refineTitle,
      children: refineChildren.map(c => c.id),
      prompts: [],
    },
    ...extraNodes,
  })
}

const buildSingleWinnerForkStore = () =>
  buildStore({
    parent: {
      id: 'parent',
      parent: 'root',
      depth: 1,
      command: '/chat do task',
      children: ['winner'],
      prompts: ['winner'],
    },
    winner: {id: 'winner', parent: 'parent', depth: 2, title: WINNER_TEXT, children: []},
  })

const buildMultiWinnerForkStore = () =>
  buildStore({
    parent: {
      id: 'parent',
      parent: 'root',
      depth: 1,
      command: '/chat do task',
      children: ['part1', 'part2'],
      prompts: ['part1', 'part2'],
    },
    part1: {id: 'part1', parent: 'parent', depth: 2, title: WINNER_PART_1, children: []},
    part2: {id: 'part2', parent: 'parent', depth: 2, title: WINNER_PART_2, children: []},
  })

const commitWinner = (store, forkStore = buildSingleWinnerForkStore()) =>
  copyParentPromptOutputToRefine({
    sourceStore: forkStore,
    targetStore: store,
    parentNodeId: 'parent',
    refineNodeId: 'refine',
  })

describe('@@<refineCell> — reference-model consistency', () => {
  it('resolves when the refine cell title carries the @-def prefix, matching the universal D5 reference rule', () => {
    const store = buildTargetStore(AT_TITLE)
    commitWinner(store)
    expect(resolve(store)).toContain(WINNER_TEXT)
  })

  it('resolves to nothing when the refine cell title lacks the @-def prefix — same behaviour as any other bare-titled cell', () => {
    const store = buildTargetStore(BARE_TITLE)
    commitWinner(store)
    expect(resolve(store)).toBe('')
  })

  it('reliability suffix in the refine title does not prevent @-def matching', () => {
    const forms = [`@${REF_NAME} [✓ 2/3]`, `@${REF_NAME} [✗ 0/3]`, `@${REF_NAME} [⚠ 0/3]`]
    for (const title of forms) {
      const store = buildTargetStore(title)
      commitWinner(store)
      expect(resolve(store)).toContain(WINNER_TEXT)
    }
  })
})

describe('@@<refineCell> — winner isolation', () => {
  it('exposes exactly the winning fork output — not the discarded candidates from the parent /chat', () => {
    const store = buildTargetStore(AT_TITLE)
    commitWinner(store)
    const resolved = resolve(store)
    const candidates = [WINNER_TEXT, LOSER_A_TEXT, LOSER_B_TEXT]
    const present = candidates.filter(t => resolved.includes(t))
    expect(present).toEqual([WINNER_TEXT])
  })

  it('discarded fork candidates do not leak through @@refine when no winner was committed (all-forks-failed path)', () => {
    const store = buildTargetStore(AT_TITLE)
    // No commitWinner — simulates resolveRefineCell emitting an error node without transferring output.
    // The reference engine may return the refine title remnant but must never expose loser candidates.
    const resolved = resolve(store)
    expect(resolved).not.toContain(LOSER_A_TEXT)
    expect(resolved).not.toContain(LOSER_B_TEXT)
  })
})

describe('@@<refineCell> — command-child filtering', () => {
  // /validate is installed as a structural child of refine (not a prompt).
  const validateChild = {
    id: 'vld',
    parent: 'refine',
    depth: 3,
    command: '/validate must contain specific keyword',
    children: [],
  }

  it('excludes a /validate child from the resolved text', () => {
    const store = buildTargetStore(AT_TITLE, [validateChild])
    commitWinner(store)
    const resolved = resolve(store)
    expect(resolved).not.toContain('/validate')
    expect(resolved).not.toContain('must contain specific keyword')
  })

  it('winner content is still present when /validate is a sibling under refine', () => {
    const store = buildTargetStore(AT_TITLE, [validateChild])
    commitWinner(store)
    expect(resolve(store)).toContain(WINNER_TEXT)
  })
})

describe('@@<refineCell> — multi-prompt winner', () => {
  it('includes all output nodes when the winning fork produced multiple prompt children', () => {
    const store = buildTargetStore(AT_TITLE)
    commitWinner(store, buildMultiWinnerForkStore())
    const resolved = resolve(store)
    expect(resolved).toContain(WINNER_PART_1)
    expect(resolved).toContain(WINNER_PART_2)
  })

  it('discarded fork candidates are still absent even when the winner had multiple nodes', () => {
    const store = buildTargetStore(AT_TITLE)
    commitWinner(store, buildMultiWinnerForkStore())
    const resolved = resolve(store)
    expect(resolved).not.toContain(LOSER_A_TEXT)
    expect(resolved).not.toContain(LOSER_B_TEXT)
  })
})
