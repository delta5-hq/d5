import {isCommodityForkSuccess} from './commodityForkSuccess'
import {appendCommoditySuffix} from './reliabilitySuffix'

const successfulPromptNodes = (forkStore, forkCell, forkIndex) =>
  (forkCell?.prompts ?? [])
    .map(promptId => forkStore.getNode(promptId))
    .filter(node => isCommodityForkSuccess(node, forkIndex))

const collectSubtreeIds = (store, rootIds) => {
  const pending = [...rootIds]
  const collected = new Set()

  while (pending.length > 0) {
    const id = pending.pop()
    if (!id || collected.has(id)) continue
    const node = store.getNode(id)
    if (!node) continue
    collected.add(id)
    pending.push(...(node.children ?? []))
  }

  return collected
}

const clearPreviousPromptSubtrees = (store, parentId) => {
  const parent = store.getNode(parentId)
  if (!parent) return

  const promptIds = parent.prompts ?? []
  const removeIds = collectSubtreeIds(store, promptIds)

  removeIds.forEach(id => {
    delete store._nodes[id]
  })

  store.editNode({
    id: parentId,
    children: (parent.children ?? []).filter(id => !removeIds.has(id)),
    prompts: [],
  })
}

const copySuccessfulPromptNodes = (targetStore, parentId, promptNodesByFork) => {
  const copiedIds = []

  promptNodesByFork.flat().forEach(node => {
    const copied = targetStore.createNode({parent: parentId, title: node.title})
    copiedIds.push(copied.id)
  })

  if (copiedIds.length > 0) {
    targetStore.addPromptsToNode(parentId, copiedIds)
  }
}

const appendResultSuffix = (store, cellId, successCount, total) => {
  const cellNode = store.getNode(cellId)
  if (!cellNode) return
  cellNode.title = appendCommoditySuffix(cellNode.title || '', {successCount, total})
  store.saveNodeToOutput(cellId)
}

export const mergeCommodityForkOutputs = ({store, forkStores, cellId, total}) => {
  if (!store.getNode(cellId)) return {successCount: 0, total}

  clearPreviousPromptSubtrees(store, cellId)

  const successfulPromptNodesByFork = forkStores.map((forkStore, forkIndex) => {
    const forkCell = forkStore.getNode(cellId)
    return successfulPromptNodes(forkStore, forkCell, forkIndex)
  })
  const successCount = successfulPromptNodesByFork.filter(promptNodes => promptNodes.length > 0).length

  copySuccessfulPromptNodes(store, cellId, successfulPromptNodesByFork)

  appendResultSuffix(store, cellId, successCount, total)

  return {successCount, total}
}
