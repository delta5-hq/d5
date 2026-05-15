/**
 * Verifies the memoization guard in runCommand.postProcessNode that pre-resolves
 * inner /refine topology on the shared store before outer forks are created.
 * Each outer fork's memoMap copy inherits inner /refine's resolved id and skips
 * re-execution — producing additive (n+m) not multiplicative (n×m) fork cost.
 */
import {runCommand} from '../../commands/utils/runCommand'
import {ChatCommand} from '../../commands/ChatCommand'
import Store from '../../commands/utils/Store'
import {CHAT_QUERY_TYPE} from '../../constants/chat'
import NullProgress from './NullProgress'

jest.mock('debug', () => {
  const fn = jest.fn(() => fn)
  fn.extend = jest.fn(() => fn)
  return fn
})

jest.mock('../../commands/utils/langchain/getLLM', () => ({
  Model: {
    Claude: 'Claude',
    OpenAI: 'OpenAI',
    Deepseek: 'Deepseek',
    Qwen: 'Qwen',
    YandexGPT: 'YandexGPT',
    CustomLLM: 'CustomLLM',
  },
  getIntegrationSettings: jest.fn().mockResolvedValue({openai: {apiKey: 'test-key'}}),
  determineLLMType: jest.fn().mockReturnValue('OpenAI'),
  getLLM: jest.fn().mockReturnValue({
    llm: {invoke: jest.fn().mockResolvedValue({content: '1, 2, 3'})},
  }),
}))

const buildNestedTree = () =>
  new Store({
    userId: 'test-user',
    nodes: {
      root: {id: 'root', children: ['outerParent']},
      outerParent: {
        id: 'outerParent',
        parent: 'root',
        command: '/chat outer task',
        children: ['outerRefine'],
      },
      outerRefine: {
        id: 'outerRefine',
        parent: 'outerParent',
        command: '/refine :n=2',
        children: ['innerParent'],
      },
      innerParent: {
        id: 'innerParent',
        parent: 'outerRefine',
        command: '/chat inner task',
        children: ['innerRefine'],
      },
      innerRefine: {
        id: 'innerRefine',
        parent: 'innerParent',
        command: '/refine :n=3',
        children: [],
      },
    },
  })

describe('nested /refine — memoization guard enforces additive not multiplicative fork cost', () => {
  let chatRunSpy

  beforeEach(() => {
    chatRunSpy = jest.spyOn(ChatCommand.prototype, 'run').mockResolvedValue({})
  })

  afterEach(() => {
    chatRunSpy.mockRestore()
  })

  it('memoization guard: /refine :n=2 wrapping /refine :n=3 costs 1+3+2=6 leaf calls, not 2×(3+1)=8 or 2×3=6 multiplicative', async () => {
    const store = buildNestedTree()

    await runCommand(
      {
        queryType: CHAT_QUERY_TYPE,
        cell: store.getNode('outerParent'),
        store,
        signal: null,
      },
      new NullProgress(),
    )

    const calls = chatRunSpy.mock.calls
    const innerCalls = calls.filter(([cell]) => cell?.id === 'innerParent')
    const outerCalls = calls.filter(([cell]) => cell?.id === 'outerParent')

    expect(innerCalls).toHaveLength(3) // not 2×3=6: memoization skips inner re-execution per outer fork
    expect(outerCalls).toHaveLength(3) // 1 triggering call + 2 fork calls
    expect(calls).toHaveLength(6)
  })
})
