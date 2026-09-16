import {mountTermInFork, mountSequencingTermInFork} from './forkTermMount'
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

const stepsTerm = parentId => buildSyntheticTermParent('e', '/steps', parentId)

const electWithSteps = (ancestorId, {withPrompt = false} = {}) => {
  const children = withPrompt ? ['s10', 's20', 'out'] : ['s10', 's20']
  const nodes = {
    e: {id: 'e', parent: ancestorId, command: '/elect :n=2 /steps', children, prompts: withPrompt ? ['out'] : []},
    s10: {id: 's10', parent: 'e', command: '#10 /chat a', children: [], prompts: []},
    s20: {id: 's20', parent: 'e', command: '#20 /chat b', children: [], prompts: []},
  }
  if (withPrompt) nodes.out = {id: 'out', parent: 'e', title: 'prior output', children: [], prompts: []}
  if (ancestorId != null)
    nodes[ancestorId] = {id: ancestorId, parent: null, command: '/chat root', children: ['e'], prompts: []}
  return buildForkStore(nodes)
}

describe('mountSequencingTermInFork — the synth adopts the step subtree, not the elect', () => {
  it('adopts the elects non-prompt children as the synth children so StepsCommand sequences them', () => {
    const store = electWithSteps('root')
    mountSequencingTermInFork(store, stepsTerm('root'), 'e', 'root')
    expect(store._nodes['e:term'].children).toEqual(['s10', 's20'])
  })

  it('excludes prompt-output ids from the adopted step children', () => {
    const store = electWithSteps('root', {withPrompt: true})
    mountSequencingTermInFork(store, stepsTerm('root'), 'e', 'root')
    expect(store._nodes['e:term'].children).toEqual(['s10', 's20'])
    expect(store._nodes['e:term'].prompts).toEqual([])
  })

  it('appends the synth to the ancestor without displacing the elect, so both stay reachable', () => {
    const store = electWithSteps('root')
    mountSequencingTermInFork(store, stepsTerm('root'), 'e', 'root')
    expect(store._nodes.root.children).toEqual(['e', 'e:term'])
    expect(store._nodes.e.parent).toBe('root')
  })

  it('does not append the synth twice when called against an ancestor that already lists it', () => {
    const store = electWithSteps('root')
    mountSequencingTermInFork(store, stepsTerm('root'), 'e', 'root')
    mountSequencingTermInFork(store, stepsTerm('root'), 'e', 'root')
    expect(store._nodes.root.children.filter(id => id === 'e:term')).toHaveLength(1)
  })
})

describe('mountSequencingTermInFork — boundary: no ancestor (top-level elect)', () => {
  it('inserts the synth without crashing when ancestorId is null', () => {
    const store = electWithSteps(null)
    expect(() => mountSequencingTermInFork(store, stepsTerm(null), 'e', null)).not.toThrow()
    expect(store._nodes['e:term'].children).toEqual(['s10', 's20'])
  })
})

describe('mountSequencingTermInFork — the mounted content source survives orphan collection', () => {
  it('synth, elect and steps all survive removeOrphanedNodes when an ancestor is present', () => {
    const store = electWithSteps('root')
    mountSequencingTermInFork(store, stepsTerm('root'), 'e', 'root')
    store.removeOrphanedNodes()
    expect(store._nodes['e:term']).toBeDefined()
    expect(store._nodes.e).toBeDefined()
    expect(store._nodes.s10).toBeDefined()
    expect(store._nodes.s20).toBeDefined()
  })
})
