import {runCommand} from './runCommand'
import {CriteriaFailedError} from '../../reliability/core/CriteriaFailedError'
import {ValidateCommand} from '../../reliability/core/ValidateCommand'
import {MCPCommand} from '../MCPCommand'
import {MCP_FUSION_QUERY_TYPE} from '../../constants/mcpFusion'
import {MCPFusionCommand} from '../MCPFusionCommand'
import Store from './Store'
import {writeCachedIntegrationSettings} from './langchain/getLLM'
import {MOCK_VERIFIER_FAIL_KEYWORD, MOCK_VALIDATE_FAIL_CONDITIONAL_PREFIX} from './langchain/noopLLM/ResponsePlanner'

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

jest.mock('../../reliability/core/resolveRefineCell', () => ({
  resolveRefineCell: jest.fn(),
}))
jest.mock('../../reliability/core/RefineTopology', () => jest.fn(() => []))
jest.mock('../internalResearch/MemorizeDispatcher', () => ({
  dispatchMemorize: jest.fn(),
}))

const buildStore = nodeMap => new Store({userId: 'user1', nodes: nodeMap})

const chatRoot = (children, command = '/chat do task') => ({
  id: 'root',
  parent: null,
  command,
  children,
})

const validateNode = (id, command) => ({
  id,
  parent: 'root',
  command,
  children: [],
})

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
      await runCommand({
        queryType: 'chat',
        cell: store.getNode('root'),
        store,
      })
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
      await runCommand({
        queryType: 'chat',
        cell: store.getNode('root'),
        store,
      })
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
      await runCommand({
        queryType: 'chat',
        cell: store.getNode('root'),
        store,
      })
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
  it('passes the same abort signal to the initial run and each validation retry run', async () => {
    const store = treeWithValidates('/validate criterion :retry=1')
    const signal = new AbortController().signal
    const validateSpy = jest
      .spyOn(ValidateCommand.prototype, 'run')
      .mockResolvedValueOnce({
        passed: false,
        criterion: 'criterion',
        reason: 'missing detail',
      })
      .mockResolvedValueOnce({
        passed: true,
        criterion: 'criterion',
        reason: '',
      })
    const spy = chatSpy()

    await runCommand({
      queryType: 'chat',
      cell: store.getNode('root'),
      store,
      signal,
    })

    expect(spy).toHaveBeenCalledTimes(2)
    expect(spy.mock.calls.map(call => call[3])).toEqual([{signal}, {signal}])

    spy.mockRestore()
    validateSpy.mockRestore()
  })

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

  it('[\u2713 +N] appended when validate passes after N retries', async () => {
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

    expect(store.getNode('v0').title).toMatch(/\[\u2713 \+1\]/)
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
    store.getNode('v0').title = 'My validate [\u2717 2\u00d7]'
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

describe('runCommand \u2014 /validate: [\u2717 N\u00d7] suffix on failed validation', () => {
  it('appends [\u2717 1\u00d7] when retry=0 and criteria fails', async () => {
    const store = treeWithValidates('/validate criterion :retry=0')
    const validateSpy = alwaysFail()
    const spy = chatSpy()

    await runCommand({
      queryType: 'chat',
      cell: store.getNode('root'),
      store,
    }).catch(() => {})
    spy.mockRestore()
    validateSpy.mockRestore()

    expect(store.getNode('v0').title).toMatch(/\[\u2717 1\u00d7\]/)
  })

  it('appends [\u2717 3\u00d7] when retry=2 and all retries fail', async () => {
    const store = treeWithValidates('/validate criterion :retry=2')
    const validateSpy = alwaysFail()
    const spy = chatSpy()

    await runCommand({
      queryType: 'chat',
      cell: store.getNode('root'),
      store,
    }).catch(() => {})
    spy.mockRestore()
    validateSpy.mockRestore()

    expect(store.getNode('v0').title).toMatch(/\[\u2717 3\u00d7\]/)
  })

  it('appends [\u2717 N\u00d7] to ALL sibling nodes when batch fails', async () => {
    const store = treeWithValidates('/validate criterion-A :retry=0', '/validate criterion-B :retry=0')
    const validateSpy = alwaysFail('criterion-A')
    const spy = chatSpy()

    await runCommand({
      queryType: 'chat',
      cell: store.getNode('root'),
      store,
    }).catch(() => {})
    spy.mockRestore()
    validateSpy.mockRestore()

    expect(store.getNode('v0').title).toMatch(/\[\u2717 1\u00d7\]/)
    expect(store.getNode('v1').title).toMatch(/\[\u2717 1\u00d7\]/)
  })

  it('failure suffix is present in store at the moment CriteriaFailedError propagates', async () => {
    const store = treeWithValidates('/validate criterion :retry=0')
    const validateSpy = alwaysFail()
    const spy = chatSpy()

    let titleAtThrowTime
    try {
      await runCommand({
        queryType: 'chat',
        cell: store.getNode('root'),
        store,
      })
    } catch {
      titleAtThrowTime = store.getNode('v0').title
    } finally {
      spy.mockRestore()
      validateSpy.mockRestore()
    }

    expect(titleAtThrowTime).toMatch(/\[\u2717 1\u00d7\]/)
  })

  it('replaces pre-existing reliability suffix on failure (no stacking)', async () => {
    const store = treeWithValidates('/validate criterion :retry=0')
    store.getNode('v0').title = 'My validate [\u2713]'
    const validateSpy = alwaysFail()
    const spy = chatSpy()

    await runCommand({
      queryType: 'chat',
      cell: store.getNode('root'),
      store,
    }).catch(() => {})
    spy.mockRestore()
    validateSpy.mockRestore()

    const title = store.getNode('v0').title
    expect(title).toMatch(/\[\u2717 1\u00d7\]/)
    expect(title).not.toMatch(/\[\u2713\]/)
  })
})

describe('runCommand \u2014 /validate :retry side-effect containment', () => {
  const sideEffectingMcpAlias = {
    alias: '/qa-mcp',
    serverUrl: 'http://localhost:3100/mcp',
    transport: 'streamable-http',
    toolName: 'run',
  }

  it('withholds validation retry for an MCP alias parent after one external execution', async () => {
    const root = {
      id: 'root',
      parent: null,
      command: '/qa-mcp perform external mutation',
      children: ['v0'],
    }
    const store = buildStore({
      root,
      v0: validateNode('v0', '/validate criterion :retry=2'),
    })
    const mcpRun = jest.spyOn(MCPCommand.prototype, 'run').mockImplementation(async function (node) {
      this.store.createNode({id: 'external-result', parent: node.id, title: 'external result'}, true)
    })
    const validateSpy = alwaysFail()

    await expect(
      runCommand({
        queryType: 'mcp:qa-mcp',
        cell: store.getNode('root'),
        store,
        mcpAlias: sideEffectingMcpAlias,
      }),
    ).rejects.toBeInstanceOf(CriteriaFailedError)

    expect(mcpRun).toHaveBeenCalledTimes(1)
    expect(validateSpy).toHaveBeenCalledTimes(1)
    expect(store.getNode('v0').title).toMatch(/\[✗ ⊘\]/)
    expect(store.getNode('v0').reliabilityMetadata).toEqual(
      expect.objectContaining({
        mode: 'invalid',
        retryWithheld: true,
        requestedRetry: 2,
        cause: 'side-effecting-alias',
        failureCause: 'criteria-failed',
      }),
    )

    mcpRun.mockRestore()
    validateSpy.mockRestore()
  })

  it('withholds validation retry for /mcp fusion after one external execution', async () => {
    const root = {
      id: 'root',
      parent: null,
      command: '/mcp perform external mutation',
      children: ['v0'],
    }
    const store = buildStore({
      root,
      v0: validateNode('v0', '/validate criterion :retry=2'),
    })
    const fusionRun = jest.spyOn(MCPFusionCommand.prototype, 'run').mockImplementation(async function (node) {
      this.store.createNode({id: 'fusion-result', parent: node.id, title: 'fusion result'}, true)
    })
    const validateSpy = alwaysFail()

    await expect(
      runCommand({
        queryType: MCP_FUSION_QUERY_TYPE,
        cell: store.getNode('root'),
        store,
      }),
    ).rejects.toBeInstanceOf(CriteriaFailedError)

    expect(fusionRun).toHaveBeenCalledTimes(1)
    expect(validateSpy).toHaveBeenCalledTimes(1)
    expect(store.getNode('v0').reliabilityMetadata).toEqual(
      expect.objectContaining({retryWithheld: true, requestedRetry: 2}),
    )

    fusionRun.mockRestore()
    validateSpy.mockRestore()
  })

  it('discriminates withheld from genuine exhaustion: only withheld carries retryWithheld:true', async () => {
    // genuine exhaustion (non-side-effecting parent, all retries consumed)
    const store = treeWithValidates('/validate criterion :retry=1')
    const validateSpy = alwaysFail()
    const spy = chatSpy()

    const exhaustionError = await runCommand({
      queryType: 'chat',
      cell: store.getNode('root'),
      store,
    }).catch(e => e)

    expect(exhaustionError).toBeInstanceOf(CriteriaFailedError)
    const exhaustedMeta = store.getNode('v0').reliabilityMetadata
    // genuine exhaustion never sets reliabilityMetadata on the validate node — that's the discriminator:
    // withheld → retryWithheld:true in metadata; exhausted → no metadata at all
    expect(exhaustedMeta).toBeUndefined()

    spy.mockRestore()
    validateSpy.mockRestore()
  })

  it('keeps validation retry enabled for native chat parents', async () => {
    const store = treeWithValidates('/validate criterion :retry=1')
    const validateSpy = jest
      .spyOn(ValidateCommand.prototype, 'run')
      .mockResolvedValueOnce({
        passed: false,
        criterion: 'criterion',
        reason: 'missing detail',
      })
      .mockResolvedValueOnce({
        passed: true,
        criterion: 'criterion',
        reason: '',
      })
    const spy = chatSpy()

    await runCommand({queryType: 'chat', cell: store.getNode('root'), store})

    expect(spy).toHaveBeenCalledTimes(2)
    expect(validateSpy).toHaveBeenCalledTimes(2)
    expect(store.getNode('v0').title).toMatch(/\[✓ \+1\]/)

    spy.mockRestore()
    validateSpy.mockRestore()
  })

  it(':retry=0 on a side-effecting parent — no retry budget to withhold; CriteriaFailedError thrown with no retryWithheld metadata', async () => {
    const root = {
      id: 'root',
      parent: null,
      command: '/qa-mcp perform external op',
      children: ['v0'],
    }
    const sideEffectingMcpAlias = {
      alias: '/qa-mcp',
      serverUrl: 'http://localhost:3100/mcp',
      transport: 'streamable-http',
      toolName: 'run',
    }
    const store = buildStore({
      root,
      v0: validateNode('v0', '/validate criterion :retry=0'),
    })
    const mcpRun = jest.spyOn(MCPCommand.prototype, 'run').mockImplementation(async function (node) {
      this.store.createNode({id: 'mcp-result', parent: node.id, title: 'mcp result'}, true)
    })
    const validateSpy = alwaysFail()

    await expect(
      runCommand({
        queryType: 'mcp:qa-mcp',
        cell: store.getNode('root'),
        store,
        mcpAlias: sideEffectingMcpAlias,
      }),
    ).rejects.toBeInstanceOf(CriteriaFailedError)

    expect(mcpRun).toHaveBeenCalledTimes(1)
    expect(validateSpy).toHaveBeenCalledTimes(1)
    expect(store.getNode('v0').reliabilityMetadata).toBeUndefined()

    mcpRun.mockRestore()
    validateSpy.mockRestore()
  })
})

describe('runCommand \u2014 /validate: empty criterion is a configuration error', () => {
  it('writes [\u2717 !] and throws CriteriaFailedError without invoking ValidateCommand.run', async () => {
    const store = treeWithValidates('/validate')
    const validateSpy = jest.spyOn(ValidateCommand.prototype, 'run')
    const spy = chatSpy()

    let thrown
    try {
      await runCommand({
        queryType: 'chat',
        cell: store.getNode('root'),
        store,
      })
    } catch (e) {
      thrown = e
    } finally {
      spy.mockRestore()
      validateSpy.mockRestore()
    }

    expect(thrown).toBeInstanceOf(CriteriaFailedError)
    expect(validateSpy).not.toHaveBeenCalled()
    expect(store.getNode('v0').title).toMatch(/\[\u2717 !\]/)
    expect(store.getNode('v0').reliabilityMetadata?.mode).toBe('invalid')
    expect(store.getNode('v0').reliabilityMetadata?.failureCause).toBe('invalid-criteria')
  })

  it('does not consume any :retry budget \u2014 zero ValidateCommand.run calls regardless of :retry value', async () => {
    const store = treeWithValidates('/validate :retry=5')
    const validateSpy = jest.spyOn(ValidateCommand.prototype, 'run')
    const spy = chatSpy()

    await runCommand({
      queryType: 'chat',
      cell: store.getNode('root'),
      store,
    }).catch(() => {})
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
      await runCommand({
        queryType: 'chat',
        cell: store.getNode('root'),
        store,
      })
    } catch (e) {
      thrown = e
    } finally {
      spy.mockRestore()
      validateSpy.mockRestore()
    }

    expect(thrown).toBeInstanceOf(CriteriaFailedError)
    expect(validateSpy).not.toHaveBeenCalled()
    expect(store.getNode('v0').title).toMatch(/\[\u2717 !\]/)
    expect(store.getNode('v0').reliabilityMetadata?.mode).toBe('invalid')
    expect(store.getNode('v0').reliabilityMetadata?.failureCause).toBe('invalid-criteria')
  })

  it('only the empty-criterion sibling is marked [\u2717 !]; valid-criterion sibling is not pre-rejected', async () => {
    const store = treeWithValidates('/validate', '/validate must include numbers :retry=0')
    const validateSpy = jest.spyOn(ValidateCommand.prototype, 'run')
    const spy = chatSpy()

    await runCommand({
      queryType: 'chat',
      cell: store.getNode('root'),
      store,
    }).catch(() => {})
    spy.mockRestore()
    validateSpy.mockRestore()

    expect(store.getNode('v0').title).toMatch(/\[\u2717 !\]/)
    expect(store.getNode('v0').reliabilityMetadata?.mode).toBe('invalid')
    expect(store.getNode('v0').reliabilityMetadata?.failureCause).toBe('invalid-criteria')
    expect(store.getNode('v1').title ?? '').not.toContain('[\u2717 !]')
    expect(store.getNode('v1').reliabilityMetadata).toBeUndefined()
    expect(validateSpy).not.toHaveBeenCalled()
  })

  it('all siblings receive [\u2717 !] when all have empty criterion', async () => {
    const store = treeWithValidates('/validate', '/validate')
    const validateSpy = jest.spyOn(ValidateCommand.prototype, 'run')
    const spy = chatSpy()

    await runCommand({
      queryType: 'chat',
      cell: store.getNode('root'),
      store,
    }).catch(() => {})
    spy.mockRestore()
    validateSpy.mockRestore()

    expect(store.getNode('v0').title).toMatch(/\[\u2717 !\]/)
    expect(store.getNode('v0').reliabilityMetadata?.mode).toBe('invalid')
    expect(store.getNode('v0').reliabilityMetadata?.failureCause).toBe('invalid-criteria')
    expect(store.getNode('v0').reliabilityMetadata?.remediationHint).toBe('adjust-criteria')
    expect(store.getNode('v1').title).toMatch(/\[\u2717 !\]/)
    expect(store.getNode('v1').reliabilityMetadata?.mode).toBe('invalid')
    expect(store.getNode('v1').reliabilityMetadata?.failureCause).toBe('invalid-criteria')
    expect(validateSpy).not.toHaveBeenCalled()
  })
})

describe('runCommand \u2014 /validate: each sibling cell receives its own individual verdict', () => {
  it('first sibling passes, second fails \u2014 first gets [\u2713], second gets [\u2717 N\u00d7]', async () => {
    const store = treeWithValidates('/validate criterion-A :retry=0', '/validate criterion-B :retry=0')
    let call = 0
    const validateSpy = jest.spyOn(ValidateCommand.prototype, 'run').mockImplementation(async () => {
      call++
      return call === 1
        ? {passed: true, criterion: 'criterion-A', reason: ''}
        : {passed: false, criterion: 'criterion-B', reason: 'missing'}
    })
    const spy = chatSpy()

    await runCommand({
      queryType: 'chat',
      cell: store.getNode('root'),
      store,
    }).catch(() => {})
    spy.mockRestore()
    validateSpy.mockRestore()

    expect(store.getNode('v0').title).toMatch(/\[\u2713\]/)
    expect(store.getNode('v1').title).toMatch(/\[\u2717 1\u00d7\]/)
  })

  it('first sibling fails, second passes \u2014 first gets [\u2717 N\u00d7], second gets [\u2713]', async () => {
    const store = treeWithValidates('/validate criterion-A :retry=0', '/validate criterion-B :retry=0')
    let call = 0
    const validateSpy = jest.spyOn(ValidateCommand.prototype, 'run').mockImplementation(async () => {
      call++
      return call === 1
        ? {passed: false, criterion: 'criterion-A', reason: 'missing'}
        : {passed: true, criterion: 'criterion-B', reason: ''}
    })
    const spy = chatSpy()

    await runCommand({
      queryType: 'chat',
      cell: store.getNode('root'),
      store,
    }).catch(() => {})
    spy.mockRestore()
    validateSpy.mockRestore()

    expect(store.getNode('v0').title).toMatch(/\[\u2717 1\u00d7\]/)
    expect(store.getNode('v1').title).toMatch(/\[\u2713\]/)
  })
})

describe('runCommand \u2014 /validate retry preserves the best attempt', () => {
  it('does not commit a later retry that loses a criterion already satisfied by an earlier attempt', async () => {
    const store = treeWithValidates('/validate criterion-A :retry=1', '/validate criterion-B :retry=1')
    const {ChatCommand} = require('../ChatCommand')
    let chatCall = 0
    const chatRun = jest.spyOn(ChatCommand.prototype, 'run').mockImplementation(async function () {
      chatCall++
      this.store.createNode(
        {
          id: `prompt-${chatCall}`,
          parent: 'root',
          title: `attempt ${chatCall}`,
          children: [],
        },
        true,
      )
    })
    const validateRun = jest.spyOn(ValidateCommand.prototype, 'run').mockImplementation(async validateNode => {
      if (chatCall === 1) {
        return validateNode.id === 'v0'
          ? {passed: true, criterion: 'criterion-A', reason: ''}
          : {passed: false, criterion: 'criterion-B', reason: 'missing B'}
      }
      return validateNode.id === 'v0'
        ? {passed: false, criterion: 'criterion-A', reason: 'lost A'}
        : {passed: true, criterion: 'criterion-B', reason: ''}
    })

    let thrown
    try {
      await runCommand({
        queryType: 'chat',
        cell: store.getNode('root'),
        store,
      })
    } catch (e) {
      thrown = e
    } finally {
      chatRun.mockRestore()
      validateRun.mockRestore()
    }

    expect(thrown).toBeInstanceOf(CriteriaFailedError)
    expect(thrown.criterion).toBe('criterion-B')
    expect(store.getNode('root').prompts).toEqual(['prompt-1'])
    expect(store.getNode('prompt-1')).toBeDefined()
    expect(store.getNode('prompt-2')).toBeUndefined()
    expect(store.getNode('v0').title).toMatch(/\[✓ \+1\]/)
    expect(store.getNode('v1').title).toMatch(/\[✗ 2×\]/)
  })
})

describe('runCommand \u2014 /validate with NoopLLM verifier contract', () => {
  const originalMockExternalServices = process.env.MOCK_EXTERNAL_SERVICES
  const mockValidatedWorkflow = criterion => {
    const root = {
      id: 'root',
      parent: null,
      command: '/chat produce a short substantive answer',
      children: ['validate'],
    }
    const validate = {
      id: 'validate',
      parent: 'root',
      command: `/validate ${criterion} :retry=0`,
      children: [],
    }
    const store = buildStore({root, validate})
    writeCachedIntegrationSettings(store, store._userId, null, {})
    return {root, validate, store}
  }

  beforeAll(() => {
    process.env.MOCK_EXTERNAL_SERVICES = 'true'
  })

  afterAll(() => {
    if (originalMockExternalServices === undefined) delete process.env.MOCK_EXTERNAL_SERVICES
    else process.env.MOCK_EXTERNAL_SERVICES = originalMockExternalServices
  })

  it.each([
    ['satisfied criterion', 'answer is substantive', false, /\[✓\]/],
    ['rejected criterion', `${MOCK_VERIFIER_FAIL_KEYWORD} force verifier failure`, true, /\[✗ 1×\]/],
  ])('maps %s to its visible suffix without changing substrate state', async (_label, criterion, rejects, suffix) => {
    const {root, validate, store} = mockValidatedWorkflow(criterion)
    const execution = runCommand({queryType: 'chat', cell: root, store})

    if (rejects) await expect(execution).rejects.toBeInstanceOf(CriteriaFailedError)
    else await expect(execution).resolves.toBeUndefined()

    expect(store.getNode(validate.id).title).toMatch(suffix)
  })

  it('pass and fail verdicts are both reachable in one process without changing mock configuration', async () => {
    const pass = mockValidatedWorkflow('answer is substantive')
    const fail = mockValidatedWorkflow(`${MOCK_VERIFIER_FAIL_KEYWORD} force verifier failure`)

    await expect(runCommand({queryType: 'chat', cell: pass.root, store: pass.store})).resolves.toBeUndefined()
    await expect(runCommand({queryType: 'chat', cell: fail.root, store: fail.store})).rejects.toBeInstanceOf(
      CriteriaFailedError,
    )

    expect(pass.store.getNode(pass.validate.id).title).toMatch(/\[✓\]/)
    expect(fail.store.getNode(fail.validate.id).title).toMatch(/\[✗ 1×\]/)
  })

  const buildConditionalSentinelStore = (token, chatContent) => {
    const root = {
      id: 'root',
      parent: null,
      command: `/chat ${chatContent}`,
      children: ['v'],
    }
    const v = {
      id: 'v',
      parent: 'root',
      command: `/validate ${MOCK_VALIDATE_FAIL_CONDITIONAL_PREFIX}${token} :retry=0`,
      children: [],
    }
    const store = buildStore({root, v})
    writeCachedIntegrationSettings(store, store._userId, null, {})
    return {root, store}
  }

  it.each([
    ['token present in content — verifier rejects', 'SENTINEL', 'response including SENTINEL', true],
    ['token absent from content — verifier accepts', 'SENTINEL', 'regular response', false],
  ])('conditional sentinel: %s', async (_label, token, chatContent, shouldFail) => {
    const {root, store} = buildConditionalSentinelStore(token, chatContent)
    const execution = runCommand({queryType: 'chat', cell: root, store})

    if (shouldFail) {
      await expect(execution).rejects.toBeInstanceOf(CriteriaFailedError)
      expect(store.getNode('v').title).toMatch(/\[✗ 1×\]/)
    } else {
      await expect(execution).resolves.toBeUndefined()
      expect(store.getNode('v').title).toMatch(/\[✓\]/)
    }
  })
})

describe('runCommand — /validate :retry with a superseded prompt node surviving in children (P0.8 reload-shape regression)', () => {
  const originalMockExternalServices = process.env.MOCK_EXTERNAL_SERVICES

  beforeAll(() => {
    process.env.MOCK_EXTERNAL_SERVICES = 'true'
  })

  afterAll(() => {
    if (originalMockExternalServices === undefined) delete process.env.MOCK_EXTERNAL_SERVICES
    else process.env.MOCK_EXTERNAL_SERVICES = originalMockExternalServices
  })

  // Root cause (note-12857 P0.8): the verifier's parent-fallback read source
  // (extractValidationContent -> NodeTextExtractor.extractFullContent) walks the parent's
  // whole `children` subtree. After a persistence/reload the authoritative `prompts` linkage
  // can drop while a superseded attempt-0 prompt-output node survives in `children`; that stale
  // node is then concatenated into EVERY re-validation, so a criterion keyed to the stale
  // marker can never clear and the retry loop exhausts to [✗ N×] even though every fresh
  // regeneration satisfies the criterion. This test constructs that reload shape directly.
  // The marker is unique so the freshly generated NoopLLM content
  // (`mock-content-variant-<hash%8> :: <corpus preview>`) can never carry it.
  const STALE_MARKER = 'STALESENTINEL_P08'
  const buildReloadShapeStore = () => {
    const root = {
      id: 'root',
      parent: null,
      command: '/chat produce a short substantive answer',
      children: ['stale', 'v'],
      prompts: [],
    }
    const stale = {
      id: 'stale',
      parent: 'root',
      title: `mock-content-variant-0 :: ${STALE_MARKER} leftover attempt-0 output`,
      children: [],
    }
    const v = {
      id: 'v',
      parent: 'root',
      command: `/validate ${MOCK_VALIDATE_FAIL_CONDITIONAL_PREFIX}${STALE_MARKER} output must avoid the leftover marker :retry=2`,
      children: [],
    }
    const store = buildStore({root, stale, v})
    writeCachedIntegrationSettings(store, store._userId, null, {})
    return {root, store}
  }

  it('does not re-validate the superseded attempt-0 child; recovers instead of exhausting to [✗ 3×]', async () => {
    const {root, store} = buildReloadShapeStore()

    // Before the fix the stale child keeps the marker present, so the criterion never clears and
    // runCommand rejects with CriteriaFailedError ([✗ 3×]); after the fix the verifier sources the
    // parent's authoritative materialized output (prompts) and the run resolves with a pass.
    await expect(runCommand({queryType: 'chat', cell: root, store})).resolves.toBeUndefined()

    expect(store.getNode('v').title).toMatch(/\[✓/)
    expect(store.getNode('v').title).not.toMatch(/\[✗/)
  })
})

describe('runCommand \u2014 non-CriteriaFailedError from post-processors is swallowed', () => {
  it('resolves normally when a non-validate post-processor throws a generic error', async () => {
    const store = buildStore({
      root: chatRoot(['memnode']),
      memnode: {
        id: 'memnode',
        parent: 'root',
        command: '/memorize',
        children: [],
      },
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
    const summarizeSpy = jest.spyOn(SummarizeCommand.prototype, 'run').mockImplementation(async () => {
      callOrder.push('summarize')
    })
    const {dispatchMemorize} = require('../internalResearch/MemorizeDispatcher')
    const memSpy = dispatchMemorize.mockImplementation(async () => {
      callOrder.push('memorize')
    })
    const validateSpy = jest.spyOn(ValidateCommand.prototype, 'run').mockImplementation(async () => {
      callOrder.push('validate')
      return {passed: true, criterion: 'criterion', reason: ''}
    })

    const store = buildStore({
      root: chatRoot(['v0', 'sum', 'mem']),
      v0: {
        id: 'v0',
        parent: 'root',
        command: '/validate criterion',
        children: [],
      },
      sum: {id: 'sum', parent: 'root', command: '/summarize', children: []},
      mem: {id: 'mem', parent: 'root', command: '/memorize', children: []},
    })
    const spy = chatSpy()
    try {
      await runCommand({
        queryType: 'chat',
        cell: store.getNode('root'),
        store,
      })
    } finally {
      spy.mockRestore()
      summarizeSpy.mockRestore()
      memSpy.mockReset()
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
      v0: {
        id: 'v0',
        parent: 'root',
        command: '/validate criterion',
        children: [],
      },
      unknown: {
        id: 'unknown',
        parent: 'root',
        command: '/some-future-command',
        children: [],
      },
    })
    const spy = chatSpy()
    try {
      await runCommand({
        queryType: 'chat',
        cell: store.getNode('root'),
        store,
      })
    } finally {
      spy.mockRestore()
      validateSpy.mockRestore()
    }

    expect(callOrder).toContain('validate')
  })
})
