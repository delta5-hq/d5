import Store from '../../commands/utils/Store'
import {collectSubtreeIds} from './storeSubtreeUtils'

const buildStore = nodes => new Store({userId: 'user1', nodes})

describe('collectSubtreeIds', () => {
  it('returns an empty set when given no root ids', () => {
    expect(collectSubtreeIds(buildStore({}), [])).toEqual(new Set())
  })

  it('returns just the root id when the root has no children', () => {
    const store = buildStore({a: {id: 'a', children: []}})
    expect(collectSubtreeIds(store, ['a'])).toEqual(new Set(['a']))
  })

  it('collects all descendants across multiple nesting levels', () => {
    const store = buildStore({
      a: {id: 'a', children: ['b']},
      b: {id: 'b', children: ['c']},
      c: {id: 'c', children: []},
    })
    expect(collectSubtreeIds(store, ['a'])).toEqual(new Set(['a', 'b', 'c']))
  })

  it('merges multiple root subtrees without duplicating shared descendants', () => {
    const store = buildStore({
      a: {id: 'a', children: ['shared']},
      b: {id: 'b', children: ['shared']},
      shared: {id: 'shared', children: []},
    })
    expect(collectSubtreeIds(store, ['a', 'b'])).toEqual(new Set(['a', 'b', 'shared']))
  })

  it('terminates without looping when a node lists itself in children', () => {
    const store = buildStore({
      a: {id: 'a', children: ['a', 'b']},
      b: {id: 'b', children: []},
    })
    expect(collectSubtreeIds(store, ['a'])).toEqual(new Set(['a', 'b']))
  })

  it('terminates without looping when nodes form a mutual cycle', () => {
    const store = buildStore({
      a: {id: 'a', children: ['b']},
      b: {id: 'b', children: ['a']},
    })
    expect(collectSubtreeIds(store, ['a'])).toEqual(new Set(['a', 'b']))
  })

  it('skips a child id that does not resolve to a node in the store', () => {
    const store = buildStore({
      a: {id: 'a', children: ['ghost', 'b']},
      b: {id: 'b', children: []},
    })
    expect(collectSubtreeIds(store, ['a'])).toEqual(new Set(['a', 'b']))
  })

  it('handles a root id that does not resolve to a node', () => {
    expect(collectSubtreeIds(buildStore({}), ['ghost'])).toEqual(new Set())
  })
})
