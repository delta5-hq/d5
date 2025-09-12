export function abortSignalTimeout(timeout) {
  const abortController = new AbortController()
  setTimeout(() => abortController.abort(), timeout)
  return abortController.signal
}

export function abortSignalAny(signals) {
  // Handle empty signals array
  if (signals.length === 0) {
    const controller = new AbortController()
    return controller.signal
  }

  // Fast path for single signal
  if (signals.length === 1) return signals[0]

  // Check if any signal is already aborted
  for (const signal of signals) {
    if (signal.aborted) return signal
  }

  // Create a new controller for the combined signal
  const controller = new AbortController()
  const unlisteners = Array(signals.length)

  // Function to clean up all event listeners
  const cleanup = () => {
    for (const unsubscribe of unlisteners) {
      unsubscribe()
    }
  }

  // Add event listeners to each signal
  signals.forEach((signal, index) => {
    const handler = () => {
      controller.abort(signal.reason)
      cleanup()
    }

    signal.addEventListener('abort', handler)
    unlisteners[index] = () => signal.removeEventListener('abort', handler)
  })

  return controller.signal
}
