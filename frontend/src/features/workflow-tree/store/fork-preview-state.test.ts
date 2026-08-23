import { describe, it, expect } from 'vitest'
import { applyForkEventToMap } from './fork-preview-state'
import type { ForkPreviewState } from './fork-preview-state'

describe('applyForkEventToMap', () => {
  describe('fork_started', () => {
    it('adds a pending entry for each started fork', () => {
      const m = new Map<string, ForkPreviewState>()
      const m1 = applyForkEventToMap(m, { type: 'fork_started', electNodeId: 'r1', forkIndex: 0, total: 3 })
      expect(m1.get('r1')?.forks[0]).toEqual({ forkIndex: 0, status: 'pending' })
    })

    it('sets the total from the event', () => {
      const m = new Map<string, ForkPreviewState>()
      const m1 = applyForkEventToMap(m, { type: 'fork_started', electNodeId: 'r1', forkIndex: 0, total: 5 })
      expect(m1.get('r1')?.total).toBe(5)
    })

    it('accumulates multiple fork_started events for the same node', () => {
      const m = new Map<string, ForkPreviewState>()
      const m1 = applyForkEventToMap(m, { type: 'fork_started', electNodeId: 'r1', forkIndex: 0, total: 2 })
      const m2 = applyForkEventToMap(m1, { type: 'fork_started', electNodeId: 'r1', forkIndex: 1, total: 2 })
      expect(m2.get('r1')?.forks).toHaveLength(2)
    })

    it('initialises winnerForkIndex as null', () => {
      const m = new Map<string, ForkPreviewState>()
      const m1 = applyForkEventToMap(m, { type: 'fork_started', electNodeId: 'r1', forkIndex: 0, total: 2 })
      expect(m1.get('r1')?.winnerForkIndex).toBeNull()
    })

    it('does not mutate the input map', () => {
      const m = new Map<string, ForkPreviewState>()
      applyForkEventToMap(m, { type: 'fork_started', electNodeId: 'r1', forkIndex: 0, total: 2 })
      expect(m.has('r1')).toBe(false)
    })
  })

  describe('fork_settled', () => {
    function baseMap(forks = 2): Map<string, ForkPreviewState> {
      let m = new Map<string, ForkPreviewState>()
      for (let i = 0; i < forks; i++) {
        m = applyForkEventToMap(m, { type: 'fork_started', electNodeId: 'r1', forkIndex: i, total: forks })
      }
      return m
    }

    it('updates the status of the matching fork', () => {
      const m1 = baseMap(2)
      const m2 = applyForkEventToMap(m1, {
        type: 'fork_settled',
        electNodeId: 'r1',
        forkIndex: 0,
        status: 'ok',
      })
      expect(m2.get('r1')?.forks[0].status).toBe('ok')
    })

    it('leaves other forks unchanged', () => {
      const m1 = baseMap(2)
      const m2 = applyForkEventToMap(m1, {
        type: 'fork_settled',
        electNodeId: 'r1',
        forkIndex: 0,
        status: 'ok',
      })
      expect(m2.get('r1')?.forks[1].status).toBe('pending')
    })

    it('attaches failedAt for criteria-failed forks', () => {
      const m1 = baseMap(2)
      const m2 = applyForkEventToMap(m1, {
        type: 'fork_settled',
        electNodeId: 'r1',
        forkIndex: 0,
        status: 'criteria-failed',
        failedAt: 'criterion text',
      })
      expect(m2.get('r1')?.forks[0].failedAt).toBe('criterion text')
    })

    it('attaches reason for runtime-failed forks', () => {
      const m1 = baseMap(2)
      const m2 = applyForkEventToMap(m1, {
        type: 'fork_settled',
        electNodeId: 'r1',
        forkIndex: 0,
        status: 'runtime-failed',
        reason: 'network error',
      })
      expect(m2.get('r1')?.forks[0].reason).toBe('network error')
    })

    it('is a no-op for unknown electNodeId', () => {
      const m1 = baseMap(2)
      const m2 = applyForkEventToMap(m1, {
        type: 'fork_settled',
        electNodeId: 'unknown',
        forkIndex: 0,
        status: 'ok',
      })
      expect(m2).toEqual(m1)
    })

    it('is a no-op for an unknown forkIndex within a known electNodeId', () => {
      const m1 = baseMap(2)
      const m2 = applyForkEventToMap(m1, {
        type: 'fork_settled',
        electNodeId: 'r1',
        forkIndex: 99,
        status: 'ok',
      })
      expect(m2.get('r1')?.forks).toHaveLength(2)
      expect(m2.get('r1')?.forks.every(f => f.status === 'pending')).toBe(true)
    })

    it('ok-settled entry has no failedAt or reason properties', () => {
      const m1 = baseMap(1)
      const m2 = applyForkEventToMap(m1, {
        type: 'fork_settled',
        electNodeId: 'r1',
        forkIndex: 0,
        status: 'ok',
      })
      const entry = m2.get('r1')?.forks[0]
      expect(entry).not.toHaveProperty('failedAt')
      expect(entry).not.toHaveProperty('reason')
    })

    it('criteria-failed event without failedAt does not add failedAt to entry', () => {
      const m1 = baseMap(1)
      const m2 = applyForkEventToMap(m1, {
        type: 'fork_settled',
        electNodeId: 'r1',
        forkIndex: 0,
        status: 'criteria-failed',
      })
      expect(m2.get('r1')?.forks[0]).not.toHaveProperty('failedAt')
    })

    it('does not mutate the input map', () => {
      const m1 = baseMap(2)
      const before = JSON.stringify([...m1])
      applyForkEventToMap(m1, { type: 'fork_settled', electNodeId: 'r1', forkIndex: 0, status: 'ok' })
      expect(JSON.stringify([...m1])).toBe(before)
    })

    describe('leafOutputs propagation', () => {
      it('attaches leafOutputs when present in the settled event', () => {
        const m1 = baseMap(1)
        const leaves = [{ nodeId: 'n1', content: 'response text' }]
        const m2 = applyForkEventToMap(m1, {
          type: 'fork_settled',
          electNodeId: 'r1',
          forkIndex: 0,
          status: 'ok',
          leafOutputs: leaves,
        })
        expect(m2.get('r1')?.forks[0].leafOutputs).toEqual(leaves)
      })

      it('does not attach leafOutputs when absent from the event', () => {
        const m1 = baseMap(1)
        const m2 = applyForkEventToMap(m1, {
          type: 'fork_settled',
          electNodeId: 'r1',
          forkIndex: 0,
          status: 'ok',
        })
        expect(m2.get('r1')?.forks[0]).not.toHaveProperty('leafOutputs')
      })

      it('preserves leafOutputs on an ok fork while another fork remains pending', () => {
        const m1 = baseMap(2)
        const leaves = [{ nodeId: 'out1', content: 'winner content' }]
        const m2 = applyForkEventToMap(m1, {
          type: 'fork_settled',
          electNodeId: 'r1',
          forkIndex: 0,
          status: 'ok',
          leafOutputs: leaves,
        })
        expect(m2.get('r1')?.forks[0].leafOutputs).toEqual(leaves)
        expect(m2.get('r1')?.forks[1].leafOutputs).toBeUndefined()
      })

      it('attaches leafOutputs for criteria-failed forks', () => {
        const m1 = baseMap(1)
        const leaves = [{ nodeId: 'n1', content: 'partial content before failure' }]
        const m2 = applyForkEventToMap(m1, {
          type: 'fork_settled',
          electNodeId: 'r1',
          forkIndex: 0,
          status: 'criteria-failed',
          failedAt: 'must include numbers',
          leafOutputs: leaves,
        })
        expect(m2.get('r1')?.forks[0].leafOutputs).toEqual(leaves)
      })

      it('does not attach leafOutputs when event has no leafOutputs field (runtime-failed forks)', () => {
        const m1 = baseMap(1)
        const m2 = applyForkEventToMap(m1, {
          type: 'fork_settled',
          electNodeId: 'r1',
          forkIndex: 0,
          status: 'runtime-failed',
          reason: 'provider error',
        })
        expect(m2.get('r1')?.forks[0]).not.toHaveProperty('leafOutputs')
      })
    })
  })

  describe('elect_complete', () => {
    it('sets winnerForkIndex', () => {
      let m = new Map<string, ForkPreviewState>()
      m = applyForkEventToMap(m, { type: 'fork_started', electNodeId: 'r1', forkIndex: 0, total: 2 })
      m = applyForkEventToMap(m, { type: 'elect_complete', electNodeId: 'r1', winnerForkIndex: 1, total: 2 })
      expect(m.get('r1')?.winnerForkIndex).toBe(1)
    })

    it('allows null winnerForkIndex (all-failed)', () => {
      let m = new Map<string, ForkPreviewState>()
      m = applyForkEventToMap(m, { type: 'fork_started', electNodeId: 'r1', forkIndex: 0, total: 1 })
      m = applyForkEventToMap(m, { type: 'elect_complete', electNodeId: 'r1', winnerForkIndex: null, total: 1 })
      expect(m.get('r1')?.winnerForkIndex).toBeNull()
    })

    it('is a no-op for unknown electNodeId', () => {
      const m = new Map<string, ForkPreviewState>()
      const m2 = applyForkEventToMap(m, { type: 'elect_complete', electNodeId: 'r1', winnerForkIndex: 0, total: 2 })
      expect(m2.has('r1')).toBe(false)
    })

    it('preserves the forks array unchanged', () => {
      let m = new Map<string, ForkPreviewState>()
      m = applyForkEventToMap(m, { type: 'fork_started', electNodeId: 'r1', forkIndex: 0, total: 2 })
      m = applyForkEventToMap(m, { type: 'fork_started', electNodeId: 'r1', forkIndex: 1, total: 2 })
      const m2 = applyForkEventToMap(m, { type: 'elect_complete', electNodeId: 'r1', winnerForkIndex: 0, total: 2 })
      expect(m2.get('r1')?.forks).toHaveLength(2)
      expect(m2.get('r1')?.forks[0].status).toBe('pending')
      expect(m2.get('r1')?.forks[1].status).toBe('pending')
    })

    it('does not mutate the input map', () => {
      let m = new Map<string, ForkPreviewState>()
      m = applyForkEventToMap(m, { type: 'fork_started', electNodeId: 'r1', forkIndex: 0, total: 1 })
      const before = JSON.stringify([...m])
      applyForkEventToMap(m, { type: 'elect_complete', electNodeId: 'r1', winnerForkIndex: 0, total: 1 })
      expect(JSON.stringify([...m])).toBe(before)
    })
  })

  describe('multiple electNodeIds tracked independently', () => {
    it('events for different nodes do not interfere', () => {
      let m = new Map<string, ForkPreviewState>()
      m = applyForkEventToMap(m, { type: 'fork_started', electNodeId: 'r1', forkIndex: 0, total: 2 })
      m = applyForkEventToMap(m, { type: 'fork_started', electNodeId: 'r2', forkIndex: 0, total: 3 })
      m = applyForkEventToMap(m, { type: 'fork_settled', electNodeId: 'r1', forkIndex: 0, status: 'ok' })

      expect(m.get('r1')?.forks[0].status).toBe('ok')
      expect(m.get('r2')?.forks[0].status).toBe('pending')
      expect(m.get('r1')?.total).toBe(2)
      expect(m.get('r2')?.total).toBe(3)
    })

    it('elect_complete for one node does not affect another', () => {
      let m = new Map<string, ForkPreviewState>()
      m = applyForkEventToMap(m, { type: 'fork_started', electNodeId: 'r1', forkIndex: 0, total: 1 })
      m = applyForkEventToMap(m, { type: 'fork_started', electNodeId: 'r2', forkIndex: 0, total: 1 })
      m = applyForkEventToMap(m, { type: 'elect_complete', electNodeId: 'r1', winnerForkIndex: 0, total: 1 })

      expect(m.get('r1')?.winnerForkIndex).toBe(0)
      expect(m.get('r2')?.winnerForkIndex).toBeNull()
    })
  })
})
