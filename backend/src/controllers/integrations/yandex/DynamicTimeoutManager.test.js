import {DynamicTimeoutManager} from './DynamicTimeoutManager'

describe('DynamicTimeoutManager', () => {
  const manager = new DynamicTimeoutManager()

  beforeEach(() => {
    manager.pastDurations = Array(10).fill(600)
  })

  it('should update pastDurations correctly', () => {
    manager.updateDuration(300)
    expect(manager.pastDurations[manager.pastDurations.length - 1]).toBe(300)
  })

  it('should return the maximum timeout of 600 with initial durations and no retry', () => {
    const timeout = manager.calculateTimeout(0)
    expect(timeout).toBe(600)
  })

  it('should calculate average of pastDurations correctly', () => {
    manager.updateDuration(300)
    manager.updateDuration(300)
    const avgDuration = manager.pastDurations.reduce((a, b) => a + b) / manager.pastDurations.length
    const expectedTimeout = Math.max(60, Math.min(600, avgDuration * (1 + 1 / 2)))
    expect(manager.calculateTimeout(1)).toBe(expectedTimeout)
  })

  it('should use pastDurations with recent updates', () => {
    for (let i = 0; i < 10; i++) {
      manager.updateDuration(300)
    }
    const timeout = manager.calculateTimeout(1)
    const expectedTimeout = Math.max(60, Math.min(600, 300 * (1 + 1 / 2)))
    expect(timeout).toBe(expectedTimeout)
  })

  it('should handle very small durations', () => {
    for (let i = 0; i < 10; i++) {
      manager.updateDuration(1)
    }
    const timeout = manager.calculateTimeout(1)
    const avgDuration = manager.pastDurations.reduce((a, b) => a + b) / manager.pastDurations.length
    const expectedTimeout = Math.max(60, Math.min(600, avgDuration * (1 + 1 / 2)))
    expect(timeout).toBe(expectedTimeout)
  })

  it('should not go below minimum timeout of 60', () => {
    manager.pastDurations = Array(10).fill(10)
    const timeout = manager.calculateTimeout(1)
    expect(timeout).toBe(60)
  })

  it('should not exceed the maximum timeout of 600', () => {
    manager.pastDurations = Array(10).fill(1200)
    const timeout = manager.calculateTimeout(2)
    expect(timeout).toBe(600)
  })
})
