import { describe, it, expect, vi, beforeEach } from 'vitest'
import { notifyExecutionStarted, notifyExecutionCompleted } from '../execution-genie-bridge'
import * as genieStateApi from '@shared/lib/genie-state-api'

vi.mock('@shared/lib/genie-state-api', () => ({
  updateGenieState: vi.fn(),
}))

describe('execution-genie-bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('notifyExecutionStarted delegates busy state', () => {
    notifyExecutionStarted('node-1')

    expect(genieStateApi.updateGenieState).toHaveBeenCalledWith('node-1', 'busy')
    expect(genieStateApi.updateGenieState).toHaveBeenCalledTimes(1)
  })

  it('notifyExecutionCompleted maps success to done-success', () => {
    notifyExecutionCompleted('node-1', true)

    expect(genieStateApi.updateGenieState).toHaveBeenCalledWith('node-1', 'done-success')
    expect(genieStateApi.updateGenieState).toHaveBeenCalledTimes(1)
  })

  it('notifyExecutionCompleted maps failure to done-failure', () => {
    notifyExecutionCompleted('node-1', false)

    expect(genieStateApi.updateGenieState).toHaveBeenCalledWith('node-1', 'done-failure')
    expect(genieStateApi.updateGenieState).toHaveBeenCalledTimes(1)
  })
})
