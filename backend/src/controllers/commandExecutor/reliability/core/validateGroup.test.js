import {applyValidateResults} from './validateGroup'
import {FAILURE_CAUSE} from './failureSemantics'

// applyValidateResults is the seam that carries a validate aggregate's outcome onto the node's
// persisted reliability metadata. Its load-bearing decision is that the aggregate's OWN failure
// cause survives to the metadata rather than being flattened to a single constant — otherwise the
// UI can never distinguish a genuine criteria failure from a juror crash or an unparsed verdict.
// These tests assert that forwarding as a general property across every cause, not one bug case.

const makeStore = nodes => ({
  _nodes: nodes,
  getNode: id => nodes[id],
  saveNodeToOutput: jest.fn(),
})

const runOne = (result, {nodeId = 'v'} = {}) => {
  const nodes = {[nodeId]: {id: nodeId, title: '/validate criterion'}}
  const store = makeStore(nodes)
  applyValidateResults([{id: nodeId}], [result], store)
  return {node: nodes[nodeId], store}
}

describe('applyValidateResults — the aggregate cause reaches the persisted metadata', () => {
  it.each([FAILURE_CAUSE.NO_JUDGE_SIGNAL, FAILURE_CAUSE.VERDICT_UNPARSED, FAILURE_CAUSE.CRITERIA_FAILED])(
    'forwards a failing aggregate cause %s verbatim, never a hardcoded constant',
    failureCause => {
      const {node} = runOne({passed: false, criterion: 'c', reason: 'r', failureCause})
      expect(node.reliabilityMetadata.failureCause).toBe(failureCause)
    },
  )

  it('defaults a failing result with no explicit cause to criteria-failed', () => {
    const {node} = runOne({passed: false, criterion: 'c', reason: 'r'})
    expect(node.reliabilityMetadata.failureCause).toBe(FAILURE_CAUSE.CRITERIA_FAILED)
  })

  it('writes no failure cause and a passing verdict when the result passed', () => {
    const {node} = runOne({passed: true, criterion: 'c'})
    expect(node.reliabilityMetadata).not.toHaveProperty('failureCause')
    expect(node.reliabilityMetadata.eligible).toBe(1)
  })

  it('carries the juror reason into the single discarded-fork entry on failure', () => {
    const {node} = runOne({passed: false, criterion: 'the reply is non-empty', reason: 'the content is empty'})
    expect(node.reliabilityMetadata.discardedForks).toEqual([
      {forkIndex: 0, status: 'criteria-failed', failedAt: 'the reply is non-empty', reason: 'the content is empty'},
    ])
  })

  it('treats a missing result as a failure and persists to the node output', () => {
    const {node, store} = runOne(undefined)
    expect(node.reliabilityMetadata.eligible).toBe(0)
    expect(store.saveNodeToOutput).toHaveBeenCalledWith('v')
  })

  it('applies each result to its own node positionally', () => {
    const nodes = {a: {id: 'a', title: '/validate a'}, b: {id: 'b', title: '/validate b'}}
    const store = makeStore(nodes)
    applyValidateResults(
      [{id: 'a'}, {id: 'b'}],
      [
        {passed: false, criterion: 'a', failureCause: FAILURE_CAUSE.NO_JUDGE_SIGNAL},
        {passed: true, criterion: 'b'},
      ],
      store,
    )
    expect(nodes.a.reliabilityMetadata.failureCause).toBe(FAILURE_CAUSE.NO_JUDGE_SIGNAL)
    expect(nodes.b.reliabilityMetadata).not.toHaveProperty('failureCause')
  })
})
