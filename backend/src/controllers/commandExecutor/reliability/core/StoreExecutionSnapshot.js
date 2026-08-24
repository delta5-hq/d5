const clone = value => JSON.parse(JSON.stringify(value ?? {}))

const childIdsOf = node => [...(node.children ?? []), ...(node.prompts ?? [])]

const referencedFileIdsOf = node => [node?.file, node?.image].filter(Boolean)

const collectSubtreeNodeIds = (store, rootId) => {
  if (!rootId || !store.getNode(rootId)) return new Set(Object.keys(store._nodes))
  const ids = new Set()
  const stack = [rootId]

  while (stack.length > 0) {
    const id = stack.pop()
    if (!id || ids.has(id)) continue
    const node = store.getNode(id)
    if (!node) continue
    ids.add(id)
    stack.push(...childIdsOf(node))
  }

  return ids
}

const edgeBelongsToNodes = (edge, nodeIds) => nodeIds.has(edge?.start) || nodeIds.has(edge?.end)

const entriesForIds = (record, ids) =>
  Object.fromEntries([...ids].map(id => [id, record[id]]).filter(([, value]) => value))

const edgeIdsForNodes = (edges, nodeIds) =>
  new Set(
    Object.values(edges)
      .filter(edge => edgeBelongsToNodes(edge, nodeIds))
      .map(edge => edge.id),
  )

const referencedFileIdsForNodes = (nodes, nodeIds) =>
  new Set(
    [...nodeIds]
      .map(id => nodes[id])
      .flatMap(referencedFileIdsOf)
      .filter(Boolean),
  )

const withoutIds = (ids, blockedIds) => ids.filter(id => !blockedIds.has(id))

const uniqueIds = ids => [...new Set(ids)]

const replaceRecordValue = (record, id, value) => {
  if (typeof value !== 'object' || value === null) {
    record[id] = value
    return
  }

  if (!record[id]) {
    record[id] = value
    return
  }

  if (typeof record[id] !== 'object' || record[id] === null) {
    record[id] = value
    return
  }

  Object.keys(record[id]).forEach(key => delete record[id][key])
  Object.assign(record[id], value)
}

const deleteAbsentIds = (record, currentIds, nextIds) => {
  currentIds.forEach(id => {
    if (!nextIds.has(id)) delete record[id]
  })
}

const restoreRecordValues = (record, values) => {
  Object.entries(clone(values)).forEach(([id, value]) => replaceRecordValue(record, id, value))
}

export const captureStoreExecutionSnapshot = (store, rootId = null) => {
  const nodeIds = collectSubtreeNodeIds(store, rootId)
  const edgeIds = edgeIdsForNodes(store._edges, nodeIds)
  const fileIds = referencedFileIdsForNodes(store._nodes, nodeIds)

  return {
    rootId,
    nodeIds: [...nodeIds],
    edgeIds: [...edgeIds],
    fileIds: [...fileIds],
    nodes: clone(entriesForIds(store._nodes, nodeIds)),
    edges: clone(entriesForIds(store._edges, edgeIds)),
    files: clone(entriesForIds(store._files, fileIds)),
    output: {
      nodes: store._output.nodes.filter(id => nodeIds.has(id)),
      edges: store._output.edges.filter(id => edgeIds.has(id)),
    },
  }
}

export const restoreStoreExecutionSnapshot = (store, snapshot, {attemptSnapshots = []} = {}) => {
  const currentNodeIds = collectSubtreeNodeIds(store, snapshot.rootId)
  const currentEdgeIds = edgeIdsForNodes(store._edges, currentNodeIds)
  const currentFileIds = referencedFileIdsForNodes(store._nodes, currentNodeIds)
  const snapshotNodeIds = new Set(snapshot.nodeIds)
  const snapshotEdgeIds = new Set(snapshot.edgeIds)
  const snapshotFileIds = new Set(snapshot.fileIds ?? [])
  const replacementNodeIds = new Set([
    ...currentNodeIds,
    ...snapshotNodeIds,
    ...attemptSnapshots.flatMap(item => item.nodeIds ?? []),
  ])
  const replacementEdgeIds = new Set([
    ...currentEdgeIds,
    ...snapshotEdgeIds,
    ...attemptSnapshots.flatMap(item => item.edgeIds ?? []),
  ])
  const replacementFileIds = new Set([
    ...currentFileIds,
    ...snapshotFileIds,
    ...attemptSnapshots.flatMap(item => item.fileIds ?? []),
  ])
  const outsideNodeIds = new Set(Object.keys(store._nodes).filter(id => !replacementNodeIds.has(id)))
  const externallyReferencedFileIds = referencedFileIdsForNodes(store._nodes, outsideNodeIds)
  const deletableFileIds = new Set([...replacementFileIds].filter(id => !externallyReferencedFileIds.has(id)))

  deleteAbsentIds(store._nodes, replacementNodeIds, snapshotNodeIds)
  deleteAbsentIds(store._edges, replacementEdgeIds, snapshotEdgeIds)
  deleteAbsentIds(store._files, deletableFileIds, snapshotFileIds)
  restoreRecordValues(store._nodes, snapshot.nodes)
  restoreRecordValues(store._edges, snapshot.edges)
  restoreRecordValues(store._files, snapshot.files ?? {})

  store._output.nodes = uniqueIds([...withoutIds(store._output.nodes, replacementNodeIds), ...snapshot.output.nodes])
  store._output.edges = uniqueIds([...withoutIds(store._output.edges, replacementEdgeIds), ...snapshot.output.edges])
}
