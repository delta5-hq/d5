/**
 * Top-level inline `/refine :n=N <term>` post-processing seam.
 *
 * These tests pin the routing decisions `resolveRootRefineCell` owns, not the
 * dispatch of any individual post-processor: whether the refine cell's subtree is
 * handed to `postProcessExistingOutput` at all (gated on the refinement outcome)
 * and whether the already-evaluated `/validate` children are excluded from that
 * pass. Per-child-type dispatch and ordering (summarize < memorize < outline,
 * foreach, recursion) are covered by `runCommand.postprocess.test.js` and are not
 * re-asserted here. `/summarize` is used only as a representative subtree child.
 *
 * The generating term is a no-op (CommandFactory mocked) so the assertions turn on
 * routing alone; validation outcome is driven through the validateGroup mock.
 */
import {runCommand} from './runCommand'
import Store from './Store'

jest.mock('debug', () => {
  const fn = jest.fn(() => fn)
  fn.extend = jest.fn(() => fn)
  return fn
})

jest.mock('../../ProgressReporter', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    add: jest.fn(async label => label),
    remove: jest.fn(),
    dispose: jest.fn(),
    registerChild: jest.fn(),
  })),
}))

jest.mock('../../reliability/CommandFactory', () => ({
  __esModule: true,
  default: {createRunner: jest.fn(() => async () => {})},
}))

jest.mock('../../reliability/core/validateGroup', () => ({
  ...jest.requireActual('../../reliability/core/validateGroup'),
  evaluateValidateGroup: jest.fn(),
  firstFailedValidate: jest.fn(),
}))

const validateGroup = require('../../reliability/core/validateGroup')
const passingResult = node => ({node, passed: true, criterion: 'c'})
const failingResult = node => ({node, passed: false, criterion: 'c', reason: 'missing'})

const allValidatesPass = () => {
  validateGroup.evaluateValidateGroup.mockImplementation(async validates => validates.map(passingResult))
  validateGroup.firstFailedValidate.mockReturnValue(undefined)
}
const someValidateFails = () => {
  validateGroup.evaluateValidateGroup.mockImplementation(async validates => validates.map(failingResult))
  validateGroup.firstFailedValidate.mockImplementation(results => results.find(r => !r.passed))
}

const summarizeSpy = () =>
  jest.spyOn(require('../SummarizeCommand').SummarizeCommand.prototype, 'run').mockResolvedValue({})

const buildStore = nodeMap => new Store({userId: 'u1', nodes: nodeMap})

const rootRefine = (children, extraNodes = {}) => ({
  refine: {id: 'refine', parent: null, command: '/refine :n=1 /chatgpt propose directions', children},
  ...extraNodes,
})
const validateNode = id => ({[id]: {id, parent: 'refine', command: '/validate directions listed', children: []}})
const summarizeNode = id => ({[id]: {id, parent: 'refine', command: '/summarize condense', children: []}})

beforeEach(() => {
  jest.clearAllMocks()
  allValidatesPass()
})
afterEach(() => jest.restoreAllMocks())

describe('/refine :n=N /term — top-level inline refine post-processing seam', () => {
  it('hands the resolved subtree to post-processing when every criterion passes', async () => {
    const runSpy = summarizeSpy()
    const store = buildStore(rootRefine(['val', 'sum'], {...validateNode('val'), ...summarizeNode('sum')}))

    await runCommand({queryType: 'refine', cell: store.getNode('refine'), store})

    expect(runSpy).toHaveBeenCalledTimes(1)
  })

  it('skips the subtree when the refinement is INVALID (no /validate child)', async () => {
    const runSpy = summarizeSpy()
    const store = buildStore(rootRefine(['sum'], summarizeNode('sum')))

    await runCommand({queryType: 'refine', cell: store.getNode('refine'), store})

    expect(runSpy).not.toHaveBeenCalled()
  })

  it('skips the subtree and propagates when the best attempt still fails a criterion', async () => {
    someValidateFails()
    const runSpy = summarizeSpy()
    const store = buildStore(rootRefine(['val', 'sum'], {...validateNode('val'), ...summarizeNode('sum')}))

    await expect(runCommand({queryType: 'refine', cell: store.getNode('refine'), store})).rejects.toThrow()
    expect(runSpy).not.toHaveBeenCalled()
  })

  it('does not re-evaluate /validate children during the post-processing pass', async () => {
    summarizeSpy()
    const store = buildStore(rootRefine(['val', 'sum'], {...validateNode('val'), ...summarizeNode('sum')}))

    await runCommand({queryType: 'refine', cell: store.getNode('refine'), store})

    expect(validateGroup.evaluateValidateGroup).toHaveBeenCalledTimes(1)
  })
})
