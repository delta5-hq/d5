export class DynamicTimeoutManager {
  constructor() {
    this.pastDurations = Array(10).fill(600)
  }

  updateDuration(duration) {
    this.pastDurations.shift()
    this.pastDurations.push(duration)
  }

  calculateTimeout(retryCount) {
    const avgDuration = this.pastDurations.reduce((a, b) => a + b) / this.pastDurations.length
    const dynamicTimeout = Math.max(60, Math.min(600, avgDuration * (1 + retryCount / 2)))
    return dynamicTimeout
  }
}
