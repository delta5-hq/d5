/**
 * `/steps` as a reliability-modifier term. StepsCommand owns the ordering in every case; the
 * modifier only decides how many times the subtree runs and which candidate wins. /elect forks the
 * whole subtree N times; /refine runs it in place and re-runs on validate failure. In both, an
 * assertion child (/validate) gates the scope value and is never sequenced as a step, and an #N
 * order prefix on the modifier itself is transparent to param parsing. SubtreeForkRunner and
 * StoreFork are NOT mocked here: the tests cross the real producer/consumer handoff and read real
 * execution counts. Only the leaf generator (ChatCommand), the judge (ForkJudge) and the juror
 * (ValidateCommand) are stubbed, so no LLM is called.
 */
import {runCommand} from './runCommand'
import Store from './Store'
import {ChatCommand} from '../ChatCommand'
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

const spyGenerator = executed =>
  jest.spyOn(ChatCommand.prototype, 'run').mockImplementation(async function generate(node) {
    executed.push(node.id)
    const output = this.store.createNode({title: `OUT-${node.id}`, parent: node.id})
    this.store.addPromptsToNode(node.id, [output.id])
  })

const spyFirstForkWins = () =>
  jest.spyOn(ForkJudge.prototype, 'selectWinner').mockResolvedValue({
    winnerForkIndex: 0,
    perCriterionVerdict: [],
    mode: 'strict',
    selectionLayer: 'primary',
    noSignal: false,
    tiebreakUsed: false,
    judgeQualityWarnings: [],
  })

const spyJurorPasses = () =>
  jest.spyOn(ValidateCommand.prototype, 'run').mockResolvedValue({passed: true, criterion: 'x', reason: ''})

const spyJurorFails = () =>
  jest.spyOn(ValidateCommand.prototype, 'run').mockResolvedValue({
    passed: false,
    criterion: 'at least 3 words',
    reason: 'too short',
  })

const errorTitles = store =>
  Object.values(store._nodes)
    .map(node => node.title || '')
    .filter(title => /error/i.test(title))

describe('/elect :n=N /steps — the sequencing term', () => {
  afterEach(() => jest.restoreAllMocks())

  const electStepsWithValidate = () =>
    new Store({
      userId: 'user',
      nodes: {
        elect: {
          id: 'elect',
          parent: null,
          command: '/elect :n=2 /steps',
          title: '/elect :n=2 /steps',
          children: ['v', 's10', 's20'],
        },
        v: {
          id: 'v',
          parent: 'elect',
          command: '/validate at least 3 words',
          title: '/validate at least 3 words',
          children: [],
        },
        s10: {id: 's10', parent: 'elect', command: '#10 /chatgpt draft', title: '#10 /chatgpt draft', children: []},
        s20: {id: 's20', parent: 'elect', command: '#20 /chatgpt sharpen', title: '#20 /chatgpt sharpen', children: []},
      },
    })

  it('runs the whole step subtree once per fork and admits the fork when its /validate passes', async () => {
    const store = electStepsWithValidate()
    const executed = []
    spyGenerator(executed)
    spyFirstForkWins()
    const juror = spyJurorPasses()

    await runCommand({queryType: 'elect', cell: store.getNode('elect'), store, memoMap: new Map()})

    expect(executed.filter(id => id === 's10')).toHaveLength(2)
    expect(executed.filter(id => id === 's20')).toHaveLength(2)
    expect(executed).not.toContain('v')
    // The gate must actually evaluate the assertion — a test that passes whether or not the
    // validator runs would be fake-green.
    expect(juror).toHaveBeenCalledTimes(2)
    expect(errorTitles(store)).toEqual([])
    expect(store.getNode('elect').title).toContain('[✓ 2/2]')
  })

  it('rejects every fork when its /validate fails, selecting no winner', async () => {
    const store = electStepsWithValidate()
    const executed = []
    spyGenerator(executed)
    const juror = spyJurorFails()

    await runCommand({queryType: 'elect', cell: store.getNode('elect'), store, memoMap: new Map()})

    expect(juror).toHaveBeenCalledTimes(2)
    expect(executed).not.toContain('v')
    const title = store.getNode('elect').title
    expect(title).toContain('[✗ 0/2]')
    expect(title).not.toContain('[✓')
  })

  it('compounds a nested /elect step: the inner election runs its real generation count per outer fork', async () => {
    const store = new Store({
      userId: 'user',
      nodes: {
        elect: {
          id: 'elect',
          parent: null,
          command: '/elect :n=2 /steps',
          title: '/elect :n=2 /steps',
          children: ['s10', 's20'],
        },
        s10: {id: 's10', parent: 'elect', command: '#10 /chatgpt draft', title: '#10 /chatgpt draft', children: []},
        s20: {
          id: 's20',
          parent: 'elect',
          command: '#20 /elect :n=3 /chatgpt sharpen',
          title: '#20 /elect :n=3 /chatgpt sharpen',
          children: [],
        },
      },
    })
    const executed = []
    spyGenerator(executed)
    spyFirstForkWins()

    await runCommand({queryType: 'elect', cell: store.getNode('elect'), store, memoMap: new Map()})

    expect(executed.filter(id => id === 's10')).toHaveLength(2)
    expect(executed.filter(id => id === 's20:term')).toHaveLength(6)
    expect(errorTitles(store)).toEqual([])
    expect(store.getNode('s20').title).toContain('[✓ 3/3]')
  })
})

describe('/refine :n=R /steps — the sequencing term', () => {
  afterEach(() => jest.restoreAllMocks())

  it('sequences the step subtree in place and gates /validate without executing it', async () => {
    const store = new Store({
      userId: 'user',
      nodes: {
        refine: {
          id: 'refine',
          parent: null,
          command: '/refine :n=2 /steps',
          title: '/refine :n=2 /steps',
          children: ['v', 's10', 's20'],
        },
        v: {
          id: 'v',
          parent: 'refine',
          command: '/validate at least 3 words',
          title: '/validate at least 3 words',
          children: [],
        },
        s10: {id: 's10', parent: 'refine', command: '#10 /chatgpt draft', title: '#10 /chatgpt draft', children: []},
        s20: {
          id: 's20',
          parent: 'refine',
          command: '#20 /chatgpt sharpen',
          title: '#20 /chatgpt sharpen',
          children: [],
        },
      },
    })
    const executed = []
    spyGenerator(executed)
    spyJurorPasses()

    await runCommand({queryType: 'refine', cell: store.getNode('refine'), store, memoMap: new Map()})

    expect(executed).toEqual(['s10', 's20'])
    expect(executed).not.toContain('v')
    expect(errorTitles(store)).toEqual([])
  })
})

describe('a modifier used as an #N step reads its params through the order prefix', () => {
  afterEach(() => jest.restoreAllMocks())

  it('runs a nested #N /refine step inside an /elect /steps term, once per outer fork', async () => {
    const store = new Store({
      userId: 'user',
      nodes: {
        elect: {
          id: 'elect',
          parent: null,
          command: '/elect :n=2 /steps',
          title: '/elect :n=2 /steps',
          children: ['s10', 's20'],
        },
        s10: {id: 's10', parent: 'elect', command: '#10 /chatgpt draft', title: '#10 /chatgpt draft', children: []},
        s20: {
          id: 's20',
          parent: 'elect',
          command: '#20 /refine :n=2 /chatgpt sharpen',
          title: '#20 /refine :n=2 /chatgpt sharpen',
          children: ['rv'],
        },
        rv: {
          id: 'rv',
          parent: 's20',
          command: '/validate at least 3 words',
          title: '/validate at least 3 words',
          children: [],
        },
      },
    })
    const executed = []
    spyGenerator(executed)
    spyFirstForkWins()
    spyJurorPasses()

    await runCommand({queryType: 'elect', cell: store.getNode('elect'), store, memoMap: new Map()})

    expect(executed.filter(id => id === 's10')).toHaveLength(2)
    expect(executed.filter(id => id === 's20')).toHaveLength(2)
    expect(errorTitles(store)).toEqual([])
  })
})
