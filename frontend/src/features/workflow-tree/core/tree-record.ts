import type { TreeRecord, TreeNode, TreeComputeOptions } from './types'

export function createRecord(value: TreeNode, _options: TreeComputeOptions): TreeRecord {
  return {
    id: value.id,
    data: value,
    isOpen: value.isOpen,
  }
}

export function updateRecord(_record: TreeRecord, _id: string, _options: TreeComputeOptions): void {
  /* No-op for basic implementation */
}

export function updateRecordOnNewData(record: TreeRecord, _options: TreeComputeOptions): void {
  record.isOpen = record.data.isOpen
}

export function shouldUpdateRecords(options: TreeComputeOptions): boolean {
  return !!options.refreshNodes
}
