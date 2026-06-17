import Store from '../../commands/utils/Store'
import {captureStoreExecutionSnapshot, restoreStoreExecutionSnapshot} from './StoreExecutionSnapshot'

const buildStore = () =>
  new Store({
    userId: 'user1',
    nodes: {
      root: {id: 'root', parent: null, children: ['left', 'right'], title: 'root'},
      left: {id: 'left', parent: 'root', children: ['left-child'], prompts: ['left-prompt'], title: 'left'},
      'left-child': {id: 'left-child', parent: 'left', children: [], title: 'left child', file: 'left-file'},
      'left-prompt': {id: 'left-prompt', parent: 'left', children: [], title: 'left prompt', image: 'left-image'},
      right: {id: 'right', parent: 'root', children: ['right-child'], title: 'right'},
      'right-child': {id: 'right-child', parent: 'right', children: [], title: 'right child', file: 'right-file'},
    },
    edges: {
      'left-edge': {id: 'left-edge', start: 'left', end: 'left-child'},
      'right-edge': {id: 'right-edge', start: 'right', end: 'right-child'},
    },
    files: {
      'left-file': 'left file content',
      'left-image': 'left image content',
      'right-file': 'right file content',
    },
  })

const createScopedAssetNode = (store, field, assetId) => {
  store.createFile(assetId, `${assetId} content`)
  store.createNode({
    id: `${assetId}-node`,
    parent: 'left',
    children: [],
    title: `${field} node`,
    [field]: assetId,
  })
}

const markOutput = (store, nodeIds, edgeIds = []) => {
  nodeIds.forEach(id => store.saveNodeToOutput(id))
  edgeIds.forEach(id => store.saveEdgeToOutput(id))
}

describe('StoreExecutionSnapshot', () => {
  it('restores only the selected subtree and preserves unrelated sibling mutations', () => {
    const store = buildStore()
    const snapshot = captureStoreExecutionSnapshot(store, 'left')

    store.getNode('left').title = 'left changed'
    store.createNode({id: 'left-new', parent: 'left', children: [], title: 'left new'})
    store.getNode('right').title = 'right changed'
    store.createNode({id: 'right-new', parent: 'right', children: [], title: 'right new'})

    restoreStoreExecutionSnapshot(store, snapshot)

    expect(store.getNode('left').title).toBe('left')
    expect(store.getNode('left-new')).toBeUndefined()
    expect(store.getNode('right').title).toBe('right changed')
    expect(store.getNode('right-new')).toBeDefined()
  })

  it('preserves object identity for nodes that survive restore', () => {
    const store = buildStore()
    const leftRef = store.getNode('left')
    const childRef = store.getNode('left-child')
    const snapshot = captureStoreExecutionSnapshot(store, 'left')

    store.getNode('left').title = 'changed'
    store.getNode('left-child').title = 'changed child'

    restoreStoreExecutionSnapshot(store, snapshot)

    expect(store.getNode('left')).toBe(leftRef)
    expect(store.getNode('left-child')).toBe(childRef)
    expect(leftRef.title).toBe('left')
    expect(childRef.title).toBe('left child')
  })

  it('captures prompt descendants as part of the executable subtree', () => {
    const store = buildStore()
    const snapshot = captureStoreExecutionSnapshot(store, 'left')

    store.getNode('left-prompt').title = 'changed prompt'

    restoreStoreExecutionSnapshot(store, snapshot)

    expect(store.getNode('left-prompt').title).toBe('left prompt')
  })

  it('restores scoped output and edges without deleting unrelated output', () => {
    const store = buildStore()
    markOutput(store, ['left', 'left-child', 'right'], ['left-edge', 'right-edge'])
    const snapshot = captureStoreExecutionSnapshot(store, 'left')

    store.createNode({id: 'left-new', parent: 'left', children: [], title: 'left new'})
    store.createEdge({id: 'left-new-edge', start: 'left', end: 'left-new'})
    store.saveEdgeToOutput('left-new-edge')
    store.saveNodeToOutput('right-child')

    restoreStoreExecutionSnapshot(store, snapshot)

    expect(store.getOutput().nodes.map(node => node.id)).toEqual(['right', 'right-child', 'left', 'left-child'])
    expect(store.getOutput().edges.map(edge => edge.id)).toEqual(['right-edge', 'left-edge'])
  })

  it('falls back to full-store restoration when no root id is provided', () => {
    const store = buildStore()
    const snapshot = captureStoreExecutionSnapshot(store)

    store.getNode('left').title = 'left changed'
    store.getNode('right').title = 'right changed'
    store.createNode({id: 'new-root-child', parent: 'root', children: [], title: 'new'})

    restoreStoreExecutionSnapshot(store, snapshot)

    expect(store.getNode('left').title).toBe('left')
    expect(store.getNode('right').title).toBe('right')
    expect(store.getNode('new-root-child')).toBeUndefined()
  })

  it.each([
    ['file', 'left-file', 'left-new-file'],
    ['image', 'left-image', 'left-new-image'],
  ])('restores %s references in scoped nodes without deleting unrelated sibling files', (field, existingId, newId) => {
    const store = buildStore()
    const snapshot = captureStoreExecutionSnapshot(store, 'left')

    store._files[existingId] = `changed ${field} content`
    createScopedAssetNode(store, field, newId)
    store._files['right-file'] = 'changed right file content'

    restoreStoreExecutionSnapshot(store, snapshot)

    expect(store.getFile(existingId)).toBe(`${field === 'file' ? 'left file' : 'left image'} content`)
    expect(store.getFile(newId)).toBeUndefined()
    expect(store.getFile('right-file')).toBe('changed right file content')
  })

  it('restores node metadata and removes prompt descendants created after capture', () => {
    const store = buildStore()
    store.getNode('left').reliabilityMetadata = {winnerForkIndex: 0, total: 2}
    const snapshot = captureStoreExecutionSnapshot(store, 'left')

    store.getNode('left').reliabilityMetadata = {winnerForkIndex: 1, total: 2, discardedForks: [{forkIndex: 0}]}
    store.createNode({id: 'left-failed-prompt', parent: 'left', children: [], title: 'failed prompt'}, true)

    restoreStoreExecutionSnapshot(store, snapshot)

    expect(store.getNode('left').reliabilityMetadata).toEqual({winnerForkIndex: 0, total: 2})
    expect(store.getNode('left').prompts).toEqual(['left-prompt'])
    expect(store.getNode('left-failed-prompt')).toBeUndefined()
  })
})
