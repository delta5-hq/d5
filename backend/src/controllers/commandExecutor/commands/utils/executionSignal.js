export const createAbortError = () => {
  const error = new Error('Operation cancelled')
  error.name = 'AbortError'
  return error
}

export const isAbortError = error => error?.name === 'AbortError'

export const throwIfAbortError = error => {
  if (isAbortError(error)) {
    throw error
  }
}

export const throwIfAborted = signal => {
  if (signal?.aborted) {
    throw createAbortError()
  }
}

export const signalOptions = signal => (signal ? {signal} : undefined)
