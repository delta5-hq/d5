export class AbortSignalHandler {
  constructor(signal, connection) {
    this.signal = signal
    this.connection = connection
    this.abortListener = null
  }

  register() {
    if (!this.signal || !this.connection) {
      return
    }

    this.abortListener = async () => {
      try {
        await this.connection.cancel()
      } catch (error) {
        // Cancellation may fail if session ended - continue to close
      }
      await this.connection.close()
    }

    this.signal.addEventListener('abort', this.abortListener)
  }

  unregister() {
    if (this.signal && this.abortListener) {
      this.signal.removeEventListener('abort', this.abortListener)
      this.abortListener = null
    }
  }

  createAbortRace(promise) {
    if (!this.signal) {
      return promise
    }

    let abortListener = null

    const abortPromise = new Promise((resolve, reject) => {
      if (this.signal.aborted) {
        reject(new Error('Operation aborted'))
        return
      }

      abortListener = () => reject(new Error('Operation aborted'))
      this.signal.addEventListener('abort', abortListener)
    })

    const cleanup = () => {
      if (abortListener) {
        this.signal.removeEventListener('abort', abortListener)
      }
    }

    return Promise.race([promise, abortPromise]).finally(cleanup)
  }
}
