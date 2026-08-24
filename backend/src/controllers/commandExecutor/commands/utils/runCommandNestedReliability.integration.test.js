import {runCommand} from './runCommand'
import Store from './Store'
import {ChatCommand} from '../ChatCommand'
import {MCPFusionCommand} from '../MCPFusionCommand'
import {ForkJudge} from '../../reliability/core/ForkJudge'
import {ValidateCommand} from '../../reliability/core/ValidateCommand'

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

describe('nested commodity fan-out inside /elect', () => {
  afterEach(() => jest.restoreAllMocks())

  it('executes the commodity child once per real elect fork, never A×B, and persists both effective counts', async () => {
    const store = new Store({
      userId: 'user',
      nodes: {
        root: {id: 'root', command: '/chatgpt seed', children: ['elect']},
        elect: {id: 'elect', parent: 'root', command: '/elect :n=2', title: '/elect :n=2', children: ['draw']},
        draw: {id: 'draw', parent: 'elect', command: '/chatgpt :n=3 draw', title: '/chatgpt :n=3 draw', children: []},
      },
    })

    const executions = []
    jest.spyOn(ChatCommand.prototype, 'run').mockImplementation(async node => {
      executions.push(node.id)
    })
    jest.spyOn(ForkJudge.prototype, 'selectWinner').mockResolvedValue({
      winnerForkIndex: 0,
      perCriterionVerdict: [],
      mode: 'strict',
      selectionLayer: 'primary',
      noSignal: false,
      tiebreakUsed: false,
      judgeQualityWarnings: [],
    })

    await runCommand({queryType: 'chat', cell: store.getNode('root'), store})

    expect(executions.filter(id => id === 'draw')).toHaveLength(2)
    expect(executions.filter(id => id === 'draw')).not.toHaveLength(3 * 2)
    expect(store.getNode('elect').reliabilityMetadata.total).toBe(2)
    expect(store.getNode('draw').reliabilityMetadata).toMatchObject({
      mode: 'suppressed',
      cause: 'nested-reliability-fork',
      requestedN: 3,
      total: 1,
    })
  })
})

describe('nested /refine composition inside /elect', () => {
  afterEach(() => jest.restoreAllMocks())

  const buildTree = () =>
    new Store({
      userId: 'user',
      nodes: {
        root: {id: 'root', command: '/chatgpt seed', children: ['elect']},
        elect: {id: 'elect', parent: 'root', command: '/elect :n=2', title: '/elect :n=2', children: ['refine']},
        refine: {
          id: 'refine',
          parent: 'elect',
          command: '/refine :n=2',
          title: '/refine :n=2',
          children: ['validate'],
        },
        validate: {
          id: 'validate',
          parent: 'refine',
          command: '/validate criterion',
          title: '/validate criterion',
          children: [],
        },
      },
    })

  it('persists the selected nested refine verdict and its real early-pass count', async () => {
    const store = buildTree()
    const generator = jest.spyOn(ChatCommand.prototype, 'run').mockResolvedValue({})
    const validator = jest
      .spyOn(ValidateCommand.prototype, 'run')
      .mockResolvedValue({passed: true, criterion: 'criterion', reason: ''})
    jest.spyOn(ForkJudge.prototype, 'selectWinner').mockResolvedValue({
      winnerForkIndex: 0,
      perCriterionVerdict: [],
      mode: 'strict',
      selectionLayer: 'primary',
      noSignal: false,
      tiebreakUsed: false,
      judgeQualityWarnings: [],
    })

    await runCommand({queryType: 'chat', cell: store.getNode('root'), store})

    expect(generator).toHaveBeenCalledTimes(3)
    expect(validator).toHaveBeenCalledTimes(2)
    expect(store.getNode('elect').title).toBe('/elect :n=2 [✓ 2/2]')
    expect(store.getNode('refine')).toMatchObject({
      title: '/refine :n=2 [✓ 1×]',
      reliabilityMetadata: {mode: 'refine', attempts: 1, requestedN: 2},
    })
    expect(store.getNode('validate').title).toBe('/validate criterion [✓]')
  })

  it('persists the nested best diagnostic and exhaustion count when strict elect selects no winner', async () => {
    const store = buildTree()
    let draw = 0
    const generator = jest.spyOn(ChatCommand.prototype, 'run').mockImplementation(function createDraw(node) {
      draw++
      this.store.createNode({id: `draw-${draw}`, parent: node.id, title: `draw ${draw}`, children: []}, true)
    })
    const validator = jest
      .spyOn(ValidateCommand.prototype, 'run')
      .mockResolvedValue({passed: false, criterion: 'criterion', reason: 'missing'})

    await runCommand({queryType: 'chat', cell: store.getNode('root'), store})

    expect(generator).toHaveBeenCalledTimes(5)
    expect(validator).toHaveBeenCalledTimes(4)
    expect(store.getNode('elect').title).toBe('/elect :n=2 [✗ 0/2]')
    expect(store.getNode('refine')).toMatchObject({
      title: '/refine :n=2 [✗ 2×]',
      reliabilityMetadata: {mode: 'refine', attempts: 2, requestedN: 2},
    })
    expect(store.getNode('validate').title).toBe('/validate criterion [✗]')
    expect(store.getNode('root').prompts).toEqual(['draw-1'])
    expect((store.getNode('elect').prompts ?? []).map(id => store.getNode(id)?.title)).toEqual([
      expect.stringContaining('/elect :n=2'),
    ])
    expect((store.getNode('elect').prompts ?? []).map(id => store.getNode(id)?.title).join(' ')).not.toContain('draw')
    expect(Object.keys(store._nodes)).not.toEqual(expect.arrayContaining(['draw-2', 'draw-3', 'draw-4', 'draw-5']))
  })
})

describe('fusion child exactly once inside a real reliability fork', () => {
  afterEach(() => jest.restoreAllMocks())

  it('drives sentinel production and consumption so removing either half duplicates the fusion call', async () => {
    const store = new Store({
      userId: 'user',
      nodes: {
        root: {id: 'root', command: '/chatgpt seed', children: ['elect']},
        elect: {id: 'elect', parent: 'root', command: '/elect :n=2', title: '/elect :n=2', children: ['fusion']},
        fusion: {id: 'fusion', parent: 'elect', command: '/mcp use configured tools', children: []},
      },
    })
    const generator = jest.spyOn(ChatCommand.prototype, 'run').mockResolvedValue({})
    const fusion = jest.spyOn(MCPFusionCommand.prototype, 'run').mockResolvedValue({})
    jest.spyOn(ForkJudge.prototype, 'selectWinner').mockResolvedValue({
      winnerForkIndex: 0,
      perCriterionVerdict: [],
      mode: 'strict',
      selectionLayer: 'primary',
      noSignal: false,
      tiebreakUsed: false,
      judgeQualityWarnings: [],
    })

    await runCommand({queryType: 'chat', cell: store.getNode('root'), store})

    expect(generator).toHaveBeenCalledTimes(3)
    expect(fusion).toHaveBeenCalledTimes(1)
    expect(store.getNode('elect').reliabilityMetadata.total).toBe(2)
  })
})
