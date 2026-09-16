/**
 * P0.1 regression: a `/steps` sequencing term's /validate gate must judge the FORK's own sequenced
 * output, never the real ancestor's prior output. Unlike the sibling suite, ValidateCommand is NOT
 * stubbed here — the tests cross the real extractValidationContent path. Only the LLM transport
 * (getLLM) is mocked, so the juror's verdict is a deterministic function of the content it is asked
 * to judge. A marker present only on the ancestor, or only on the fork's steps, therefore proves
 * which text the gate actually read.
 */
import {runCommand} from './runCommand'
import Store from './Store'
import {ChatCommand} from '../ChatCommand'
import {ForkJudge} from '../../reliability/core/ForkJudge'

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

const MARKER = 'GOODMARKER'

// The juror answers YES only when the content it is handed contains the marker. The content is the
// HumanMessage body ValidateCommand builds from extractValidationContent's result.
jest.mock('./langchain/getLLM', () => ({
  ...jest.requireActual('./langchain/getLLM'),
  getIntegrationSettings: jest.fn(async () => ({})),
  determineLLMType: jest.fn(() => 'openai'),
  getLLM: jest.fn(() => ({
    llm: {
      invoke: jest.fn(async messages => {
        const judged = messages.map(m => m.content ?? '').join('\n')
        return {content: judged.includes('GOODMARKER') ? 'YES: contains marker' : 'NO: marker absent'}
      }),
    },
  })),
}))

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

// Generation output is decided per fork store: `markedStores` receives the marker, everything else
// does not. Assigning by first-seen store lets a test give exactly one fork passing step output
// regardless of the parallel forks' completion order.
const spyGeneratorPerFork = ({markFirstStoreOnly = false, markAll = false} = {}) => {
  const marked = new Map()
  let seen = 0
  return jest.spyOn(ChatCommand.prototype, 'run').mockImplementation(async function generate(node) {
    if (!marked.has(this.store)) {
      const isMarked = markAll || (markFirstStoreOnly && seen === 0)
      marked.set(this.store, isMarked)
      seen += 1
    }
    const body = marked.get(this.store) ? `${MARKER} step ${node.id}` : `plain step ${node.id}`
    const output = this.store.createNode({title: body, parent: node.id})
    this.store.addPromptsToNode(node.id, [output.id])
  })
}

const electUnderParent = ({parentOutput}) =>
  new Store({
    userId: 'user',
    nodes: {
      parent: {
        id: 'parent',
        parent: null,
        command: '/chatgpt',
        title: '/chatgpt',
        children: ['out', 'elect'],
        prompts: ['out'],
      },
      out: {id: 'out', parent: 'parent', title: parentOutput, children: []},
      elect: {
        id: 'elect',
        parent: 'parent',
        command: '/elect :n=2 /steps',
        title: '/elect :n=2 /steps',
        children: ['v', 's10', 's20'],
      },
      v: {
        id: 'v',
        parent: 'elect',
        command: '/validate includes the required token',
        title: '/validate includes the required token',
        children: [],
      },
      s10: {id: 's10', parent: 'elect', command: '#10 /chatgpt draft', title: '#10 /chatgpt draft', children: []},
      s20: {id: 's20', parent: 'elect', command: '#20 /chatgpt sharpen', title: '#20 /chatgpt sharpen', children: []},
    },
  })

describe('P0.1 — /steps gate judges the fork, not the ancestor', () => {
  afterEach(() => jest.restoreAllMocks())

  it('rejects every fork when the fork steps lack the marker, even though the ancestor output has it', async () => {
    // Ancestor output would PASS the criterion; the fork's step output would FAIL it. Reading the
    // ancestor (the old defect) would admit both forks; reading the fork rejects both.
    const store = electUnderParent({parentOutput: `${MARKER} lives on the ancestor`})
    spyGeneratorPerFork({markAll: false})
    spyFirstForkWins()

    await runCommand({queryType: 'elect', cell: store.getNode('elect'), store, memoMap: new Map()})

    const title = store.getNode('elect').title
    expect(title).toContain('[✗ 0/2]')
    expect(title).not.toContain('[✓')
  })

  it('admits the forks when the fork steps carry the marker, even though the ancestor output lacks it', async () => {
    const store = electUnderParent({parentOutput: 'ancestor output without the token'})
    spyGeneratorPerFork({markAll: true})
    spyFirstForkWins()

    await runCommand({queryType: 'elect', cell: store.getNode('elect'), store, memoMap: new Map()})

    expect(store.getNode('elect').title).toContain('[✓ 2/2]')
  })

  it('admits exactly one fork when only one fork produces passing step output', async () => {
    const store = electUnderParent({parentOutput: `${MARKER} on the ancestor is irrelevant`})
    spyGeneratorPerFork({markFirstStoreOnly: true})
    spyFirstForkWins()

    await runCommand({queryType: 'elect', cell: store.getNode('elect'), store, memoMap: new Map()})

    expect(store.getNode('elect').title).toContain('[✓ 1/2]')
  })
})
