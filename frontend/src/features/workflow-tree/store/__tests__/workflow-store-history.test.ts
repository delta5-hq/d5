import { describe, it, expect } from 'vitest'
import { createHistoryStack, type HistorySnapshot } from '../workflow-store-history'

function snap(label: string): HistorySnapshot {
  return { nodes: { [label]: { id: label, children: [] } }, edges: {}, root: label }
}

describe('createHistoryStack', () => {
  describe('empty-stack behaviour', () => {
    it('undo returns undefined when no checkpoints exist', () => {
      const h = createHistoryStack()
      expect(h.undo(snap('a'))).toBeUndefined()
    })

    it('redo returns undefined when no undos have been performed', () => {
      const h = createHistoryStack()
      expect(h.redo(snap('a'))).toBeUndefined()
    })

    it('calling undo does not push anything onto the redo stack', () => {
      const h = createHistoryStack()
      h.undo(snap('a'))
      expect(h.redo(snap('b'))).toBeUndefined()
    })
  })

  describe('checkpoint → undo', () => {
    it('undo returns the most recently checkpointed snapshot', () => {
      const h = createHistoryStack()
      const before = snap('before')
      h.checkpoint(before)
      expect(h.undo(snap('after'))).toEqual(before)
    })

    it('multiple undos walk back through history in reverse checkpoint order', () => {
      const h = createHistoryStack()
      const s1 = snap('s1')
      const s2 = snap('s2')
      const s3 = snap('s3')
      h.checkpoint(s1)
      h.checkpoint(s2)
      h.checkpoint(s3)
      expect(h.undo(snap('current'))).toEqual(s3)
      expect(h.undo(snap('current'))).toEqual(s2)
      expect(h.undo(snap('current'))).toEqual(s1)
      expect(h.undo(snap('current'))).toBeUndefined()
    })

    it('undo pushes current state onto the redo stack', () => {
      const h = createHistoryStack()
      const before = snap('before')
      const after = snap('after')
      h.checkpoint(before)
      h.undo(after)
      expect(h.redo(snap('anything'))).toEqual(after)
    })
  })

  describe('checkpoint → undo → redo round-trip', () => {
    it('redo restores the state that was current at undo time', () => {
      const h = createHistoryStack()
      const a = snap('a')
      const b = snap('b')
      h.checkpoint(a)
      h.undo(b)
      expect(h.redo(a)).toEqual(b)
    })

    it('full round-trip: checkpoint → undo → redo → undo yields original snapshot', () => {
      const h = createHistoryStack()
      const before = snap('before')
      const after = snap('after')
      h.checkpoint(before)
      h.undo(after)
      h.redo(before)
      expect(h.undo(after)).toEqual(before)
    })

    it('multiple undo then multiple redo restores all states in order', () => {
      const h = createHistoryStack()
      const s1 = snap('s1')
      const s2 = snap('s2')
      h.checkpoint(s1)
      h.checkpoint(s2)
      const atS3 = snap('s3')
      h.undo(atS3)
      const atS2 = s2
      h.undo(atS2)
      expect(h.redo(s1)).toEqual(atS2)
      expect(h.redo(atS2)).toEqual(atS3)
    })
  })

  describe('checkpoint clears redo stack', () => {
    it('new checkpoint after undo makes redo return undefined', () => {
      const h = createHistoryStack()
      h.checkpoint(snap('a'))
      h.undo(snap('b'))
      h.checkpoint(snap('c'))
      expect(h.redo(snap('c'))).toBeUndefined()
    })

    it('redo is unavailable even if multiple undos preceded the new checkpoint', () => {
      const h = createHistoryStack()
      h.checkpoint(snap('a'))
      h.checkpoint(snap('b'))
      h.undo(snap('c'))
      h.undo(snap('b'))
      h.checkpoint(snap('d'))
      expect(h.redo(snap('d'))).toBeUndefined()
    })
  })

  describe('clear', () => {
    it('clear makes undo return undefined', () => {
      const h = createHistoryStack()
      h.checkpoint(snap('a'))
      h.clear()
      expect(h.undo(snap('b'))).toBeUndefined()
    })

    it('clear also empties the redo stack', () => {
      const h = createHistoryStack()
      h.checkpoint(snap('a'))
      h.undo(snap('b'))
      h.clear()
      expect(h.redo(snap('a'))).toBeUndefined()
    })
  })

  describe('capacity cap', () => {
    it('caps undo stack at 50 snapshots, evicting the oldest', () => {
      const h = createHistoryStack()
      for (let i = 0; i < 60; i++) h.checkpoint(snap(`s${i}`))
      let count = 0
      while (h.undo(snap('cur'))) count++
      expect(count).toBe(50)
    })

    it('oldest snapshot is evicted first (FIFO eviction)', () => {
      const h = createHistoryStack()
      const oldest = snap('oldest')
      h.checkpoint(oldest)
      for (let i = 0; i < 50; i++) h.checkpoint(snap(`fill${i}`))
      let last: HistorySnapshot | undefined
      let s: HistorySnapshot | undefined
      while ((s = h.undo(snap('cur')))) last = s
      expect(last).not.toEqual(oldest)
    })
  })

  describe('instance isolation', () => {
    it('two history stacks do not share state', () => {
      const h1 = createHistoryStack()
      const h2 = createHistoryStack()
      h1.checkpoint(snap('h1-state'))
      expect(h2.undo(snap('x'))).toBeUndefined()
    })
  })
})
