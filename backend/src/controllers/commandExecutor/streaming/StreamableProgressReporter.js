import ProgressReporter from '../ProgressReporter'
import StreamBridge from './StreamBridge'
import {StreamEvent} from './StreamEvent'

class StreamableProgressReporter extends ProgressReporter {
  constructor(options, parent, streamSessionId = null) {
    super(options, parent)
    this.streamSessionId = streamSessionId || parent?.streamSessionId
  }

  add(label) {
    const result = super.add(label)

    if (this.streamSessionId) {
      StreamBridge.emit(this.streamSessionId, StreamEvent.progress(`Started: ${label}`))
    }

    return result
  }

  remove(label) {
    super.remove(label)

    if (this.streamSessionId) {
      StreamBridge.emit(this.streamSessionId, StreamEvent.progress(`Completed: ${label}`))
    }
  }

  emitUpdate(update) {
    if (this.streamSessionId) {
      StreamBridge.emit(this.streamSessionId, StreamEvent.update(update))
    }
  }

  emitError(error) {
    if (this.streamSessionId) {
      StreamBridge.emit(this.streamSessionId, StreamEvent.error(error))
    }
  }
}

export default StreamableProgressReporter
