import { describe, it, expect, vi, afterEach } from 'vitest'
import { holdMinDuration } from '../hold-min-duration'

describe('holdMinDuration', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  describe('resolves immediately when the window is already exhausted', () => {
    it('returns without scheduling a timer when minMs is zero', async () => {
      vi.useFakeTimers()
      let settled = false
      holdMinDuration(Date.now(), 0).then(() => {
        settled = true
      })

      await Promise.resolve()

      expect(settled).toBe(true)
    })

    it('returns without scheduling a timer when both startMs and minMs are zero', async () => {
      vi.useFakeTimers()
      let settled = false
      holdMinDuration(0, 0).then(() => {
        settled = true
      })

      await Promise.resolve()

      expect(settled).toBe(true)
    })

    it('returns without scheduling a timer when elapsed time equals the window', async () => {
      vi.useFakeTimers()
      const startMs = Date.now()
      await vi.advanceTimersByTimeAsync(300)

      let settled = false
      holdMinDuration(startMs, 300).then(() => {
        settled = true
      })

      await Promise.resolve()

      expect(settled).toBe(true)
    })

    it('returns without scheduling a timer when elapsed time exceeds the window', async () => {
      vi.useFakeTimers()
      const startMs = Date.now()
      await vi.advanceTimersByTimeAsync(500)

      let settled = false
      holdMinDuration(startMs, 300).then(() => {
        settled = true
      })

      await Promise.resolve()

      expect(settled).toBe(true)
    })
  })

  describe('waits for the remaining duration when the window is still open', () => {
    it('waits for the full minMs when no time has elapsed since start', async () => {
      vi.useFakeTimers()
      let settled = false
      holdMinDuration(Date.now(), 300).then(() => {
        settled = true
      })

      await vi.advanceTimersByTimeAsync(150)
      expect(settled).toBe(false)

      await vi.advanceTimersByTimeAsync(200)
      expect(settled).toBe(true)
    })

    it('waits for only the remaining portion when partial time has already elapsed since start', async () => {
      vi.useFakeTimers()
      const startMs = Date.now()
      await vi.advanceTimersByTimeAsync(150)

      let settled = false
      holdMinDuration(startMs, 300).then(() => {
        settled = true
      })

      await vi.advanceTimersByTimeAsync(100)
      expect(settled).toBe(false)

      await vi.advanceTimersByTimeAsync(100)
      expect(settled).toBe(true)
    })
  })

  describe('multiple concurrent calls', () => {
    it('each call independently tracks its own start and duration', async () => {
      vi.useFakeTimers()
      const t0 = Date.now()
      await vi.advanceTimersByTimeAsync(100)
      const t100 = Date.now()

      let firstSettled = false
      let secondSettled = false
      holdMinDuration(t0, 300).then(() => {
        firstSettled = true
      })
      holdMinDuration(t100, 300).then(() => {
        secondSettled = true
      })

      await vi.advanceTimersByTimeAsync(150)
      expect(firstSettled).toBe(false)
      expect(secondSettled).toBe(false)

      await vi.advanceTimersByTimeAsync(100)
      expect(firstSettled).toBe(true)
      expect(secondSettled).toBe(false)

      await vi.advanceTimersByTimeAsync(100)
      expect(firstSettled).toBe(true)
      expect(secondSettled).toBe(true)
    })
  })
})
