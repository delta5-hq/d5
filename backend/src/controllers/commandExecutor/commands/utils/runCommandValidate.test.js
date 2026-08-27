import {runCommand} from './runCommand'
import {CriteriaFailedError} from '../../reliability/core/CriteriaFailedError'
import {ValidateCommand} from '../../reliability/core/ValidateCommand'
import {MCPCommand} from '../MCPCommand'
import {SummarizeCommand} from '../SummarizeCommand'
import {dispatchMemorize} from '../internalResearch/MemorizeDispatcher'
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

jest.mock('../../reliability/core/resolveElectCell', () => ({resolveElectCell: jest.fn()}))
jest.mock('../../reliability/core/ElectTopology', () => jest.fn(() => []))
jest.mock('../internalResearch/MemorizeDispatcher', () => ({dispatchMemorize: jest.fn()}))

const buildStore = nodes => new Store({userId: 'user1', nodes})

const validateNode = (id, parent, command) => ({id, parent, command, title: command, children: []})

const validationTree = command =>
  buildStore({
    root: {id: 'root', command: '/chat do task', children: ['validate']},
    validate: validateNode('validate', 'root', command),
  })

const flatValidationTree = (...commands) => {
  const ids = commands.map((_, index) => `validate-${index}`)
  return buildStore({
    root: {id: 'root', command: '/chat do task', children: ids},
    ...Object.fromEntries(commands.map((command, index) => [ids[index], validateNode(ids[index], 'root', command)])),
  })
}

const refinementTree = (command = '/refine :n=3', validateCommands = ['/validate criterion']) => {
  const validateIds = validateCommands.map((_, index) => `validate-${index}`)
  return buildStore({
    root: {id: 'root', command: '/chat do task', children: ['refine']},
    refine: {id: 'refine', parent: 'root', command, title: command, children: validateIds},
    ...Object.fromEntries(
      validateCommands.map((validateCommand, index) => [
        validateIds[index],
        validateNode(validateIds[index], 'refine', validateCommand),
      ]),
    ),
  })
}

const chatSpy = () => jest.spyOn(require('../ChatCommand').ChatCommand.prototype, 'run').mockResolvedValue({})

beforeEach(() => jest.clearAllMocks())

afterEach(() => jest.restoreAllMocks())

describe('/validate is a pure one-shot predicate', () => {
  it('executes the generator and validator once and writes only the pass verdict', async () => {
    const store = validationTree('/validate criterion')
    const generator = chatSpy()
    const validator = jest
      .spyOn(ValidateCommand.prototype, 'run')
      .mockResolvedValue({passed: true, criterion: 'criterion', reason: ''})

    await runCommand({queryType: 'chat', cell: store.getNode('root'), store})

    expect(generator).toHaveBeenCalledTimes(1)
    expect(validator).toHaveBeenCalledTimes(1)
    expect(store.getNode('validate').title).toBe('/validate criterion [✓]')
    expect(store.getNode('validate').reliabilityMetadata).toMatchObject({
      mode: 'validate',
      eligible: 1,
      total: 1,
    })
  })

  it('propagates a one-attempt criteria failure and writes only the fail verdict', async () => {
    const store = validationTree('/validate criterion')
    const generator = chatSpy()
    const validator = jest
      .spyOn(ValidateCommand.prototype, 'run')
      .mockResolvedValue({passed: false, criterion: 'criterion', reason: 'missing'})

    await expect(runCommand({queryType: 'chat', cell: store.getNode('root'), store})).rejects.toMatchObject({
      criterion: 'criterion',
      attempts: 1,
    })

    expect(generator).toHaveBeenCalledTimes(1)
    expect(validator).toHaveBeenCalledTimes(1)
    expect(store.getNode('validate').title).toBe('/validate criterion [✗]')
  })

  it('rejects legacy :retry ownership visibly without invoking the validator', async () => {
    const store = validationTree('/validate :retry=2 criterion')
    chatSpy()
    const validator = jest.spyOn(ValidateCommand.prototype, 'run')

    await expect(runCommand({queryType: 'chat', cell: store.getNode('root'), store})).rejects.toBeInstanceOf(
      CriteriaFailedError,
    )

    expect(validator).not.toHaveBeenCalled()
    expect(store.getNode('validate').title.endsWith('[✗ !]')).toBe(true)
    const errorNode = Object.values(store._nodes).find(
      node => node.parent === 'validate' && node.executionStatus === 'error',
    )
    expect(errorNode?.title).toContain('/refine :n=N')
  })

  it.each(['/validate', '/validate   '])(
    'rejects an empty criterion before invoking the verifier: %p',
    async command => {
      const store = validationTree(command)
      chatSpy()
      const validator = jest.spyOn(ValidateCommand.prototype, 'run')

      await expect(runCommand({queryType: 'chat', cell: store.getNode('root'), store})).rejects.toBeInstanceOf(
        CriteriaFailedError,
      )

      expect(validator).not.toHaveBeenCalled()
      expect(store.getNode('validate').title.endsWith('[✗ !]')).toBe(true)
    },
  )

  it('marks only the invalid sibling as a configuration error', async () => {
    const store = flatValidationTree('/validate', '/validate valid criterion')
    chatSpy()
    const validator = jest.spyOn(ValidateCommand.prototype, 'run')

    await expect(runCommand({queryType: 'chat', cell: store.getNode('root'), store})).rejects.toBeInstanceOf(
      CriteriaFailedError,
    )

    expect(validator).not.toHaveBeenCalled()
    expect(store.getNode('validate-0').title.endsWith('[✗ !]')).toBe(true)
    expect(store.getNode('validate-1').title).toBe('/validate valid criterion')
  })

  it('persists an individual verdict on every valid sibling before propagating group failure', async () => {
    const store = flatValidationTree('/validate criterion-A', '/validate criterion-B')
    chatSpy()
    jest
      .spyOn(ValidateCommand.prototype, 'run')
      .mockResolvedValueOnce({passed: true, criterion: 'criterion-A', reason: ''})
      .mockResolvedValueOnce({passed: false, criterion: 'criterion-B', reason: 'missing'})

    await expect(runCommand({queryType: 'chat', cell: store.getNode('root'), store})).rejects.toBeInstanceOf(
      CriteriaFailedError,
    )

    expect(store.getNode('validate-0').title).toBe('/validate criterion-A [✓]')
    expect(store.getNode('validate-1').title).toBe('/validate criterion-B [✗]')
  })
})

describe('/refine owns bounded parent re-execution', () => {
  it('stops on the first passing attempt and persists the real count', async () => {
    const store = refinementTree('/refine :n=3')
    const generator = chatSpy()
    jest.spyOn(ValidateCommand.prototype, 'run').mockResolvedValue({passed: true, criterion: 'criterion', reason: ''})

    await runCommand({queryType: 'chat', cell: store.getNode('root'), store})

    expect(generator).toHaveBeenCalledTimes(1)
    expect(store.getNode('refine')).toMatchObject({
      title: '/refine :n=3 [✓ 1×]',
      reliabilityMetadata: {mode: 'refine', attempts: 1, total: 1, requestedN: 3},
    })
    expect(store.getNode('validate-0').title.endsWith('[✓]')).toBe(true)
  })

  it('does not claim a withheld retry when a side-effecting parent passes on its first attempt', async () => {
    const store = refinementTree('/refine :n=3')
    store.getNode('root').command = '/external mutate'
    const alias = {alias: '/external', transport: 'stdio', toolName: 'mutate'}
    const generator = jest.spyOn(MCPCommand.prototype, 'run').mockResolvedValue({})
    jest.spyOn(ValidateCommand.prototype, 'run').mockResolvedValue({passed: true, criterion: 'criterion', reason: ''})

    await runCommand({queryType: 'mcp:external', cell: store.getNode('root'), store, mcpAlias: alias})

    expect(generator).toHaveBeenCalledTimes(1)
    expect(store.getNode('refine').reliabilityMetadata).toMatchObject({
      mode: 'refine',
      attempts: 1,
      requestedN: 3,
    })
    expect(store.getNode('refine').reliabilityMetadata.suppressed).toBeUndefined()
    expect(store.getNode('refine').reliabilityMetadata.cause).toBeUndefined()
  })

  it('re-executes until a later predicate pass and forwards the abort signal on every draw', async () => {
    const store = refinementTree('/refine :n=3')
    const signal = new AbortController().signal
    const generator = chatSpy()
    jest
      .spyOn(ValidateCommand.prototype, 'run')
      .mockResolvedValueOnce({passed: false, criterion: 'criterion', reason: 'missing'})
      .mockResolvedValueOnce({passed: true, criterion: 'criterion', reason: ''})

    await runCommand({queryType: 'chat', cell: store.getNode('root'), store, signal})

    expect(generator).toHaveBeenCalledTimes(2)
    expect(generator.mock.calls.map(call => call[3])).toEqual([{signal}, {signal}])
    expect(store.getNode('refine').title).toBe('/refine :n=3 [✓ 2×]')
    expect(store.getNode('refine').reliabilityMetadata.attempts).toBe(2)
  })

  it('exhausts exactly N draws, reports N, and retains the best observed attempt', async () => {
    const store = refinementTree('/refine :n=2', ['/validate criterion-A', '/validate criterion-B'])
    const generator = chatSpy()
    jest
      .spyOn(ValidateCommand.prototype, 'run')
      .mockResolvedValueOnce({passed: true, criterion: 'criterion-A', reason: ''})
      .mockResolvedValueOnce({passed: false, criterion: 'criterion-B', reason: 'missing'})
      .mockResolvedValueOnce({passed: false, criterion: 'criterion-A', reason: 'regressed'})
      .mockResolvedValueOnce({passed: false, criterion: 'criterion-B', reason: 'missing'})

    await expect(runCommand({queryType: 'chat', cell: store.getNode('root'), store})).rejects.toMatchObject({
      attempts: 2,
    })

    expect(generator).toHaveBeenCalledTimes(2)
    expect(store.getNode('refine')).toMatchObject({
      title: '/refine :n=2 [✗ 2×]',
      reliabilityMetadata: {mode: 'refine', attempts: 2, total: 2, requestedN: 2},
    })
    expect(store.getNode('validate-0').title.endsWith('[✓]')).toBe(true)
    expect(store.getNode('validate-1').title.endsWith('[✗]')).toBe(true)
  })

  it('restores the best generated subtree without duplicate output or leaked loser descendants', async () => {
    const store = refinementTree('/refine :n=2', ['/validate criterion-A', '/validate criterion-B'])
    let draw = 0
    const generator = jest
      .spyOn(require('../ChatCommand').ChatCommand.prototype, 'run')
      .mockImplementation(function createAttemptOutput(node) {
        draw++
        const promptId = `prompt-${draw}`
        const nestedId = `nested-${draw}`
        this.store.createNode({id: promptId, parent: node.id, title: `attempt ${draw}`, children: [nestedId]}, true)
        this.store.createNode({id: nestedId, parent: promptId, title: `nested attempt ${draw}`, children: []})
      })
    jest
      .spyOn(ValidateCommand.prototype, 'run')
      .mockResolvedValueOnce({passed: true, criterion: 'criterion-A', reason: ''})
      .mockResolvedValueOnce({passed: false, criterion: 'criterion-B', reason: 'missing'})
      .mockResolvedValueOnce({passed: false, criterion: 'criterion-A', reason: 'regressed'})
      .mockResolvedValueOnce({passed: false, criterion: 'criterion-B', reason: 'missing'})

    await expect(runCommand({queryType: 'chat', cell: store.getNode('root'), store})).rejects.toBeInstanceOf(
      CriteriaFailedError,
    )

    expect(generator).toHaveBeenCalledTimes(2)
    expect(store.getNode('root').prompts).toEqual(['prompt-1'])
    expect(store.getNode('prompt-1')).toBeDefined()
    expect(store.getNode('nested-1')).toBeDefined()
    expect(store.getNode('prompt-2')).toBeUndefined()
    expect(store.getNode('nested-2')).toBeUndefined()
    const outputIds = store.getOutput().nodes.map(node => node.id)
    expect(new Set(outputIds).size).toBe(outputIds.length)
    expect(outputIds).not.toContain('prompt-2')
    expect(outputIds).not.toContain('nested-2')
  })

  it('contains side-effecting parents to one execution and persists why', async () => {
    const store = refinementTree('/refine :n=3')
    store.getNode('root').command = '/external mutate'
    const alias = {alias: '/external', transport: 'stdio', toolName: 'mutate'}
    const generator = jest.spyOn(MCPCommand.prototype, 'run').mockResolvedValue({})
    jest
      .spyOn(ValidateCommand.prototype, 'run')
      .mockResolvedValue({passed: false, criterion: 'criterion', reason: 'missing'})

    await expect(
      runCommand({
        queryType: 'mcp:external',
        cell: store.getNode('root'),
        store,
        mcpAlias: alias,
      }),
    ).rejects.toBeInstanceOf(CriteriaFailedError)

    expect(generator).toHaveBeenCalledTimes(1)
    expect(store.getNode('refine').reliabilityMetadata).toMatchObject({
      mode: 'refine',
      attempts: 1,
      requestedN: 3,
      suppressed: true,
      cause: 'side-effecting-alias',
    })
  })

  it.each([
    ['/refine :n=0', 'minimum is :n=1'],
    ['/refine :n=3.5', 'accepts only :n=N'],
    ['/refine :n=3 unexpected', 'unexpected text'],
  ])('rejects malformed or unsupported syntax: %s', async (command, detail) => {
    const store = refinementTree(command)
    const generator = chatSpy()
    const validator = jest.spyOn(ValidateCommand.prototype, 'run')

    await runCommand({queryType: 'chat', cell: store.getNode('root'), store})

    expect(generator).toHaveBeenCalledTimes(1)
    expect(validator).not.toHaveBeenCalled()
    expect(store.getNode('refine').title.endsWith('[✗ !]')).toBe(true)
    const errorNode = Object.values(store._nodes).find(
      node => node.parent === 'refine' && node.executionStatus === 'error',
    )
    expect(errorNode?.title).toContain(detail)
  })
})

describe('neighboring post-processors retain their established behavior', () => {
  it('swallows a generic non-criteria post-processor failure', async () => {
    const store = buildStore({
      root: {id: 'root', command: '/chat do task', children: ['summarize']},
      summarize: {id: 'summarize', parent: 'root', command: '/summarize', children: []},
    })
    chatSpy()
    jest.spyOn(SummarizeCommand.prototype, 'run').mockRejectedValue(new Error('summarize failed'))

    await expect(runCommand({queryType: 'chat', cell: store.getNode('root'), store})).resolves.toBeUndefined()
  })

  it('preserves summarize → memorize → validate ordering', async () => {
    const store = buildStore({
      root: {id: 'root', command: '/chat do task', children: ['validate', 'memorize', 'summarize']},
      summarize: {id: 'summarize', parent: 'root', command: '/summarize', children: []},
      memorize: {id: 'memorize', parent: 'root', command: '/memorize', children: []},
      validate: validateNode('validate', 'root', '/validate criterion'),
    })
    const order = []
    chatSpy()
    jest.spyOn(SummarizeCommand.prototype, 'run').mockImplementation(async () => order.push('summarize'))
    dispatchMemorize.mockImplementation(async () => order.push('memorize'))
    jest
      .spyOn(ValidateCommand.prototype, 'run')
      .mockImplementation(async () => (order.push('validate'), {passed: true, criterion: 'criterion', reason: ''}))

    await runCommand({queryType: 'chat', cell: store.getNode('root'), store})

    expect(order).toEqual(['summarize', 'memorize', 'validate'])
  })

  it('still evaluates validate when an unrecognized sibling is present', async () => {
    const store = buildStore({
      root: {id: 'root', command: '/chat do task', children: ['unknown', 'validate']},
      unknown: {id: 'unknown', parent: 'root', command: '/not-a-command', children: []},
      validate: validateNode('validate', 'root', '/validate criterion'),
    })
    chatSpy()
    const validator = jest
      .spyOn(ValidateCommand.prototype, 'run')
      .mockResolvedValue({passed: true, criterion: 'criterion', reason: ''})

    await runCommand({queryType: 'chat', cell: store.getNode('root'), store})

    expect(validator).toHaveBeenCalledTimes(1)
    expect(store.getNode('validate').title).toBe('/validate criterion [✓]')
  })
})
