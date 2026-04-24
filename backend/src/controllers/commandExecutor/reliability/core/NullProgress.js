/**
 * Null object pattern for ProgressReporter
 * Used for candidate generation to prevent SSE event leakage
 * Implements ProgressReporter interface without side effects
 */
class NullProgress {
  add() {
    return Promise.resolve('')
  }

  remove() {}

  dispose() {}

  registerChild() {}
}

export default NullProgress
