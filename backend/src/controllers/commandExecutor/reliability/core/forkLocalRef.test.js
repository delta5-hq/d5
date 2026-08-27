/**
 * Fork-local reference isolation — design property
 *
 * Proves the chain of guarantees that makes reference resolution fork-local:
 *   (1) StoreFork.createFork deep-clones _nodes (see StoreFork.test.js for
 *       full isolation coverage — only cross-system behaviour is tested here)
 *   (2) substituteReferences resolves from the store._nodes it receives,
 *       not from any captured closure
 *   (3) applyCandidate writes to target only, leaving sibling fork stores intact
 *
 * Together (1)+(2) mean: each fork's reference resolution operates on its own
 * copy of the node map, automatically isolated from other forks.
 */
import StoreFork from './StoreFork'
import Store from '../../commands/utils/Store'
import {findInNodeMap} from '../../commands/references/utils/referenceUtils'
import {REF_DEF_PREFIX} from '../../commands/references/referenceConstants'

const buildStore = nodeMap => new Store({userId: 'user1', nodes: nodeMap})

const REF_NAME = 'step1'
const REF_DEF = `${REF_DEF_PREFIX}${REF_NAME}`

const titleIsRefDef = title => typeof title === 'string' && title.startsWith(REF_DEF)

const storeWithRef = () =>
  buildStore({
    root: {id: 'root', parent: null, depth: 0, title: '', children: ['def']},
    def: {id: 'def', parent: 'root', depth: 1, title: REF_DEF, children: []},
  })

//
// substituteReferences calls findInNodeMap(store._nodes, ...) with the store it
// receives as a parameter.  Each fork gets its own deep-cloned _nodes via
// StoreFork.createFork (proven in StoreFork.test.js).
// Together these two facts guarantee that reference resolution is fork-local.

describe('findInNodeMap — resolves against the nodeMap it receives', () => {
  it('returns the definition node when it exists in the given nodeMap', () => {
    const store = storeWithRef()

    const found = findInNodeMap(store._nodes, false, titleIsRefDef)

    expect(found).toEqual(expect.objectContaining({id: 'def'}))
  })

  it('returns undefined when definition node is absent from the given nodeMap', () => {
    const store = storeWithRef()
    delete store._nodes.def

    const found = findInNodeMap(store._nodes, false, titleIsRefDef)

    expect(found).toBeUndefined()
  })

  it('fork _nodes resolves def independently from original _nodes (deleted in original)', () => {
    const original = storeWithRef()
    const fork = StoreFork.createFork(original)
    delete original._nodes.def

    const foundInFork = findInNodeMap(fork._nodes, false, titleIsRefDef)
    const foundInOriginal = findInNodeMap(original._nodes, false, titleIsRefDef)

    expect(foundInFork).toEqual(expect.objectContaining({id: 'def'}))
    expect(foundInOriginal).toBeUndefined()
  })

  it('original _nodes resolves def independently from fork _nodes (deleted in fork)', () => {
    const original = storeWithRef()
    const fork = StoreFork.createFork(original)
    delete fork._nodes.def

    const foundInOriginal = findInNodeMap(original._nodes, false, titleIsRefDef)
    const foundInFork = findInNodeMap(fork._nodes, false, titleIsRefDef)

    expect(foundInOriginal).toEqual(expect.objectContaining({id: 'def'}))
    expect(foundInFork).toBeUndefined()
  })

  it('two sibling forks each independently resolve from their own node maps', () => {
    const original = storeWithRef()
    const fork1 = StoreFork.createFork(original)
    const fork2 = StoreFork.createFork(original)
    delete fork1._nodes.def

    const found1 = findInNodeMap(fork1._nodes, false, titleIsRefDef)
    const found2 = findInNodeMap(fork2._nodes, false, titleIsRefDef)

    expect(found1).toBeUndefined()
    expect(found2).toEqual(expect.objectContaining({id: 'def'}))
  })
})

describe('StoreFork.applyCandidate — does not contaminate sibling forks', () => {
  it('applies winner to target but leaves sibling fork store intact', () => {
    const nodes = {
      root: {
        id: 'root',
        parent: null,
        depth: 0,
        title: '',
        children: ['cell'],
      },
      cell: {
        id: 'cell',
        parent: 'root',
        depth: 1,
        title: 'original',
        children: [],
      },
    }
    const target = buildStore(nodes)
    const winnerFork = StoreFork.createFork(target)
    const siblingFork = StoreFork.createFork(target)

    winnerFork._nodes.cell.title = 'winner output'
    siblingFork._nodes.cell.title = 'sibling output'

    StoreFork.applyCandidate(target, winnerFork, 'cell')

    expect(target._nodes.cell.title).toBe('winner output')
    expect(siblingFork._nodes.cell.title).toBe('sibling output')
  })

  it('multiple sibling forks all remain independent after applyCandidate', () => {
    const nodes = {
      root: {
        id: 'root',
        parent: null,
        depth: 0,
        title: '',
        children: ['cell'],
      },
      cell: {
        id: 'cell',
        parent: 'root',
        depth: 1,
        title: 'original',
        children: [],
      },
    }
    const target = buildStore(nodes)
    const forks = Array.from({length: 3}, (_, i) => {
      const f = StoreFork.createFork(target)
      f._nodes.cell.title = `fork-${i}`
      return f
    })

    StoreFork.applyCandidate(target, forks[0], 'cell')

    expect(forks[1]._nodes.cell.title).toBe('fork-1')
    expect(forks[2]._nodes.cell.title).toBe('fork-2')
  })
})
