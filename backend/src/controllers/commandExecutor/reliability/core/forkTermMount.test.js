import {mountTermInFork} from './forkTermMount'
import {buildSyntheticTermParent} from './inlineTermParser'
import Store from '../../commands/utils/Store'

const buildForkStore = nodeMap => new Store({userId: 'u', nodes: nodeMap})

const withAncestor = () =>
  buildForkStore({
    root: {id: 'root', parent: null, command: '/steps', children: ['e'], prompts: []},
    e: {id: 'e', parent: 'root', command: '/elect :n=2 /chat foo', children: [], prompts: []},
  })

const topLevel = () =>
  buildForkStore({
    e: {id: 'e', parent: null, command: '/elect :n=2 /chat foo', children: [], prompts: []},
  })

const term = parentId => buildSyntheticTermParent('e', '/chat foo', parentId)

describe('mountTermInFork — inserts the term parent into a fork store', () => {
  it('adds the synth node keyed by the term-parent id, carrying the term command', () => {
    const store = withAncestor()
    mountTermInFork(store, term('root'), 'e', 'root')
    expect(store._nodes['e:term']).toBeDefined()
    expect(store._nodes['e:term'].command).toBe('/chat foo')
  })

  it('re-parents the elect to the synth and lists the elect as the synths only child', () => {
    const store = withAncestor()
    mountTermInFork(store, term('root'), 'e', 'root')
    expect(store._nodes.e.parent).toBe('e:term')
    expect(store._nodes['e:term'].children).toEqual(['e'])
  })

  it('replaces the elect id with the synth id in the ancestor children, preserving order and siblings', () => {
    const store = buildForkStore({
      root: {id: 'root', parent: null, command: '/steps', children: ['x', 'e', 'y'], prompts: []},
      x: {id: 'x', parent: 'root', command: '/chat a', children: [], prompts: []},
      e: {id: 'e', parent: 'root', command: '/elect :n=2 /chat foo', children: [], prompts: []},
      y: {id: 'y', parent: 'root', command: '/chat b', children: [], prompts: []},
    })
    mountTermInFork(store, term('root'), 'e', 'root')
    expect(store._nodes.root.children).toEqual(['x', 'e:term', 'y'])
  })
})

describe('mountTermInFork — boundary: no ancestor (top-level inline elect)', () => {
  it('inserts the synth and re-parents the elect without crashing when ancestorId is null', () => {
    const store = topLevel()
    expect(() => mountTermInFork(store, term(null), 'e', null)).not.toThrow()
    expect(store._nodes['e:term']).toBeDefined()
    expect(store._nodes.e.parent).toBe('e:term')
    expect(store._nodes['e:term'].parent).toBeNull()
  })
})

describe('mountTermInFork — the mounted subtree survives the fork orphan collection', () => {
  it('synth and elect both survive removeOrphanedNodes when an ancestor is present', () => {
    const store = withAncestor()
    mountTermInFork(store, term('root'), 'e', 'root')
    store.removeOrphanedNodes()
    expect(store._nodes['e:term']).toBeDefined()
    expect(store._nodes.e).toBeDefined()
  })

  it('synth (root) and elect both survive removeOrphanedNodes when there is no ancestor', () => {
    const store = topLevel()
    mountTermInFork(store, term(null), 'e', null)
    store.removeOrphanedNodes()
    expect(store._nodes['e:term']).toBeDefined()
    expect(store._nodes.e).toBeDefined()
  })
})
