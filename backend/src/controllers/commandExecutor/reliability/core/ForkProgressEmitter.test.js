import {NullForkProgressEmitter, createForkProgressEmitter} from './ForkProgressEmitter'
import {FORK_EVENT} from './ForkStreamEvent'

describe('NullForkProgressEmitter', () => {
  it('accepts all calls without throwing', () => {
    const emitter = new NullForkProgressEmitter()
    expect(() => emitter.forksStarted('node1', 3)).not.toThrow()
    expect(() => emitter.forkSettled('node1', {forkIndex: 0, status: 'ok'})).not.toThrow()
    expect(() => emitter.refineComplete('node1', 0, 3)).not.toThrow()
  })

  it('all methods return undefined — no accumulated state or side-effects', () => {
    const emitter = new NullForkProgressEmitter()
    expect(emitter.forksStarted('node1', 3)).toBeUndefined()
    expect(emitter.forkSettled('node1', {forkIndex: 0, status: 'ok'})).toBeUndefined()
    expect(emitter.refineComplete('node1', 0, 3)).toBeUndefined()
  })

  it('can be called multiple times without throwing or accumulating state', () => {
    const emitter = new NullForkProgressEmitter()
    for (let i = 0; i < 5; i++) {
      expect(() => {
        emitter.forksStarted('node1', 3)
        emitter.forkSettled('node1', {forkIndex: i, status: 'ok'})
        emitter.refineComplete('node1', i, 3)
      }).not.toThrow()
    }
  })
})

describe('createForkProgressEmitter', () => {
  it('returns NullForkProgressEmitter when progress lacks emitUpdate', () => {
    expect(createForkProgressEmitter(null)).toBeInstanceOf(NullForkProgressEmitter)
    expect(createForkProgressEmitter(undefined)).toBeInstanceOf(NullForkProgressEmitter)
    expect(createForkProgressEmitter({})).toBeInstanceOf(NullForkProgressEmitter)
  })

  it('returns SSE emitter when progress has emitUpdate', () => {
    const emitter = createForkProgressEmitter({emitUpdate: jest.fn()})
    expect(emitter).not.toBeInstanceOf(NullForkProgressEmitter)
  })

  it('returns NullForkProgressEmitter when emitUpdate is present but not a function', () => {
    expect(createForkProgressEmitter({emitUpdate: 42})).toBeInstanceOf(NullForkProgressEmitter)
    expect(createForkProgressEmitter({emitUpdate: null})).toBeInstanceOf(NullForkProgressEmitter)
    expect(createForkProgressEmitter({emitUpdate: 'fn'})).toBeInstanceOf(NullForkProgressEmitter)
  })
})

describe('SSEForkProgressEmitter', () => {
  let emitUpdate
  let emitter

  beforeEach(() => {
    emitUpdate = jest.fn()
    emitter = createForkProgressEmitter({emitUpdate})
  })

  describe('forksStarted', () => {
    it('emits one FORK_STARTED event per fork', () => {
      emitter.forksStarted('refine1', 3)
      expect(emitUpdate).toHaveBeenCalledTimes(3)
    })

    it('emits events with correct forkIndex and total', () => {
      emitter.forksStarted('refine1', 2)
      expect(emitUpdate).toHaveBeenNthCalledWith(1, {
        type: FORK_EVENT.FORK_STARTED,
        refineNodeId: 'refine1',
        forkIndex: 0,
        total: 2,
      })
      expect(emitUpdate).toHaveBeenNthCalledWith(2, {
        type: FORK_EVENT.FORK_STARTED,
        refineNodeId: 'refine1',
        forkIndex: 1,
        total: 2,
      })
    })

    it('emits no events when n=0', () => {
      emitter.forksStarted('refine1', 0)
      expect(emitUpdate).not.toHaveBeenCalled()
    })

    it('emits exactly one event at forkIndex=0 when n=1', () => {
      emitter.forksStarted('refine1', 1)
      expect(emitUpdate).toHaveBeenCalledTimes(1)
      expect(emitUpdate).toHaveBeenCalledWith({
        type: FORK_EVENT.FORK_STARTED,
        refineNodeId: 'refine1',
        forkIndex: 0,
        total: 1,
      })
    })
  })

  describe('forkSettled', () => {
    it('emits FORK_SETTLED for ok status', () => {
      emitter.forkSettled('refine1', {forkIndex: 0, status: 'ok'})
      expect(emitUpdate).toHaveBeenCalledWith({
        type: FORK_EVENT.FORK_SETTLED,
        refineNodeId: 'refine1',
        forkIndex: 0,
        status: 'ok',
      })
    })

    it('carries the correct forkIndex for non-zero forks', () => {
      emitter.forkSettled('refine1', {forkIndex: 4, status: 'ok'})
      const call = emitUpdate.mock.calls[0][0]
      expect(call.forkIndex).toBe(4)
    })

    it('includes failedAt when present', () => {
      emitter.forkSettled('refine1', {
        forkIndex: 1,
        status: 'criteria-failed',
        failedAt: 'criterion text',
      })
      expect(emitUpdate).toHaveBeenCalledWith(expect.objectContaining({failedAt: 'criterion text'}))
    })

    it('includes reason for runtime-failed', () => {
      emitter.forkSettled('refine1', {
        forkIndex: 2,
        status: 'runtime-failed',
        reason: 'network error',
      })
      expect(emitUpdate).toHaveBeenCalledWith(expect.objectContaining({reason: 'network error'}))
    })

    it('omits failedAt and reason when absent', () => {
      emitter.forkSettled('refine1', {forkIndex: 0, status: 'ok'})
      const call = emitUpdate.mock.calls[0][0]
      expect(call).not.toHaveProperty('failedAt')
      expect(call).not.toHaveProperty('reason')
    })

    it('criteria-failed payload does not include reason', () => {
      emitter.forkSettled('refine1', {
        forkIndex: 0,
        status: 'criteria-failed',
        failedAt: 'must include numbers',
      })
      const call = emitUpdate.mock.calls[0][0]
      expect(call).not.toHaveProperty('reason')
    })

    it('runtime-failed payload does not include failedAt', () => {
      emitter.forkSettled('refine1', {
        forkIndex: 0,
        status: 'runtime-failed',
        reason: 'timeout',
      })
      const call = emitUpdate.mock.calls[0][0]
      expect(call).not.toHaveProperty('failedAt')
    })

    describe('leafOutputs field', () => {
      it('includes leafOutputs when present and non-empty', () => {
        const leaves = [{nodeId: 'n1', content: 'response text'}]
        emitter.forkSettled('refine1', {
          forkIndex: 0,
          status: 'ok',
          leafOutputs: leaves,
        })
        expect(emitUpdate).toHaveBeenCalledWith(expect.objectContaining({leafOutputs: leaves}))
      })

      it('omits leafOutputs when array is empty', () => {
        emitter.forkSettled('refine1', {
          forkIndex: 0,
          status: 'ok',
          leafOutputs: [],
        })
        const call = emitUpdate.mock.calls[0][0]
        expect(call).not.toHaveProperty('leafOutputs')
      })

      it('omits leafOutputs when absent from result', () => {
        emitter.forkSettled('refine1', {forkIndex: 0, status: 'ok'})
        const call = emitUpdate.mock.calls[0][0]
        expect(call).not.toHaveProperty('leafOutputs')
      })

      it('carries all leaf entries when multiple outputs are present', () => {
        const leaves = [
          {nodeId: 'n1', content: 'first response'},
          {nodeId: 'n2', content: 'second response'},
        ]
        emitter.forkSettled('refine1', {
          forkIndex: 1,
          status: 'criteria-failed',
          failedAt: 'must include numbers',
          leafOutputs: leaves,
        })
        const call = emitUpdate.mock.calls[0][0]
        expect(call.leafOutputs).toEqual(leaves)
      })

      it('leafOutputs coexists with failedAt in criteria-failed payload', () => {
        const leaves = [{nodeId: 'n1', content: 'partial output'}]
        emitter.forkSettled('refine1', {
          forkIndex: 0,
          status: 'criteria-failed',
          failedAt: 'criterion',
          leafOutputs: leaves,
        })
        const call = emitUpdate.mock.calls[0][0]
        expect(call).toHaveProperty('failedAt', 'criterion')
        expect(call.leafOutputs).toEqual(leaves)
      })
    })
  })

  describe('refineComplete', () => {
    it('emits REFINE_COMPLETE with winner and total', () => {
      emitter.refineComplete('refine1', 2, 3)
      expect(emitUpdate).toHaveBeenCalledWith({
        type: FORK_EVENT.REFINE_COMPLETE,
        refineNodeId: 'refine1',
        winnerForkIndex: 2,
        total: 3,
      })
    })

    it('allows null winnerForkIndex (all-failed case)', () => {
      emitter.refineComplete('refine1', null, 3)
      expect(emitUpdate).toHaveBeenCalledWith(expect.objectContaining({winnerForkIndex: null}))
    })

    it('emits refineComplete for total=1 (single-fork boundary)', () => {
      emitter.refineComplete('refine1', 0, 1)
      expect(emitUpdate).toHaveBeenCalledWith({
        type: FORK_EVENT.REFINE_COMPLETE,
        refineNodeId: 'refine1',
        winnerForkIndex: 0,
        total: 1,
      })
    })

    it('includes fallbackUsed in payload when telemetry.fallbackUsed is true', () => {
      emitter.refineComplete('refine1', 1, 3, {fallbackUsed: true})
      expect(emitUpdate).toHaveBeenCalledWith(expect.objectContaining({fallbackUsed: true}))
    })

    it('includes generatorOnlyJudge in payload when telemetry.generatorOnlyJudge is true', () => {
      emitter.refineComplete('refine1', 1, 3, {generatorOnlyJudge: true})
      expect(emitUpdate).toHaveBeenCalledWith(expect.objectContaining({generatorOnlyJudge: true}))
    })

    it('includes judgeReasoningRequested in payload when telemetry.judgeReasoningRequested is true', () => {
      emitter.refineComplete('refine1', 1, 3, {judgeReasoningRequested: true})
      expect(emitUpdate).toHaveBeenCalledWith(expect.objectContaining({judgeReasoningRequested: true}))
    })

    it('includes all three telemetry fields when all are set simultaneously', () => {
      emitter.refineComplete('refine1', 1, 3, {
        fallbackUsed: true,
        generatorOnlyJudge: true,
        judgeReasoningRequested: true,
      })
      expect(emitUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          fallbackUsed: true,
          generatorOnlyJudge: true,
          judgeReasoningRequested: true,
        }),
      )
    })

    it('preserves base payload fields when telemetry is provided', () => {
      emitter.refineComplete('refine1', 2, 4, {fallbackUsed: true})
      expect(emitUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          type: FORK_EVENT.REFINE_COMPLETE,
          refineNodeId: 'refine1',
          winnerForkIndex: 2,
          total: 4,
        }),
      )
    })

    it.each([
      [{fallbackUsed: false, generatorOnlyJudge: false, judgeReasoningRequested: false}, 'all false'],
      [{}, 'empty object'],
      [undefined, 'no telemetry arg'],
    ])('omits telemetry fields when not truthy (%s)', telemetry => {
      emitter.refineComplete('refine1', 1, 3, telemetry)
      const call = emitUpdate.mock.calls[0][0]
      expect(call).not.toHaveProperty('fallbackUsed')
      expect(call).not.toHaveProperty('generatorOnlyJudge')
      expect(call).not.toHaveProperty('judgeReasoningRequested')
    })
  })
})
