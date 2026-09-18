import { describe, it, expect, vi, beforeEach } from 'vitest'
import { reconcileRemoveFlush } from '../workflow-remove-flush-reconciler'
import type { RemoveFlushReconcilerDeps } from '../workflow-remove-flush-reconciler'
import type { DebouncedPersister } from '../workflow-store-persistence'
import type { ReadWorkflowFn } from '../workflow-store-types'
import type { NodeId } from '@shared/base-types'

function makePersister(...flushResults: boolean[]): DebouncedPersister {
  const flush = vi.fn()
  for (const r of flushResults) {
    flush.mockResolvedValueOnce(r)
  }
  flush.mockResolvedValue(true)
  return { flush, schedule: vi.fn(), cancel: vi.fn(), destroy: vi.fn() }
}

function makeReadWorkflow(fileIdsOnServer: string[] = []): ReadWorkflowFn {
  const nodes: Record<NodeId, { id: NodeId; title: string; children: string[]; file?: string }> = {}
  fileIdsOnServer.forEach((fileId, i) => {
    const id = `server-node-${i}` as NodeId
    nodes[id] = { id, title: `Node ${i}`, children: [], file: fileId }
  })
  return vi.fn().mockResolvedValue({ nodes, edges: {}, root: undefined })
}

function makeDeps(overrides: Partial<RemoveFlushReconcilerDeps> = {}): RemoveFlushReconcilerDeps {
  return {
    persister: makePersister(true),
    workflowId: 'wf-test',
    readWorkflow: makeReadWorkflow(),
    removedFileIds: ['file-a'],
    onDanglingLinkSurvived: vi.fn(),
    ...overrides,
  }
}

describe('reconcileRemoveFlush', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('flush succeeds within the retry window', () => {
    it('confirms authoritative readback after a single successful flush', async () => {
      const deps = makeDeps({ persister: makePersister(true) })

      const clean = await reconcileRemoveFlush(deps)

      expect(deps.persister.flush).toHaveBeenCalledTimes(1)
      expect(deps.readWorkflow).toHaveBeenCalledWith('wf-test')
      expect(deps.onDanglingLinkSurvived).not.toHaveBeenCalled()
      expect(clean).toBe(true)
    })

    it.each([
      { label: 'second', failsBefore: 1 },
      { label: 'third', failsBefore: 2 },
    ])('resolves on the $label attempt and confirms authoritative readback', async ({ failsBefore }) => {
      vi.useFakeTimers()
      try {
        const failures = Array.from<boolean>({ length: failsBefore }).fill(false)
        const deps = makeDeps({ persister: makePersister(...failures, true) })

        void reconcileRemoveFlush(deps)
        await vi.runAllTimersAsync()

        expect(deps.persister.flush).toHaveBeenCalledTimes(failsBefore + 1)
        expect(deps.readWorkflow).toHaveBeenCalledWith('wf-test')
        expect(deps.onDanglingLinkSurvived).not.toHaveBeenCalled()
      } finally {
        vi.useRealTimers()
      }
    })
  })

  describe('retry limit exhaustion — readback decides outcome', () => {
    it('makes exactly three flush attempts before falling through to the readback', async () => {
      vi.useFakeTimers()
      try {
        const deps = makeDeps({
          persister: makePersister(false, false, false),
          readWorkflow: makeReadWorkflow(),
        })

        void reconcileRemoveFlush(deps)
        await vi.runAllTimersAsync()

        expect(deps.persister.flush).toHaveBeenCalledTimes(3)
        expect(deps.readWorkflow).toHaveBeenCalledTimes(1)
      } finally {
        vi.useRealTimers()
      }
    })

    it('calls onDanglingLinkSurvived when the server still holds a removed file ID', async () => {
      vi.useFakeTimers()
      try {
        const deps = makeDeps({
          persister: makePersister(false, false, false),
          readWorkflow: makeReadWorkflow(['file-a']),
        })

        void reconcileRemoveFlush(deps)
        await vi.runAllTimersAsync()

        expect(deps.onDanglingLinkSurvived).toHaveBeenCalledTimes(1)
      } finally {
        vi.useRealTimers()
      }
    })

    it('stays silent when the server no longer references any removed file ID', async () => {
      vi.useFakeTimers()
      try {
        const deps = makeDeps({
          persister: makePersister(false, false, false),
          readWorkflow: makeReadWorkflow([]),
        })

        void reconcileRemoveFlush(deps)
        await vi.runAllTimersAsync()

        expect(deps.onDanglingLinkSurvived).not.toHaveBeenCalled()
      } finally {
        vi.useRealTimers()
      }
    })

    it('calls onDanglingLinkSurvived when readback throws — cannot confirm the server is clean after flush exhaustion', async () => {
      vi.useFakeTimers()
      try {
        const deps = makeDeps({
          persister: makePersister(false, false, false),
          readWorkflow: vi.fn().mockRejectedValue(new Error('network timeout')) as unknown as ReadWorkflowFn,
        })

        void reconcileRemoveFlush(deps)
        await vi.runAllTimersAsync()

        expect(deps.onDanglingLinkSurvived).toHaveBeenCalledTimes(1)
      } finally {
        vi.useRealTimers()
      }
    })
  })

  describe('file ID matching in the server readback', () => {
    it('stays silent when the removed ID list is empty regardless of what the server holds', async () => {
      vi.useFakeTimers()
      try {
        const deps = makeDeps({
          persister: makePersister(false, false, false),
          removedFileIds: [],
          readWorkflow: makeReadWorkflow(['file-x', 'file-y']),
        })

        void reconcileRemoveFlush(deps)
        await vi.runAllTimersAsync()

        expect(deps.onDanglingLinkSurvived).not.toHaveBeenCalled()
      } finally {
        vi.useRealTimers()
      }
    })

    it('calls onDanglingLinkSurvived when the server retains any one of multiple removed file IDs', async () => {
      vi.useFakeTimers()
      try {
        const deps = makeDeps({
          persister: makePersister(false, false, false),
          removedFileIds: ['file-a', 'file-b', 'file-c'],
          readWorkflow: makeReadWorkflow(['file-c']),
        })

        void reconcileRemoveFlush(deps)
        await vi.runAllTimersAsync()

        expect(deps.onDanglingLinkSurvived).toHaveBeenCalledTimes(1)
      } finally {
        vi.useRealTimers()
      }
    })

    it('stays silent when server file links all belong to IDs outside the removed set', async () => {
      vi.useFakeTimers()
      try {
        const deps = makeDeps({
          persister: makePersister(false, false, false),
          removedFileIds: ['file-a'],
          readWorkflow: makeReadWorkflow(['file-unrelated']),
        })

        void reconcileRemoveFlush(deps)
        await vi.runAllTimersAsync()

        expect(deps.onDanglingLinkSurvived).not.toHaveBeenCalled()
      } finally {
        vi.useRealTimers()
      }
    })
  })
})
