import {ElectCommand} from './ElectCommand'
import Store from './utils/Store'

jest.mock('debug', () => {
  const fn = jest.fn(() => fn)
  fn.extend = jest.fn(() => fn)
  return fn
})

jest.mock('../reliability/core/resolveElectCell', () => ({
  resolveElectCell: jest.fn(),
}))

import {resolveElectCell} from '../reliability/core/resolveElectCell'

const buildStore = () => new Store({userId: 'user1', workflowId: 'wf1', nodes: {r: {id: 'r', command: '/elect :n=2'}}})

const runElect = async (options = {}) => {
  const store = buildStore()
  const createNodesSpy = jest.spyOn(store.importer, 'createNodes')
  const createErrorNodeSpy = jest.spyOn(store.importer, 'createErrorNode').mockImplementation(() => {})
  const command = new ElectCommand('user1', 'wf1', store)
  await command.run(store.getNode('r'), options)
  return {store, createNodesSpy, createErrorNodeSpy}
}

describe('ElectCommand', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('routes direct execution to the reliability elect resolver with an isolated memo map by default', async () => {
    const {store, createNodesSpy} = await runElect()

    expect(resolveElectCell).toHaveBeenCalledWith(store.getNode('r'), store, expect.any(Map), null)
    expect(createNodesSpy).not.toHaveBeenCalled()
  })

  it('passes caller-provided memoMap and abort signal to the reliability elect resolver', async () => {
    const memoMap = new Map()
    const signal = new AbortController().signal
    const {store} = await runElect({memoMap, signal})

    expect(resolveElectCell).toHaveBeenCalledWith(store.getNode('r'), store, memoMap, signal)
  })

  it.each([
    ['standard error', new Error('elect failed')],
    ['typed error', new TypeError('invalid elect state')],
  ])('creates one error node when the elect resolver throws a %s', async (_label, error) => {
    resolveElectCell.mockRejectedValueOnce(error)

    const {createErrorNodeSpy} = await runElect()

    expect(createErrorNodeSpy).toHaveBeenCalledWith(`Error: ${error.message}`, 'r')
    expect(createErrorNodeSpy).toHaveBeenCalledTimes(1)
  })
})
