import {RefineCommand} from './RefineCommand'
import Store from './utils/Store'

jest.mock('debug', () => {
  const fn = jest.fn(() => fn)
  fn.extend = jest.fn(() => fn)
  return fn
})

jest.mock('../reliability/core/resolveRefineCell', () => ({
  resolveRefineCell: jest.fn(),
}))

import {resolveRefineCell} from '../reliability/core/resolveRefineCell'

const buildStore = () => new Store({userId: 'user1', workflowId: 'wf1', nodes: {r: {id: 'r', command: '/refine :n=2'}}})

const runRefine = async (options = {}) => {
  const store = buildStore()
  const createNodesSpy = jest.spyOn(store.importer, 'createNodes')
  const command = new RefineCommand('user1', 'wf1', store)
  await command.run(store.getNode('r'), options)
  return {store, createNodesSpy}
}

describe('RefineCommand', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('routes direct execution to the reliability refine resolver with an isolated memo map by default', async () => {
    const {store, createNodesSpy} = await runRefine()

    expect(resolveRefineCell).toHaveBeenCalledWith(store.getNode('r'), store, expect.any(Map), null)
    expect(createNodesSpy).not.toHaveBeenCalled()
  })

  it('passes caller-provided memoMap and abort signal to the reliability refine resolver', async () => {
    const memoMap = new Map()
    const signal = new AbortController().signal
    const {store} = await runRefine({memoMap, signal})

    expect(resolveRefineCell).toHaveBeenCalledWith(store.getNode('r'), store, memoMap, signal)
  })

  it.each([
    ['standard error', new Error('refine failed')],
    ['typed error', new TypeError('invalid refine state')],
  ])('creates one error node when the refine resolver throws a %s', async (_label, error) => {
    resolveRefineCell.mockRejectedValueOnce(error)

    const {createNodesSpy} = await runRefine()

    expect(createNodesSpy).toHaveBeenCalledWith(`Error: ${error.message}`, 'r')
    expect(createNodesSpy).toHaveBeenCalledTimes(1)
  })
})
