import type { TreeState, TreeComputeOptions, TreeWalkerGenerator, TreeNode } from './types'
import { createRecord, shouldUpdateRecords, updateRecord, updateRecordOnNewData } from './tree-record'

export function computeTree(
  treeWalker: TreeWalkerGenerator,
  prevState: TreeState,
  options: TreeComputeOptions = {},
): TreeState {
  const order: string[] = []
  const records = { ...prevState.records }
  const iter = treeWalker(options.refreshNodes || false)

  if (shouldUpdateRecords(options)) {
    const keys = Object.keys(records)
    for (let i = 0; i < keys.length; i += 1) {
      const id = keys[i]
      updateRecord(records[id], id, options)
    }
  }

  let isPreviousOpened = false

  while (true) {
    const { done, value } = iter.next(isPreviousOpened)

    if (done || !value) break

    let id: string

    if (typeof value === 'string') {
      id = value
    } else {
      id = value.id
      const record = records[id]

      if (!record) {
        records[id] = createRecord(value as TreeNode, options)
      } else {
        record.data = value as TreeNode
        updateRecordOnNewData(record, options)
      }
    }

    if (records[id]) {
      order.push(id)
      isPreviousOpened = records[id].isOpen
    }
  }

  return { order, records }
}
