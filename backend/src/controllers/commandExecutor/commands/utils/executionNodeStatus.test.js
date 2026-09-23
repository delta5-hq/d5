import {EXECUTION_NODE_STATUS, isExecutionErrorNode, withExecutionErrorStatus} from './executionNodeStatus'

describe('executionNodeStatus', () => {
  it('marks nodes with a source-level execution error status without changing content fields', () => {
    const node = {id: 'n1', parent: 'parent', title: 'Provider refused credentials'}

    expect(withExecutionErrorStatus(node)).toEqual({
      ...node,
      executionStatus: EXECUTION_NODE_STATUS.ERROR,
    })
  })

  it('classifies errors by executionStatus, not by user-visible title text', () => {
    expect(isExecutionErrorNode({title: 'Error: legitimate generated text'})).toBe(false)
    expect(isExecutionErrorNode({title: 'Provider refused credentials', executionStatus: 'error'})).toBe(true)
  })

  it('treats absent, null, and non-error status values as non-error output', () => {
    expect(isExecutionErrorNode(null)).toBe(false)
    expect(isExecutionErrorNode(undefined)).toBe(false)
    expect(isExecutionErrorNode({executionStatus: 'ok'})).toBe(false)
  })
})
