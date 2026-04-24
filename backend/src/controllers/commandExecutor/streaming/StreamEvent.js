const EVENT_TYPE = {
  PROGRESS: 'progress',
  UPDATE: 'update',
  ERROR: 'error',
  COMPLETE: 'complete',
}

class StreamEvent {
  constructor(type, data) {
    this.type = type
    this.data = data
    this.timestamp = Date.now()
  }

  static progress(message) {
    return new StreamEvent(EVENT_TYPE.PROGRESS, {message})
  }

  static update(update) {
    return new StreamEvent(EVENT_TYPE.UPDATE, update)
  }

  static error(error) {
    return new StreamEvent(EVENT_TYPE.ERROR, {
      message: error.message,
      stack: error.stack,
    })
  }

  static complete(result) {
    return new StreamEvent(EVENT_TYPE.COMPLETE, result)
  }

  toSSE() {
    return `data: ${JSON.stringify({
      type: this.type,
      data: this.data,
      timestamp: this.timestamp,
    })}\n\n`
  }
}

export {StreamEvent, EVENT_TYPE}
