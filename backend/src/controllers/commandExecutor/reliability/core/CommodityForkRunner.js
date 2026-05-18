import debug from 'debug'
import StoreFork from './StoreFork'
import {runCommand} from '../../commands/utils/runCommand'
import NullProgress from './NullProgress'

const log = debug('delta5:commodity-fork')

const MEMO_KEY_PREFIX = 'commodity'

const memoKey = cellId => `${MEMO_KEY_PREFIX}:${cellId}`

export const isCommodityForkInProgress = (cellId, memoMap) => memoMap?.has(memoKey(cellId)) ?? false

export const markCommodityForkInProgress = (cellId, memoMap) => {
  memoMap.set(memoKey(cellId), 'in-progress')
}

const collectNewChildIds = (forkCellNode, originalChildIds) => {
  if (!forkCellNode) return []
  return (forkCellNode.children ?? []).filter(id => !originalChildIds.has(id))
}

const mergeChildrenIntoStore = (targetStore, forkStore, newChildIds, cellId) => {
  if (newChildIds.length === 0) return

  for (const childId of newChildIds) {
    StoreFork.applyCandidate(targetStore, forkStore, childId)
  }

  const cellNode = targetStore.getNode(cellId)
  if (!cellNode) return

  for (const childId of newChildIds) {
    if (!cellNode.children.includes(childId)) {
      cellNode.children.push(childId)
    }
  }
  targetStore.saveNodeToOutput(cellId)
}

/**
 * N-1 forks because the first execution already ran as the main `runCommand` call.
 *
 * Each fork runs with `preventPostProcess: true` — post-processing of sibling
 * child nodes (/refine, /validate, etc.) is deferred to the top-level
 * runCommand call after all forks are merged.
 *
 * Caller must set the commodity memo key in `memoMap` before invoking this
 * function. Each fork receives a copy so nested runCommand calls see the key
 * and skip commodity forking, preventing recursive re-entry.
 *
 * @param {{
 *   cell: import('../../commands/utils/Store').NodeData,
 *   store: import('../../commands/utils/Store').default,
 *   n: number,
 *   queryType: string|undefined,
 *   mcpAlias: object|undefined,
 *   rpcAlias: object|undefined,
 *   signal: AbortSignal|null,
 *   context: string,
 *   prompt: string,
 *   memoMap: Map<string, *>,
 * }} params
 */
export const runCommodityForks = async ({
  cell,
  store,
  n,
  queryType,
  mcpAlias,
  rpcAlias,
  signal,
  context,
  prompt,
  memoMap,
}) => {
  const cellNode = store.getNode(cell.id)
  const originalChildIds = new Set(cellNode?.children ?? [])
  const additionalForkCount = n - 1

  const settled = await Promise.allSettled(
    Array.from({length: additionalForkCount}, async () => {
      const forkStore = StoreFork.createFork(store)
      const forkMemoMap = new Map(memoMap)
      const forkCell = forkStore.getNode(cell.id) ?? cell

      await runCommand(
        {
          queryType,
          context,
          prompt,
          cell: forkCell,
          store: forkStore,
          mcpAlias,
          rpcAlias,
          signal,
          memoMap: forkMemoMap,
          preventPostProcess: true,
        },
        new NullProgress(),
      )

      return forkStore
    }),
  )

  for (const result of settled) {
    if (result.status !== 'fulfilled') {
      log('fork failed: %O', result.reason)
      continue
    }

    const forkStore = result.value
    const forkCellNode = forkStore.getNode(cell.id)
    const newChildIds = collectNewChildIds(forkCellNode, originalChildIds)
    mergeChildrenIntoStore(store, forkStore, newChildIds, cell.id)
    newChildIds.forEach(id => originalChildIds.add(id))
  }
}
