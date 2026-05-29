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

const alwaysFail = (criterion = 'criterion') =>
  jest.spyOn(ValidateCommand.prototype, 'run').mockResolvedValue({passed: false, criterion, reason: 'fail'})

const alwaysPass = (criterion = 'criterion') =>
  jest.spyOn(ValidateCommand.prototype, 'run').mockResolvedValue({passed: true, criterion, reason: ''})

beforeEach(() => {
  jest.clearAllMocks()
})

describe('runCommand \u2014 /validate: CriteriaFailedError propagates when retries exhausted', () => {
  it('throws CriteriaFailedError with correct criterion and attempt count (retry=0 \u2192 1 attempt)', async () => {
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

  it('propagates after all retries exhausted (retry=2 \u2192 3 attempts)', async () => {
    const store = treeWithValidates('/validate criterion :retry=2')
    const validateSpy = alwaysFail()
    const spy = chatSpy()

    let thrown
    try {
      await runCommand({queryType: 'chat', cell: store.getNode('root'), store})
    } catch (e) {
      thrown = e
    } finally {
      spy.mockRestore()
      validateSpy.mockRestore()
    }

    expect(thrown).toBeInstanceOf(CriteriaFailedError)
    expect(thrown.attempts).toBe(3)
  })

  it('batches sibling /validate cells: CriteriaFailedError thrown even when only one sibling fails', async () => {
    const store = treeWithValidates('/validate criterion-A :retry=0', '/validate criterion-B :retry=0')
    const validateSpy = alwaysFail('criterion-A')
    const spy = chatSpy()

    let thrown
    try {
      await runCommand({queryType: 'chat', cell: store.getNode('root'), store})
    } catch (e) {
      thrown = e
    } finally {
      spy.mockRestore()
      validateSpy.mockRestore()
    }

    expect(thrown).toBeInstanceOf(CriteriaFailedError)
  })
})

describe('runCommand \u2014 /validate: [\u2713] suffix on successful validation', () => {
  it('single validate node receives [\u2713] on first-attempt pass', async () => {
    const store = treeWithValidates('/validate criterion :retry=0')
    const validateSpy = alwaysPass()
    const spy = chatSpy()

    await runCommand({queryType: 'chat', cell: store.getNode('root'), store})
    spy.mockRestore()
    validateSpy.mockRestore()

    expect(store.getNode('v0').title).toMatch(/\[\u2713\]/)
  })

  it('all sibling validate nodes receive [\u2713] when the batch passes on first attempt', async () => {
    const store = treeWithValidates('/validate criterion-A :retry=0', '/validate criterion-B :retry=0')
    const validateSpy = alwaysPass()
    const spy = chatSpy()

    await runCommand({queryType: 'chat', cell: store.getNode('root'), store})
    spy.mockRestore()
    validateSpy.mockRestore()

    expect(store.getNode('v0').title).toMatch(/\[\u2713\]/)
    expect(store.getNode('v1').title).toMatch(/\[\u2713\]/)
  })

  it('[\u2713 retry-N] appended when validate passes after N retries', async () => {
    const store = treeWithValidates('/validate criterion :retry=1')
    let callCount = 0
    const validateSpy = jest.spyOn(ValidateCommand.prototype, 'run').mockImplementation(async () => {
      callCount++
      if (callCount === 1) return {passed: false, criterion: 'criterion', reason: 'fail'}
      return {passed: true, criterion: 'criterion', reason: ''}
    })
    const spy = chatSpy()

    await runCommand({queryType: 'chat', cell: store.getNode('root'), store})
    spy.mockRestore()
    validateSpy.mockRestore()

    expect(store.getNode('v0').title).toMatch(/\[\u2713 retry-1\]/)
  })

  it('no retry count in suffix when passing on first attempt even if retry budget is available', async () => {
    const store = treeWithValidates('/validate criterion :retry=2')
    const validateSpy = alwaysPass()
    const spy = chatSpy()

    await runCommand({queryType: 'chat', cell: store.getNode('root'), store})
    spy.mockRestore()
    validateSpy.mockRestore()

    const title = store.getNode('v0').title
    expect(title).toMatch(/\[\u2713\]/)
    expect(title).not.toMatch(/retry/)
  })

  it('replaces pre-existing reliability suffix on pass (no stacking)', async () => {
    const store = treeWithValidates('/validate criterion :retry=0')
    store.getNode('v0').title = 'My validate [\u2717 2 attempts]'
    const validateSpy = alwaysPass()
    const spy = chatSpy()

    await runCommand({queryType: 'chat', cell: store.getNode('root'), store})
    spy.mockRestore()
    validateSpy.mockRestore()

    const title = store.getNode('v0').title
    expect(title).toMatch(/\[\u2713\]/)
    expect(title).not.toMatch(/\[\u2717\]/)
  })
})

describe('runCommand \u2014 /validate: [\u2717 N attempts] suffix on failed validation', () => {
  it('appends [\u2717 1 attempts] when retry=0 and criteria fails', async () => {
    const store = treeWithValidates('/validate criterion :retry=0')
    const validateSpy = alwaysFail()
    const spy = chatSpy()

    await runCommand({queryType: 'chat', cell: store.getNode('root'), store}).catch(() => {})
    spy.mockRestore()
    validateSpy.mockRestore()

    expect(store.getNode('v0').title).toMatch(/\[\u2717 1 attempts\]/)
  })

  it('appends [\u2717 3 attempts] when retry=2 and all retries fail', async () => {
    const store = treeWithValidates('/validate criterion :retry=2')
    const validateSpy = alwaysFail()
    const spy = chatSpy()

    await runCommand({queryType: 'chat', cell: store.getNode('root'), store}).catch(() => {})
    spy.mockRestore()
    validateSpy.mockRestore()

    expect(store.getNode('v0').title).toMatch(/\[\u2717 3 attempts\]/)
  })

  it('appends [\u2717 N attempts] to ALL sibling nodes when batch fails', async () => {
    const store = treeWithValidates('/validate criterion-A :retry=0', '/validate criterion-B :retry=0')
    const validateSpy = alwaysFail('criterion-A')
    const spy = chatSpy()

    await runCommand({queryType: 'chat', cell: store.getNode('root'), store}).catch(() => {})
    spy.mockRestore()
    validateSpy.mockRestore()

    expect(store.getNode('v0').title).toMatch(/\[\u2717 1 attempts\]/)
    expect(store.getNode('v1').title).toMatch(/\[\u2717 1 attempts\]/)
  })

  it('failure suffix is present in store at the moment CriteriaFailedError propagates', async () => {
    const store = treeWithValidates('/validate criterion :retry=0')
    const validateSpy = alwaysFail()
    const spy = chatSpy()

    let titleAtThrowTime
    try {
      await runCommand({queryType: 'chat', cell: store.getNode('root'), store})
    } catch {
      titleAtThrowTime = store.getNode('v0').title
    } finally {
      spy.mockRestore()
      validateSpy.mockRestore()
    }

    expect(titleAtThrowTime).toMatch(/\[\u2717 1 attempts\]/)
  })

  it('replaces pre-existing reliability suffix on failure (no stacking)', async () => {
    const store = treeWithValidates('/validate criterion :retry=0')
    store.getNode('v0').title = 'My validate [\u2713]'
    const validateSpy = alwaysFail()
    const spy = chatSpy()

    await runCommand({queryType: 'chat', cell: store.getNode('root'), store}).catch(() => {})
    spy.mockRestore()
    validateSpy.mockRestore()

    const title = store.getNode('v0').title
    expect(title).toMatch(/\[\u2717 1 attempts\]/)
    expect(title).not.toMatch(/\[\u2713\]/)
  })
})

describe('runCommand \u2014 /validate: empty criterion is a configuration error', () => {
  it('writes [\u2717 invalid] and throws CriteriaFailedError without invoking ValidateCommand.run', async () => {
    const store = treeWithValidates('/validate')
    const validateSpy = jest.spyOn(ValidateCommand.prototype, 'run')
    const spy = chatSpy()

    let thrown
    try {
      await runCommand({queryType: 'chat', cell: store.getNode('root'), store})
    } catch (e) {
      thrown = e
    } finally {
      spy.mockRestore()
      validateSpy.mockRestore()
    }

    expect(thrown).toBeInstanceOf(CriteriaFailedError)
    expect(validateSpy).not.toHaveBeenCalled()
    expect(store.getNode('v0').title).toMatch(/\[\u2717 invalid\]/)
  })

  it('does not consume any :retry budget \u2014 zero ValidateCommand.run calls regardless of :retry value', async () => {
    const store = treeWithValidates('/validate :retry=5')
    const validateSpy = jest.spyOn(ValidateCommand.prototype, 'run')
    const spy = chatSpy()

    await runCommand({queryType: 'chat', cell: store.getNode('root'), store}).catch(() => {})
    spy.mockRestore()
    validateSpy.mockRestore()

    expect(validateSpy).not.toHaveBeenCalled()
  })

  it('whitespace-only criterion is treated as empty and rejected at parse time', async () => {
    const store = treeWithValidates('/validate    ')
    const validateSpy = jest.spyOn(ValidateCommand.prototype, 'run')
    const spy = chatSpy()

    let thrown
    try {
      await runCommand({queryType: 'chat', cell: store.getNode('root'), store})
    } catch (e) {
      thrown = e
    } finally {
      spy.mockRestore()
      validateSpy.mockRestore()
    }

    expect(thrown).toBeInstanceOf(CriteriaFailedError)
    expect(validateSpy).not.toHaveBeenCalled()
    expect(store.getNode('v0').title).toMatch(/\[\u2717 invalid\]/)
  })

  it('only the empty-criterion sibling is marked [\u2717 invalid]; valid-criterion sibling is not pre-rejected', async () => {
    const store = treeWithValidates('/validate', '/validate must include numbers :retry=0')
    const validateSpy = jest.spyOn(ValidateCommand.prototype, 'run')
    const spy = chatSpy()

    await runCommand({queryType: 'chat', cell: store.getNode('root'), store}).catch(() => {})
    spy.mockRestore()
    validateSpy.mockRestore()

    expect(store.getNode('v0').title).toMatch(/\[\u2717 invalid\]/)
    expect(store.getNode('v1').title ?? '').not.toContain('[\u2717 invalid]')
    expect(validateSpy).not.toHaveBeenCalled()
  })

  it('all siblings receive [\u2717 invalid] when all have empty criterion', async () => {
    const store = treeWithValidates('/validate', '/validate')
    const validateSpy = jest.spyOn(ValidateCommand.prototype, 'run')
    const spy = chatSpy()

    await runCommand({queryType: 'chat', cell: store.getNode('root'), store}).catch(() => {})
    spy.mockRestore()
    validateSpy.mockRestore()

    expect(store.getNode('v0').title).toMatch(/\[\u2717 invalid\]/)
    expect(store.getNode('v1').title).toMatch(/\[\u2717 invalid\]/)
    expect(validateSpy).not.toHaveBeenCalled()
  })
})

describe('runCommand \u2014 /validate: each sibling cell receives its own individual verdict', () => {
  it('first sibling passes, second fails \u2014 first gets [\u2713], second gets [\u2717 N attempts]', async () => {
    const store = treeWithValidates('/validate criterion-A :retry=0', '/validate criterion-B :retry=0')
    let call = 0
    const validateSpy = jest.spyOn(ValidateCommand.prototype, 'run').mockImplementation(async () => {
      call++
      return call === 1
        ? {passed: true, criterion: 'criterion-A', reason: ''}
        : {passed: false, criterion: 'criterion-B', reason: 'missing'}
    })
    const spy = chatSpy()

    await runCommand({queryType: 'chat', cell: store.getNode('root'), store}).catch(() => {})
    spy.mockRestore()
    validateSpy.mockRestore()

    expect(store.getNode('v0').title).toMatch(/\[\u2713\]/)
    expect(store.getNode('v1').title).toMatch(/\[\u2717 1 attempts\]/)
  })

  it('first sibling fails, second passes \u2014 first gets [\u2717 N attempts], second gets [\u2713]', async () => {
    const store = treeWithValidates('/validate criterion-A :retry=0', '/validate criterion-B :retry=0')
    let call = 0
    const validateSpy = jest.spyOn(ValidateCommand.prototype, 'run').mockImplementation(async () => {
      call++
      return call === 1
        ? {passed: false, criterion: 'criterion-A', reason: 'missing'}
        : {passed: true, criterion: 'criterion-B', reason: ''}
    })
    const spy = chatSpy()

    await runCommand({queryType: 'chat', cell: store.getNode('root'), store}).catch(() => {})
    spy.mockRestore()
    validateSpy.mockRestore()

    expect(store.getNode('v0').title).toMatch(/\[\u2717 1 attempts\]/)
    expect(store.getNode('v1').title).toMatch(/\[\u2713\]/)
  })
})

describe('runCommand \u2014 non-CriteriaFailedError from post-processors is swallowed', () => {
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

describe('post-processor sort order: /validate runs after all other recognized post-processors', () => {
  it('enforces full priority chain: summarize \u2192 memorize \u2192 validate', async () => {
    const callOrder = []
    const {SummarizeCommand} = require('../SummarizeCommand')
    const {MemorizeCommand} = require('../MemorizeCommand')
    const summarizeSpy = jest.spyOn(SummarizeCommand.prototype, 'run').mockImplementation(async () => {
      callOrder.push('summarize')
    })
    const memSpy = jest.spyOn(MemorizeCommand.prototype, 'run').mockImplementation(async () => {
      callOrder.push('memorize')
    })
    const validateSpy = jest.spyOn(ValidateCommand.prototype, 'run').mockImplementation(async () => {
      callOrder.push('validate')
      return {passed: true, criterion: 'criterion', reason: ''}
    })

    const store = buildStore({
      root: chatRoot(['v0', 'sum', 'mem']),
      v0: {id: 'v0', parent: 'root', command: '/validate criterion', children: []},
      sum: {id: 'sum', parent: 'root', command: '/summarize', children: []},
      mem: {id: 'mem', parent: 'root', command: '/memorize', children: []},
    })
    const spy = chatSpy()
    try {
      await runCommand({queryType: 'chat', cell: store.getNode('root'), store})
    } finally {
      spy.mockRestore()
      summarizeSpy.mockRestore()
      memSpy.mockRestore()
      validateSpy.mockRestore()
    }

    expect(callOrder).toEqual(['summarize', 'memorize', 'validate'])
  })

  it('validate fires normally when unrecognized siblings are present', async () => {
    const callOrder = []
    const validateSpy = jest.spyOn(ValidateCommand.prototype, 'run').mockImplementation(async () => {
      callOrder.push('validate')
      return {passed: true, criterion: 'criterion', reason: ''}
    })

    const store = buildStore({
      root: chatRoot(['v0', 'unknown']),
      v0: {id: 'v0', parent: 'root', command: '/validate criterion', children: []},
      unknown: {id: 'unknown', parent: 'root', command: '/some-future-command', children: []},
    })
    const spy = chatSpy()
    try {
      await runCommand({queryType: 'chat', cell: store.getNode('root'), store})
    } finally {
      spy.mockRestore()
      validateSpy.mockRestore()
    }

    expect(callOrder).toContain('validate')
  })
})
