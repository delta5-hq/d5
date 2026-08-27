import {ValidateCommand} from './ValidateCommand'
import Store from './utils/Store'

jest.mock('debug', () => {
  const fn = jest.fn(() => fn)
  fn.extend = jest.fn(() => fn)
  return fn
})

const mockReliabilityRun = jest.fn()

jest.mock('../reliability/core/ValidateCommand', () => ({
  ValidateCommand: jest.fn().mockImplementation(() => ({run: mockReliabilityRun})),
}))

const VALIDATE_NODE_ID = 'v'
const PARENT_NODE_ID = 'p'

const buildStore = nodes =>
  new Store({
    userId: 'user1',
    workflowId: 'wf1',
    nodes,
  })

const buildValidatableStore = () =>
  buildStore({
    [PARENT_NODE_ID]: {id: PARENT_NODE_ID, title: 'parent content', children: [VALIDATE_NODE_ID]},
    [VALIDATE_NODE_ID]: {
      id: VALIDATE_NODE_ID,
      parent: PARENT_NODE_ID,
      command: '/validate contains numbers',
    },
  })

const runValidate = async (store, result) => {
  if (result instanceof Error) {
    mockReliabilityRun.mockRejectedValue(result)
  } else {
    mockReliabilityRun.mockResolvedValue(result)
  }

  const createNodesSpy = jest.spyOn(store.importer, 'createNodes')
  const createErrorNodeSpy = jest.spyOn(store.importer, 'createErrorNode').mockImplementation(() => {})
  const command = new ValidateCommand('user1', 'wf1', store)

  await command.run(store.getNode(VALIDATE_NODE_ID))

  return {createNodesSpy, createErrorNodeSpy}
}

describe('ValidateCommand', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it.each([
    [{passed: true, criterion: 'contains numbers', reason: ''}, 'Validation passed — contains numbers'],
    [
      {passed: false, criterion: 'contains numbers', reason: 'no numbers found'},
      'Validation failed — contains numbers: no numbers found',
    ],
    [{passed: false, criterion: '', reason: ''}, 'Validation failed'],
    [{passed: true, criterion: '', reason: ''}, 'Validation passed'],
  ])('creates one visible result node for verdict %#', async (result, expectedTitle) => {
    const {createNodesSpy} = await runValidate(buildValidatableStore(), result)

    expect(createNodesSpy).toHaveBeenCalledWith(expectedTitle, VALIDATE_NODE_ID)
    expect(createNodesSpy).toHaveBeenCalledTimes(1)
  })

  it.each([
    [
      'missing parent',
      {[VALIDATE_NODE_ID]: {id: VALIDATE_NODE_ID, command: '/validate contains numbers'}},
      'Error: /validate requires a parent node with content to validate',
    ],
    [
      'missing parent node record',
      {[VALIDATE_NODE_ID]: {id: VALIDATE_NODE_ID, parent: PARENT_NODE_ID, command: '/validate contains numbers'}},
      'Error: /validate requires a parent node with content to validate',
    ],
    [
      'empty parent title',
      {
        [PARENT_NODE_ID]: {id: PARENT_NODE_ID, children: [VALIDATE_NODE_ID]},
        [VALIDATE_NODE_ID]: {id: VALIDATE_NODE_ID, parent: PARENT_NODE_ID, command: '/validate contains numbers'},
      },
      'Error: /validate requires non-empty parent content to validate',
    ],
    [
      'command-only parent content',
      {
        [PARENT_NODE_ID]: {id: PARENT_NODE_ID, title: '/chat ignored command content', children: [VALIDATE_NODE_ID]},
        [VALIDATE_NODE_ID]: {id: VALIDATE_NODE_ID, parent: PARENT_NODE_ID, command: '/validate contains numbers'},
      },
      'Error: /validate requires non-empty parent content to validate',
    ],
  ])('creates one error node and skips validation for %s', async (_name, nodes, expectedTitle) => {
    const {createErrorNodeSpy} = await runValidate(buildStore(nodes), {
      passed: true,
      criterion: 'contains numbers',
      reason: '',
    })

    expect(mockReliabilityRun).not.toHaveBeenCalled()
    expect(createErrorNodeSpy).toHaveBeenCalledWith(expectedTitle, VALIDATE_NODE_ID)
    expect(createErrorNodeSpy).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['standard error', new Error('validator unavailable')],
    ['typed error', new TypeError('invalid validator response')],
  ])('creates one error node when validation throws a %s', async (_label, error) => {
    const {createErrorNodeSpy} = await runValidate(buildValidatableStore(), error)

    expect(createErrorNodeSpy).toHaveBeenCalledWith(`Error: ${error.message}`, VALIDATE_NODE_ID)
    expect(createErrorNodeSpy).toHaveBeenCalledTimes(1)
  })
})
