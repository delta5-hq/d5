import {ValidateCommand} from './ValidateCommand'
import Store from '../../commands/utils/Store'

jest.mock('debug', () => {
  const fn = jest.fn(() => fn)
  fn.extend = jest.fn(() => fn)
  return fn
})

jest.mock('../../commands/utils/langchain/getLLM', () => ({
  getIntegrationSettings: jest.fn().mockResolvedValue({openai: {apiKey: 'test-key'}}),
  determineLLMType: jest.fn().mockReturnValue('openai'),
  getLLM: jest.fn(),
}))

import {getLLM} from '../../commands/utils/langchain/getLLM'

const buildStore = nodes => new Store({userId: 'user1', nodes})

describe('ValidateCommand — post-processed summary target', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('validates materialized /summarize output instead of raw parent prompt output', async () => {
    const invoke = jest.fn().mockResolvedValue({content: 'YES'})
    getLLM.mockReturnValue({llm: {invoke}})

    const store = buildStore({
      parent: {
        id: 'parent',
        command: '/chat write an answer',
        children: ['raw-output', 'summary-command', 'validate'],
        prompts: ['raw-output'],
      },
      'raw-output': {
        id: 'raw-output',
        parent: 'parent',
        title: 'RAW CHAT OUTPUT: no launch date is present here',
        children: [],
      },
      'summary-command': {
        id: 'summary-command',
        parent: 'parent',
        command: '/summarize',
        children: ['summary-output'],
        prompts: ['summary-output'],
      },
      'summary-output': {
        id: 'summary-output',
        parent: 'summary-command',
        title: 'POST-PROCESSED SUMMARY: launch date is 2026-07-07',
        children: [],
      },
      validate: {
        id: 'validate',
        parent: 'parent',
        command: '/validate must include a launch date',
        children: [],
      },
    })

    const result = await new ValidateCommand('user1', null, store).run(store.getNode('validate'))

    expect(result.passed).toBe(true)
    const userMessage = invoke.mock.calls[0][0][1].content
    expect(userMessage).toContain('POST-PROCESSED SUMMARY: launch date is 2026-07-07')
    expect(userMessage).not.toContain('RAW CHAT OUTPUT')
  })

  it('validate under /refine (inside a fork) reads content from the chat grandparent when refine has no prompts yet', async () => {
    const invoke = jest.fn().mockResolvedValue({content: 'YES'})
    getLLM.mockReturnValue({llm: {invoke}})

    const store = buildStore({
      chat: {
        id: 'chat',
        command: '/chat write something',
        children: ['chat-output', 'refine'],
        prompts: ['chat-output'],
      },
      'chat-output': {
        id: 'chat-output',
        parent: 'chat',
        title: 'The winning candidate answer',
        children: [],
      },
      refine: {
        id: 'refine',
        parent: 'chat',
        command: '/refine :n=3',
        children: ['validate'],
        prompts: [],
      },
      validate: {
        id: 'validate',
        parent: 'refine',
        command: '/validate must be compelling',
        children: [],
      },
    })

    const result = await new ValidateCommand('user1', null, store).run(store.getNode('validate'))

    expect(result.passed).toBe(true)
    const userMessage = invoke.mock.calls[0][0][1].content
    expect(userMessage).toContain('The winning candidate answer')
  })

  it("validate under /refine reads refine's own prompts when they exist (winner already applied)", async () => {
    const invoke = jest.fn().mockResolvedValue({content: 'YES'})
    getLLM.mockReturnValue({llm: {invoke}})

    const store = buildStore({
      chat: {
        id: 'chat',
        command: '/chat write something',
        children: ['chat-output', 'refine'],
        prompts: ['chat-output'],
      },
      'chat-output': {
        id: 'chat-output',
        parent: 'chat',
        title: 'STALE CHAT OUTPUT — should not appear',
        children: [],
      },
      refine: {
        id: 'refine',
        parent: 'chat',
        command: '/refine :n=3',
        children: ['validate', 'winner-copy'],
        prompts: ['winner-copy'],
      },
      'winner-copy': {
        id: 'winner-copy',
        parent: 'refine',
        title: 'WINNER OUTPUT — the refined answer',
        children: [],
      },
      validate: {
        id: 'validate',
        parent: 'refine',
        command: '/validate must be compelling',
        children: [],
      },
    })

    const result = await new ValidateCommand('user1', null, store).run(store.getNode('validate'))

    expect(result.passed).toBe(true)
    const userMessage = invoke.mock.calls[0][0][1].content
    expect(userMessage).toContain('WINNER OUTPUT — the refined answer')
    expect(userMessage).not.toContain('STALE CHAT OUTPUT')
  })

  it('falls back to parent output when no post-processed summary has materialized', async () => {
    const invoke = jest.fn().mockResolvedValue({content: 'YES'})
    getLLM.mockReturnValue({llm: {invoke}})

    const store = buildStore({
      parent: {
        id: 'parent',
        command: '/chat write an answer',
        children: ['raw-output', 'summary-command', 'validate'],
        prompts: ['raw-output'],
      },
      'raw-output': {
        id: 'raw-output',
        parent: 'parent',
        title: 'RAW CHAT OUTPUT: fallback content',
        children: [],
      },
      'summary-command': {
        id: 'summary-command',
        parent: 'parent',
        command: '/summarize',
        children: [],
      },
      validate: {
        id: 'validate',
        parent: 'parent',
        command: '/validate criterion',
        children: [],
      },
    })

    await new ValidateCommand('user1', null, store).run(store.getNode('validate'))

    const userMessage = invoke.mock.calls[0][0][1].content
    expect(userMessage).toContain('RAW CHAT OUTPUT: fallback content')
  })

  it('validates materialized /outline --summarize output instead of raw parent prompt output', async () => {
    const invoke = jest.fn().mockResolvedValue({content: 'YES'})
    getLLM.mockReturnValue({llm: {invoke}})

    const store = buildStore({
      parent: {
        id: 'parent',
        command: '/chat write an answer',
        children: ['raw-output', 'outline-command', 'validate'],
        prompts: ['raw-output'],
      },
      'raw-output': {
        id: 'raw-output',
        parent: 'parent',
        title: 'RAW CHAT OUTPUT: no competitors listed here',
        children: [],
      },
      'outline-command': {
        id: 'outline-command',
        parent: 'parent',
        command: '/outline --summarize',
        children: ['outline-output'],
        prompts: ['outline-output'],
      },
      'outline-output': {
        id: 'outline-output',
        parent: 'outline-command',
        title: 'OUTLINE SUMMARY: Acme 40%, Beta 35%, Gamma 25%',
        children: [],
      },
      validate: {
        id: 'validate',
        parent: 'parent',
        command: '/validate must list competitor names',
        children: [],
      },
    })

    const result = await new ValidateCommand('user1', null, store).run(store.getNode('validate'))

    expect(result.passed).toBe(true)
    const userMessage = invoke.mock.calls[0][0][1].content
    expect(userMessage).toContain('OUTLINE SUMMARY: Acme 40%, Beta 35%, Gamma 25%')
    expect(userMessage).not.toContain('RAW CHAT OUTPUT')
  })
})
