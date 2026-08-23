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

export const copyParentPromptOutputToElect = ({sourceStore, targetStore, parentNodeId, electNodeId}) => {
  const sourceParent = sourceStore.getNode(parentNodeId)
  const targetElect = targetStore.getNode(electNodeId)
  if (!sourceParent || !targetElect) return []

  clearPromptSubtrees(targetStore, electNodeId)

  const copiedPromptIds = (sourceParent.prompts ?? [])
    .map(promptId => copySubtree(sourceStore, targetStore, promptId, electNodeId))
    .filter(Boolean)

  if (copiedPromptIds.length > 0) {
    targetStore.addPromptsToNode(electNodeId, copiedPromptIds)
  }

  return copiedPromptIds
}
