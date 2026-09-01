import { describe, expect, it, vi } from 'vitest'
import {
  collectAttachmentReferences,
  deleteAttachmentFiles,
  type AttachmentLifecycleDeps,
} from '../workflow-attachment-lifecycle'

const baseNodes = {
  root: { id: 'root', title: 'Root', children: ['a', 'b', 'c'] },
  a: { id: 'a', parent: 'root', title: 'A', file: 'file-a' },
  b: { id: 'b', parent: 'root', title: 'B', file: 'file-a' },
  c: { id: 'c', parent: 'root', title: 'C', file: 'file-c' },
} as const

function makeDeps(): AttachmentLifecycleDeps {
  return {
    workflowId: 'wf-test',
    deleteFile: vi.fn().mockResolvedValue(undefined),
    onError: vi.fn(),
  }
}

describe('collectAttachmentReferences', () => {
  it('deduplicates shared file ids and preserves first-seen traversal order', () => {
    const references = collectAttachmentReferences(baseNodes, new Set(['root', 'a', 'b', 'c']))

    expect(references).toEqual([
      { nodeId: 'a', fileId: 'file-a' },
      { nodeId: 'c', fileId: 'file-c' },
    ])
  })

  it('returns empty for an empty node id input', () => {
    expect(collectAttachmentReferences(baseNodes, new Set())).toEqual([])
    expect(collectAttachmentReferences(baseNodes, [])).toEqual([])
  })

  it('skips missing ids and file ids still referenced by surviving nodes', () => {
    const references = collectAttachmentReferences(baseNodes, new Set(['a', 'ghost-id', 'c']))

    expect(references).toEqual([{ nodeId: 'c', fileId: 'file-c' }])
  })

  it('does not delete a shared file until every referencing node is removed', () => {
    expect(collectAttachmentReferences(baseNodes, new Set(['a']))).toEqual([])
    expect(collectAttachmentReferences(baseNodes, new Set(['a', 'b']))).toEqual([{ nodeId: 'a', fileId: 'file-a' }])
  })

  it('accepts a plain array of node ids in addition to a Set', () => {
    const fromArray = collectAttachmentReferences(baseNodes, ['a', 'c'])
    const fromSet = collectAttachmentReferences(baseNodes, new Set(['a', 'c']))

    expect(fromArray).toEqual(fromSet)
  })
})

describe('deleteAttachmentFiles', () => {
  it('returns true immediately and makes no API calls for empty references', async () => {
    const deps = makeDeps()

    const deleted = await deleteAttachmentFiles(deps, [])

    expect(deleted).toBe(true)
    expect(deps.deleteFile).not.toHaveBeenCalled()
  })

  it('deletes all references in declared order and returns true when all succeed', async () => {
    const deps = makeDeps()

    const deleted = await deleteAttachmentFiles(deps, [
      { nodeId: 'a', fileId: 'file-a' },
      { nodeId: 'c', fileId: 'file-c' },
    ])

    expect(deleted).toBe(true)
    expect(deps.deleteFile).toHaveBeenCalledTimes(2)
    expect(deps.deleteFile).toHaveBeenNthCalledWith(1, 'wf-test', 'file-a')
    expect(deps.deleteFile).toHaveBeenNthCalledWith(2, 'wf-test', 'file-c')
  })

  it('continues after a real failure so later resources are not silently orphaned', async () => {
    const deps = makeDeps()
    vi.mocked(deps.deleteFile).mockRejectedValueOnce(new Error('storage unavailable'))

    const deleted = await deleteAttachmentFiles(deps, [
      { nodeId: 'a', fileId: 'file-a' },
      { nodeId: 'c', fileId: 'file-c' },
    ])

    expect(deleted).toBe(false)
    expect(deps.deleteFile).toHaveBeenCalledTimes(2)
    expect(vi.mocked(deps.onError)).toHaveBeenCalledWith('workflowTree.attachment.deleteFailed')
  })

  it('attempts the complete set when an interior deletion fails', async () => {
    const deps = makeDeps()
    vi.mocked(deps.deleteFile)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('storage unavailable'))
      .mockResolvedValueOnce(undefined)

    const deleted = await deleteAttachmentFiles(deps, [
      { nodeId: 'a', fileId: 'file-a' },
      { nodeId: 'c', fileId: 'file-c' },
      { nodeId: 'd', fileId: 'file-d' },
    ])

    expect(deleted).toBe(false)
    expect(deps.deleteFile).toHaveBeenCalledTimes(3)
    expect(vi.mocked(deps.onError)).toHaveBeenCalledWith('workflowTree.attachment.deleteFailed')
  })

  it.each([
    {
      description: 'first position',
      setupMocks: (deleteFile: ReturnType<typeof vi.fn>) => {
        deleteFile.mockRejectedValueOnce(new Error('Workflow file not found')).mockResolvedValue(undefined)
      },
      expectedCallCount: 3,
    },
    {
      description: 'interior position',
      setupMocks: (deleteFile: ReturnType<typeof vi.fn>) => {
        deleteFile
          .mockResolvedValueOnce(undefined)
          .mockRejectedValueOnce(new Error('Workflow file not found'))
          .mockResolvedValueOnce(undefined)
      },
      expectedCallCount: 3,
    },
    {
      description: 'every position',
      setupMocks: (deleteFile: ReturnType<typeof vi.fn>) => {
        deleteFile.mockRejectedValue(new Error('Workflow file not found'))
      },
      expectedCallCount: 3,
    },
  ])(
    'treats a not-found error at $description as idempotent success — all remaining references are still attempted',
    async ({ setupMocks, expectedCallCount }) => {
      const deps = makeDeps()
      setupMocks(vi.mocked(deps.deleteFile))

      const deleted = await deleteAttachmentFiles(deps, [
        { nodeId: 'a', fileId: 'file-a' },
        { nodeId: 'b', fileId: 'file-b' },
        { nodeId: 'c', fileId: 'file-c' },
      ])

      expect(deleted).toBe(true)
      expect(deps.deleteFile).toHaveBeenCalledTimes(expectedCallCount)
      expect(vi.mocked(deps.onError)).not.toHaveBeenCalled()
    },
  )

  it('treats a not-found error as idempotent success but does not suppress a subsequent real failure', async () => {
    const deps = makeDeps()
    vi.mocked(deps.deleteFile)
      .mockRejectedValueOnce(new Error('Workflow file not found'))
      .mockRejectedValueOnce(new Error('storage unavailable'))

    const deleted = await deleteAttachmentFiles(deps, [
      { nodeId: 'a', fileId: 'file-a' },
      { nodeId: 'b', fileId: 'file-b' },
      { nodeId: 'c', fileId: 'file-c' },
    ])

    expect(deleted).toBe(false)
    expect(deps.deleteFile).toHaveBeenCalledTimes(3)
    expect(vi.mocked(deps.onError)).toHaveBeenCalledWith('workflowTree.attachment.deleteFailed')
  })
})
