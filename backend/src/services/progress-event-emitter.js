import EventEmitter from 'events'

class ProgressEventEmitter extends EventEmitter {
  emitProgress(nodeId, state, metadata = {}) {
    this.emit('progress', {nodeId, state, timestamp: Date.now(), ...metadata})
  }

  emitStart(nodeId, metadata = {}) {
    this.emitProgress(nodeId, 'preparing', metadata)
  }

  emitRunning(nodeId, metadata = {}) {
    this.emitProgress(nodeId, 'running', metadata)
  }

  emitComplete(nodeId, metadata = {}) {
    this.emitProgress(nodeId, 'idle', metadata)
  }

  emitError(nodeId, error, metadata = {}) {
    this.emitProgress(nodeId, 'idle', {error: error.message, ...metadata})
  }
}

export const progressEventEmitter = new ProgressEventEmitter()
export default ProgressEventEmitter
