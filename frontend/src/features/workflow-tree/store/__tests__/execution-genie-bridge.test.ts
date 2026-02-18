import { describe, it, expect, vi, beforeEach } from 'vitest'
import { notifyExecutionStarted, notifyExecutionCompleted, notifyExecutionAborted } from '../execution-genie-bridge'
import * as genieStateApi from '@shared/lib/genie-state-api'

vi.mock('@shared/lib/genie-state-api', () => ({
  updateGenieState: vi.fn(),
}))

describe('execution-genie-bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('notifyExecutionStarted', () => {
    it('sets genie to busy', () => {
      notifyExecutionStarted('node-1')

      expect(genieStateApi.updateGenieState).toHaveBeenCalledWith('node-1', 'busy')
      expect(genieStateApi.updateGenieState).toHaveBeenCalledTimes(1)
    })

    it('targets the correct node when multiple nodes exist', () => {
      notifyExecutionStarted('node-42')

      expect(genieStateApi.updateGenieState).toHaveBeenCalledWith('node-42', 'busy')
    })
  })

  describe('notifyExecutionCompleted', () => {
    it('sets genie to done-success on success', () => {
      notifyExecutionCompleted('node-1', true)

      expect(genieStateApi.updateGenieState).toHaveBeenCalledWith('node-1', 'done-success')
      expect(genieStateApi.updateGenieState).toHaveBeenCalledTimes(1)
    })

    it('sets genie to done-failure on failure', () => {
      notifyExecutionCompleted('node-1', false)

      expect(genieStateApi.updateGenieState).toHaveBeenCalledWith('node-1', 'done-failure')
      expect(genieStateApi.updateGenieState).toHaveBeenCalledTimes(1)
    })

    it('targets the correct node when multiple nodes exist', () => {
      notifyExecutionCompleted('node-42', true)

      expect(genieStateApi.updateGenieState).toHaveBeenCalledWith('node-42', 'done-success')
    })
  })

  describe('notifyExecutionAborted', () => {
    it('resets genie to idle', () => {
      notifyExecutionAborted('node-1')

      expect(genieStateApi.updateGenieState).toHaveBeenCalledWith('node-1', 'idle')
      expect(genieStateApi.updateGenieState).toHaveBeenCalledTimes(1)
    })

    it('targets the correct node when multiple nodes exist', () => {
      notifyExecutionAborted('node-42')

      expect(genieStateApi.updateGenieState).toHaveBeenCalledWith('node-42', 'idle')
    })
  })
})
