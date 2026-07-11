import {runCommand} from './runCommand'
import {CriteriaFailedError} from '../../reliability/core/CriteriaFailedError'
import {ValidateCommand} from '../../reliability/core/ValidateCommand'
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

jest.mock('../../reliability/core/resolveRefineCell', () => ({resolveRefineCell: jest.fn()}))
jest.mock('../../reliability/core/RefineTopology', () => jest.fn(() => []))

const buildStore = nodeMap => new Store({userId: 'user1', nodes: nodeMap})

const chatRoot = (children, command = '/chat do task') => ({id: 'root', parent: null, command, children})

const validateNode = (id, command) => ({id, parent: 'root', command, children: []})

const treeWithValidates = (...validateCommands) => {
  const ids = validateCommands.map((_, i) => `v${i}`)
  return buildStore({
    root: chatRoot(ids),
    ...Object.fromEntries(validateCommands.map((cmd, i) => [`v${i}`, validateNode(`v${i}`, cmd)])),
  })
}

const chatSpy = () => jest.spyOn(require('../ChatCommand').ChatCommand.prototype, 'run').mockResolvedValue({})

beforeEach(() => {
  jest.clearAllMocks()
})

describe('runCommand — /validate: CriteriaFailedError propagates when retries exhausted', () => {
  it('throws CriteriaFailedError with correct criterion and attempt count (retry=0 → 1 attempt)', async () => {
    const store = treeWithValidates('/validate must include numbers :retry=0')
    jest.spyOn(ValidateCommand.prototype, 'run').mockResolvedValue({
      passed: false,
      criterion: 'must include numbers',
      reason: 'no numbers found',
    })
    const spy = chatSpy()

    let thrown
    try {
      await runCommand({queryType: 'chat', cell: store.getNode('root'), store})
    } catch (e) {
      thrown = e
    } finally {
      spy.mockRestore()
    }

    expect(thrown).toBeInstanceOf(CriteriaFailedError)
    expect(thrown.criterion).toBe('must include numbers')
    expect(thrown.attempts).toBe(1)
  })

  it('propagates after all retries exhausted (retry=2 → 3 attempts)', async () => {
    const store = treeWithValidates('/validate criterion :retry=2')
    jest.spyOn(ValidateCommand.prototype, 'run').mockResolvedValue({
      passed: false,
      criterion: 'criterion',
      reason: 'fail',
    })
    const spy = chatSpy()

    let thrown
    try {
      await runCommand({queryType: 'chat', cell: store.getNode('root'), store})
    } catch (e) {
      thrown = e
    } finally {
      spy.mockRestore()
    }

    expect(thrown).toBeInstanceOf(CriteriaFailedError)
    expect(thrown.attempts).toBe(3)
  })

  it('batches sibling /validate cells: CriteriaFailedError thrown even when only the first fails', async () => {
    const store = treeWithValidates('/validate criterion-A :retry=0', '/validate criterion-B :retry=0')
    jest.spyOn(ValidateCommand.prototype, 'run').mockResolvedValue({
      passed: false,
      criterion: 'criterion-A',
      reason: 'fail',
    })
    const spy = chatSpy()

    let thrown
    try {
      await runCommand({queryType: 'chat', cell: store.getNode('root'), store})
    } catch (e) {
      thrown = e
    } finally {
      spy.mockRestore()
    }

    expect(thrown).toBeInstanceOf(CriteriaFailedError)
  })
})

describe('runCommand — /validate: [✓] suffix applied to all nodes on first-attempt pass', () => {
  it('appends [✓] suffix to single validate node title on pass', async () => {
    const store = treeWithValidates('/validate criterion :retry=0')
    jest.spyOn(ValidateCommand.prototype, 'run').mockResolvedValue({
      passed: true,
      criterion: 'criterion',
      reason: '',
    })
    const spy = chatSpy()

    await runCommand({queryType: 'chat', cell: store.getNode('root'), store})
    spy.mockRestore()

    expect(store.getNode('v0').title).toMatch(/\[✓\]/)
  })

  it('appends [✓] suffix to ALL sibling validate nodes when batch passes', async () => {
    const store = treeWithValidates('/validate criterion-A :retry=0', '/validate criterion-B :retry=0')
    jest.spyOn(ValidateCommand.prototype, 'run').mockResolvedValue({
      passed: true,
      criterion: 'criterion',
      reason: '',
    })
    const spy = chatSpy()

    await runCommand({queryType: 'chat', cell: store.getNode('root'), store})
    spy.mockRestore()

    expect(store.getNode('v0').title).toMatch(/\[✓\]/)
    expect(store.getNode('v1').title).toMatch(/\[✓\]/)
  })
})

describe('runCommand — /validate: [✓ retry-N] suffix applied on pass after retries', () => {
  it('appends [✓ retry-1] suffix when validate passes on first retry', async () => {
    const store = treeWithValidates('/validate criterion :retry=1')
    let callCount = 0
    jest.spyOn(ValidateCommand.prototype, 'run').mockImplementation(async () => {
      callCount++
      if (callCount === 1) return {passed: false, criterion: 'criterion', reason: 'fail'}
      return {passed: true, criterion: 'criterion', reason: ''}
    })
    const spy = chatSpy()

    await runCommand({queryType: 'chat', cell: store.getNode('root'), store})
    spy.mockRestore()

    expect(store.getNode('v0').title).toMatch(/\[✓ retry-1\]/)
  })

  it('does not append retry suffix when validate passes on first attempt', async () => {
    const store = treeWithValidates('/validate criterion :retry=2')
    jest.spyOn(ValidateCommand.prototype, 'run').mockResolvedValue({
      passed: true,
      criterion: 'criterion',
      reason: '',
    })
    const spy = chatSpy()

    await runCommand({queryType: 'chat', cell: store.getNode('root'), store})
    spy.mockRestore()

    const title = store.getNode('v0').title
    expect(title).toMatch(/\[✓\]/)
    expect(title).not.toMatch(/retry/)
  })
})

describe('runCommand — non-CriteriaFailedError in other post-processors is swallowed', () => {
  it('resolves normally when a non-validate post-processor throws a generic error', async () => {
    const store = buildStore({
      root: chatRoot(['memnode']),
      memnode: {id: 'memnode', parent: 'root', command: '/memorize', children: []},
    })
    const spy = chatSpy()
    const {MemorizeCommand} = require('../MemorizeCommand')
    const memSpy = jest.spyOn(MemorizeCommand.prototype, 'run').mockRejectedValue(new Error('network error'))

    await expect(runCommand({queryType: 'chat', cell: store.getNode('root'), store})).resolves.not.toThrow()

    spy.mockRestore()
    memSpy.mockRestore()
  })
})

describe('runCommand — /validate: [✗ N attempts] suffix written to store on failure', () => {
  it('appends [✗ 1 attempts] to validate node when retry=0 and criteria fails', async () => {
    const store = treeWithValidates('/validate criterion :retry=0')
    jest
      .spyOn(ValidateCommand.prototype, 'run')
      .mockResolvedValue({passed: false, criterion: 'criterion', reason: 'fail'})
    const spy = chatSpy()
    await runCommand({queryType: 'chat', cell: store.getNode('root'), store}).catch(() => {})
    spy.mockRestore()
    expect(store.getNode('v0').title).toMatch(/\[✗ 1 attempts\]/)
  })

  it('appends [✗ 3 attempts] to validate node when retry=2 and all retries fail', async () => {
    const store = treeWithValidates('/validate criterion :retry=2')
    jest
      .spyOn(ValidateCommand.prototype, 'run')
      .mockResolvedValue({passed: false, criterion: 'criterion', reason: 'fail'})
    const spy = chatSpy()
    await runCommand({queryType: 'chat', cell: store.getNode('root'), store}).catch(() => {})
    spy.mockRestore()
    expect(store.getNode('v0').title).toMatch(/\[✗ 3 attempts\]/)
  })

  it('appends [✗ N attempts] to ALL sibling validate nodes when batch fails', async () => {
    const store = treeWithValidates('/validate criterion-A :retry=0', '/validate criterion-B :retry=0')
    jest
      .spyOn(ValidateCommand.prototype, 'run')
      .mockResolvedValue({passed: false, criterion: 'criterion-A', reason: 'fail'})
    const spy = chatSpy()
    await runCommand({queryType: 'chat', cell: store.getNode('root'), store}).catch(() => {})
    spy.mockRestore()
    expect(store.getNode('v0').title).toMatch(/\[✗ 1 attempts\]/)
    expect(store.getNode('v1').title).toMatch(/\[✗ 1 attempts\]/)
  })

  it('failure suffix is present in store at the moment CriteriaFailedError propagates', async () => {
    const store = treeWithValidates('/validate criterion :retry=0')
    jest
      .spyOn(ValidateCommand.prototype, 'run')
      .mockResolvedValue({passed: false, criterion: 'criterion', reason: 'fail'})
    const spy = chatSpy()
    let titleAtThrowTime
    try {
      await runCommand({queryType: 'chat', cell: store.getNode('root'), store})
    } catch {
      titleAtThrowTime = store.getNode('v0').title
    } finally {
      spy.mockRestore()
    }
    expect(titleAtThrowTime).toMatch(/\[✗ 1 attempts\]/)
  })

  it('replaces pre-existing reliability suffix on failure rather than stacking', async () => {
    const store = treeWithValidates('/validate criterion :retry=0')
    store.getNode('v0').title = 'My validate [✓]'
    jest
      .spyOn(ValidateCommand.prototype, 'run')
      .mockResolvedValue({passed: false, criterion: 'criterion', reason: 'fail'})
    const spy = chatSpy()
    await runCommand({queryType: 'chat', cell: store.getNode('root'), store}).catch(() => {})
    spy.mockRestore()
    const title = store.getNode('v0').title
    expect(title).toMatch(/\[✗ 1 attempts\]/)
    expect(title).not.toMatch(/\[✓\]/)
  })
})

describe('runCommand — /validate: [✓] suffix replaces pre-existing suffix on pass', () => {
  it('replaces pre-existing reliability suffix on pass rather than stacking', async () => {
    const store = treeWithValidates('/validate criterion :retry=0')
    store.getNode('v0').title = 'My validate [✗ 2 attempts]'
    jest.spyOn(ValidateCommand.prototype, 'run').mockResolvedValue({passed: true, criterion: 'criterion', reason: ''})
    const spy = chatSpy()
    await runCommand({queryType: 'chat', cell: store.getNode('root'), store})
    spy.mockRestore()
    const title = store.getNode('v0').title
    expect(title).toMatch(/\[✓\]/)
    expect(title).not.toMatch(/\[✗\]/)
  })
})
