export class TimeoutError extends Error {
  constructor(message, timeoutMs) {
    super(message)
    this.name = 'TimeoutError'
    this.timeoutMs = timeoutMs
  }
}

export const withTimeout = (promise, timeoutMs, operation) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new TimeoutError(`${operation} timed out after ${timeoutMs}ms`, timeoutMs)), timeoutMs),
    ),
  ])
