import {collectSubtreeIds} from './storeSubtreeUtils'

const clearPromptSubtrees = (store, parentId) => {
  const parent = store.getNode(parentId)
  if (!parent) return

  const removeIds = collectSubtreeIds(store, parent.prompts ?? [])
  removeIds.forEach(id => {
    delete store._nodes[id]
  })

  // fresh object prevents shared-reference mutation when this node is aliased by a fork store
  store._nodes[parentId] = {
    ...parent,
    children: (parent.children ?? []).filter(id => !removeIds.has(id)),
    prompts: [],
  }
}

const cloneNodeData = (sourceNode, parentId) => ({
  ...sourceNode,
  id: undefined,
  parent: parentId,
  children: [],
  prompts: [],
})

const copySubtree = (sourceStore, targetStore, sourceNodeId, targetParentId) => {
  const sourceNode = sourceStore.getNode(sourceNodeId)
  if (!sourceNode) return null

  const copied = targetStore.createNode(cloneNodeData(sourceNode, targetParentId))

  const promptIds = new Set(sourceNode.prompts ?? [])
  for (const childId of (sourceNode.children ?? []).filter(id => !promptIds.has(id))) {
    copySubtree(sourceStore, targetStore, childId, copied.id)
  }

  const copiedPromptIds = (sourceNode.prompts ?? [])
    .map(promptId => copySubtree(sourceStore, targetStore, promptId, copied.id))
    .filter(Boolean)

  if (copiedPromptIds.length > 0) {
    targetStore.addPromptsToNode(copied.id, copiedPromptIds)
  }

  return copied.id
}

export const copyParentPromptOutputToRefine = ({sourceStore, targetStore, parentNodeId, refineNodeId}) => {
  const sourceParent = sourceStore.getNode(parentNodeId)
  const targetRefine = targetStore.getNode(refineNodeId)
  if (!sourceParent || !targetRefine) return []

  clearPromptSubtrees(targetStore, refineNodeId)

  const copiedPromptIds = (sourceParent.prompts ?? [])
    .map(promptId => copySubtree(sourceStore, targetStore, promptId, refineNodeId))
    .filter(Boolean)

  if (copiedPromptIds.length > 0) {
    targetStore.addPromptsToNode(refineNodeId, copiedPromptIds)
  }

  return copiedPromptIds
}
