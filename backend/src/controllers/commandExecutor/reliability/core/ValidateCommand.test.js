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

jest.mock('../../commands/utils/NodeTextExtractor', () => ({
  NodeTextExtractor: jest.fn(),
}))

import {getIntegrationSettings, determineLLMType, getLLM} from '../../commands/utils/langchain/getLLM'
import {NodeTextExtractor} from '../../commands/utils/NodeTextExtractor'

const buildStore = nodeMap => new Store({userId: 'user1', nodes: nodeMap})

const makeMockLLM = responses => {
  let callIndex = 0
  return {
    invoke: jest.fn().mockImplementation(() => {
      const response = responses[callIndex % responses.length]
      callIndex++
      return Promise.resolve({content: response})
    }),
  }
}

const setupLLM = responses => {
  const mockLlm = makeMockLLM(responses)
  getLLM.mockReturnValue({llm: mockLlm})
  return mockLlm
}

const setupExtractor = content => {
  NodeTextExtractor.mockImplementation(() => ({
    extractFullContent: jest.fn().mockResolvedValue(content),
  }))
}

beforeEach(() => {
  jest.clearAllMocks()
  getIntegrationSettings.mockResolvedValue({openai: {apiKey: 'test-key'}})
  determineLLMType.mockReturnValue('openai')
})

describe('ValidateCommand.run', () => {
  describe('guard: no parent node → passes silently', () => {
    it('returns passed when validateNode has no parent field', async () => {
      const store = buildStore({
        v: {id: 'v', command: '/validate must include numbers', children: []},
      })
      setupLLM(['YES'])
      setupExtractor('')
      const cmd = new ValidateCommand('user1', null, store)
      const result = await cmd.run(store.getNode('v'))
      expect(result.passed).toBe(true)
    })

    it('returns passed when parent id does not resolve', async () => {
      const store = buildStore({
        v: {id: 'v', parent: 'ghost', command: '/validate criterion', children: []},
      })
      setupLLM(['YES'])
      setupExtractor('')
      const cmd = new ValidateCommand('user1', null, store)
      const result = await cmd.run(store.getNode('v'))
      expect(result.passed).toBe(true)
    })
  })

  describe('guard: empty parent content → passes silently', () => {
    it('returns passed when extractFullContent returns empty string', async () => {
      const store = buildStore({
        parent: {id: 'parent', command: '/chat', children: ['v']},
        v: {id: 'v', parent: 'parent', command: '/validate criterion', children: []},
      })
      setupLLM(['NO: missing'])
      setupExtractor('   ')
      const cmd = new ValidateCommand('user1', null, store)
      const result = await cmd.run(store.getNode('v'))
      expect(result.passed).toBe(true)
    })
  })

  describe('single juror (default :n=1)', () => {
    it('YES response → {passed: true}', async () => {
      const store = buildStore({
        parent: {id: 'parent', command: '/chat', children: ['v']},
        v: {id: 'v', parent: 'parent', command: '/validate must include numbers', children: []},
      })
      const mockLlm = setupLLM(['YES'])
      setupExtractor('The response contains 42 and other numbers.')
      const cmd = new ValidateCommand('user1', null, store)
      const result = await cmd.run(store.getNode('v'))
      expect(result.passed).toBe(true)
      expect(result.criterion).toBe('must include numbers')
      expect(mockLlm.invoke).toHaveBeenCalledTimes(1)
    })

    it('NO response → {passed: false, reason: ...}', async () => {
      const store = buildStore({
        parent: {id: 'parent', command: '/chat', children: ['v']},
        v: {id: 'v', parent: 'parent', command: '/validate must include numbers', children: []},
      })
      setupLLM(['NO: no numbers found in the content'])
      setupExtractor('The response has only words.')
      const cmd = new ValidateCommand('user1', null, store)
      const result = await cmd.run(store.getNode('v'))
      expect(result.passed).toBe(false)
      expect(result.reason).toBe('no numbers found in the content')
      expect(result.criterion).toBe('must include numbers')
    })
  })

  describe('multi-juror :n=N — unanimous YES required; any NO fails', () => {
    it(':n=3, all YES → passed', async () => {
      const store = buildStore({
        parent: {id: 'parent', command: '/chat', children: ['v']},
        v: {id: 'v', parent: 'parent', command: '/validate :n=3 criterion', children: []},
      })
      const mockLlm = setupLLM(['YES', 'YES', 'YES'])
      setupExtractor('good content')
      const cmd = new ValidateCommand('user1', null, store)
      const result = await cmd.run(store.getNode('v'))
      expect(result.passed).toBe(true)
      expect(mockLlm.invoke).toHaveBeenCalledTimes(3)
    })

    it(':n=3, all NO → failed', async () => {
      const store = buildStore({
        parent: {id: 'parent', command: '/chat', children: ['v']},
        v: {id: 'v', parent: 'parent', command: '/validate :n=3 criterion', children: []},
      })
      setupLLM(['NO: reason A', 'NO: reason B', 'NO: reason C'])
      setupExtractor('bad content')
      const cmd = new ValidateCommand('user1', null, store)
      const result = await cmd.run(store.getNode('v'))
      expect(result.passed).toBe(false)
      expect(result.reason).toBe('reason A')
    })

    it(':n=3, one NO → failed (first failure reported)', async () => {
      const store = buildStore({
        parent: {id: 'parent', command: '/chat', children: ['v']},
        v: {id: 'v', parent: 'parent', command: '/validate :n=3 criterion', children: []},
      })
      setupLLM(['YES', 'NO: missing detail', 'YES'])
      setupExtractor('some content')
      const cmd = new ValidateCommand('user1', null, store)
      const result = await cmd.run(store.getNode('v'))
      expect(result.passed).toBe(false)
      expect(result.reason).toBe('missing detail')
    })

    it(':n=1 fires exactly one juror call', async () => {
      const store = buildStore({
        parent: {id: 'parent', command: '/chat', children: ['v']},
        v: {id: 'v', parent: 'parent', command: '/validate :n=1 criterion', children: []},
      })
      const mockLlm = setupLLM(['YES'])
      setupExtractor('content')
      const cmd = new ValidateCommand('user1', null, store)
      await cmd.run(store.getNode('v'))
      expect(mockLlm.invoke).toHaveBeenCalledTimes(1)
    })
  })

  describe('criterion is extracted and exposed', () => {
    it('exposes criterion from validate command in result', async () => {
      const store = buildStore({
        parent: {id: 'parent', command: '/chat', children: ['v']},
        v: {id: 'v', parent: 'parent', command: '/validate must mention competitors', children: []},
      })
      setupLLM(['YES'])
      setupExtractor('We analyzed Acme, Globex, and Initech.')
      const cmd = new ValidateCommand('user1', null, store)
      const result = await cmd.run(store.getNode('v'))
      expect(result.criterion).toBe('must mention competitors')
    })

    it('criterion strips :n= and :retry= params', async () => {
      const store = buildStore({
        parent: {id: 'parent', command: '/chat', children: ['v']},
        v: {id: 'v', parent: 'parent', command: '/validate :n=2 :retry=1 must cite sources', children: []},
      })
      setupLLM(['YES', 'YES'])
      setupExtractor('Sources: [1] Smith 2023')
      const cmd = new ValidateCommand('user1', null, store)
      const result = await cmd.run(store.getNode('v'))
      expect(result.criterion).toBe('must cite sources')
    })
  })

  describe('YES response parsing variants', () => {
    it('lowercase "yes" is treated as pass', async () => {
      const store = buildStore({
        parent: {id: 'parent', command: '/chat', children: ['v']},
        v: {id: 'v', parent: 'parent', command: '/validate criterion', children: []},
      })
      setupLLM(['yes'])
      setupExtractor('content')
      const cmd = new ValidateCommand('user1', null, store)
      const result = await cmd.run(store.getNode('v'))
      expect(result.passed).toBe(true)
    })

    it('"YES" with trailing explanation text is treated as pass', async () => {
      const store = buildStore({
        parent: {id: 'parent', command: '/chat', children: ['v']},
        v: {id: 'v', parent: 'parent', command: '/validate criterion', children: []},
      })
      setupLLM(['YES this content satisfies the requirement'])
      setupExtractor('content')
      const cmd = new ValidateCommand('user1', null, store)
      const result = await cmd.run(store.getNode('v'))
      expect(result.passed).toBe(true)
    })
  })

  describe('NO response parsing variants', () => {
    it('"NO" with no colon or space → reason is the full response text', async () => {
      const store = buildStore({
        parent: {id: 'parent', command: '/chat', children: ['v']},
        v: {id: 'v', parent: 'parent', command: '/validate criterion', children: []},
      })
      setupLLM(['NO'])
      setupExtractor('content')
      const cmd = new ValidateCommand('user1', null, store)
      const result = await cmd.run(store.getNode('v'))
      expect(result.passed).toBe(false)
      expect(result.reason).toBe('NO')
    })

    it('"no:" with colon but empty reason → reason is empty string', async () => {
      const store = buildStore({
        parent: {id: 'parent', command: '/chat', children: ['v']},
        v: {id: 'v', parent: 'parent', command: '/validate criterion', children: []},
      })
      setupLLM(['no: '])
      setupExtractor('content')
      const cmd = new ValidateCommand('user1', null, store)
      const result = await cmd.run(store.getNode('v'))
      expect(result.passed).toBe(false)
      expect(result.reason).toBe('')
    })

    it('multi-line NO response: only first line treated as reason', async () => {
      const store = buildStore({
        parent: {id: 'parent', command: '/chat', children: ['v']},
        v: {id: 'v', parent: 'parent', command: '/validate criterion', children: []},
      })
      setupLLM(['NO: criterion not met\nAdditional context here'])
      setupExtractor('content')
      const cmd = new ValidateCommand('user1', null, store)
      const result = await cmd.run(store.getNode('v'))
      expect(result.passed).toBe(false)
      expect(result.reason).toContain('criterion not met')
    })
  })

  describe('signal forwarding to llm.invoke', () => {
    it('passes signal to llm.invoke when signal is provided', async () => {
      const store = buildStore({
        parent: {id: 'parent', command: '/chat', children: ['v']},
        v: {id: 'v', parent: 'parent', command: '/validate criterion', children: []},
      })
      const ac = new AbortController()
      const mockLlm = setupLLM(['YES'])
      setupExtractor('content')
      const cmd = new ValidateCommand('user1', null, store)
      await cmd.run(store.getNode('v'), {signal: ac.signal})
      expect(mockLlm.invoke).toHaveBeenCalledWith(expect.anything(), {signal: ac.signal})
    })

    it('passes undefined options to llm.invoke when signal is absent', async () => {
      const store = buildStore({
        parent: {id: 'parent', command: '/chat', children: ['v']},
        v: {id: 'v', parent: 'parent', command: '/validate criterion', children: []},
      })
      const mockLlm = setupLLM(['YES'])
      setupExtractor('content')
      const cmd = new ValidateCommand('user1', null, store)
      await cmd.run(store.getNode('v'))
      expect(mockLlm.invoke).toHaveBeenCalledWith(expect.anything(), undefined)
    })
  })

  describe('juror error → quorum excludes crashed jurors (fail-safe)', () => {
    it('single juror crashes → passed:false with all-jurors-failed reason', async () => {
      const store = buildStore({
        parent: {id: 'parent', command: '/chat', children: ['v']},
        v: {id: 'v', parent: 'parent', command: '/validate criterion', children: []},
      })
      getLLM.mockReturnValue({llm: {invoke: jest.fn().mockRejectedValue(new Error('network timeout'))}})
      setupExtractor('some content')
      const cmd = new ValidateCommand('user1', null, store)
      const result = await cmd.run(store.getNode('v'))
      expect(result.passed).toBe(false)
      expect(result.reason).toBe('all jurors failed')
    })

    it(':n=3, one juror crashes → surviving two form quorum; YES+YES → passed', async () => {
      const store = buildStore({
        parent: {id: 'parent', command: '/chat', children: ['v']},
        v: {id: 'v', parent: 'parent', command: '/validate :n=3 criterion', children: []},
      })
      let call = 0
      const partialErrorLlm = {
        invoke: jest.fn().mockImplementation(() => {
          call++
          if (call === 2) return Promise.reject(new Error('timeout'))
          return Promise.resolve({content: 'YES'})
        }),
      }
      getLLM.mockReturnValue({llm: partialErrorLlm})
      setupExtractor('good content')
      const cmd = new ValidateCommand('user1', null, store)
      const result = await cmd.run(store.getNode('v'))
      expect(result.passed).toBe(true)
      expect(partialErrorLlm.invoke).toHaveBeenCalledTimes(3)
    })

    it(':n=3, one juror crashes → surviving two form quorum; YES+NO → failed', async () => {
      const store = buildStore({
        parent: {id: 'parent', command: '/chat', children: ['v']},
        v: {id: 'v', parent: 'parent', command: '/validate :n=3 criterion', children: []},
      })
      let call = 0
      const partialErrorLlm = {
        invoke: jest.fn().mockImplementation(() => {
          call++
          if (call === 1) return Promise.resolve({content: 'YES'})
          if (call === 2) return Promise.reject(new Error('timeout'))
          return Promise.resolve({content: 'NO: missing detail'})
        }),
      }
      getLLM.mockReturnValue({llm: partialErrorLlm})
      setupExtractor('borderline content')
      const cmd = new ValidateCommand('user1', null, store)
      const result = await cmd.run(store.getNode('v'))
      expect(result.passed).toBe(false)
      expect(result.reason).toBe('missing detail')
    })

    it(':n=3, all jurors crash → passed:false with all-jurors-failed reason', async () => {
      const store = buildStore({
        parent: {id: 'parent', command: '/chat', children: ['v']},
        v: {id: 'v', parent: 'parent', command: '/validate :n=3 criterion', children: []},
      })
      getLLM.mockReturnValue({llm: {invoke: jest.fn().mockRejectedValue(new Error('provider down'))}})
      setupExtractor('some content')
      const cmd = new ValidateCommand('user1', null, store)
      const result = await cmd.run(store.getNode('v'))
      expect(result.passed).toBe(false)
      expect(result.reason).toBe('all jurors failed')
    })

    it(':n=3, two jurors crash → single survivor decides; NO → failed', async () => {
      const store = buildStore({
        parent: {id: 'parent', command: '/chat', children: ['v']},
        v: {id: 'v', parent: 'parent', command: '/validate :n=3 criterion', children: []},
      })
      let call = 0
      const twoErrorLlm = {
        invoke: jest.fn().mockImplementation(() => {
          call++
          if (call === 1) return Promise.reject(new Error('timeout'))
          if (call === 2) return Promise.resolve({content: 'NO: lone survivor says no'})
          return Promise.reject(new Error('timeout'))
        }),
      }
      getLLM.mockReturnValue({llm: twoErrorLlm})
      setupExtractor('borderline content')
      const cmd = new ValidateCommand('user1', null, store)
      const result = await cmd.run(store.getNode('v'))
      expect(result.passed).toBe(false)
      expect(result.reason).toBe('lone survivor says no')
    })

    it('all jurors crash → result.criterion is still populated', async () => {
      const store = buildStore({
        parent: {id: 'parent', command: '/chat', children: ['v']},
        v: {id: 'v', parent: 'parent', command: '/validate must cite sources', children: []},
      })
      getLLM.mockReturnValue({llm: {invoke: jest.fn().mockRejectedValue(new Error('error'))}})
      setupExtractor('content')
      const cmd = new ValidateCommand('user1', null, store)
      const result = await cmd.run(store.getNode('v'))
      expect(result.passed).toBe(false)
      expect(result.criterion).toBe('must cite sources')
    })

    it('all N juror calls are fired in parallel regardless of partial failures', async () => {
      const store = buildStore({
        parent: {id: 'parent', command: '/chat', children: ['v']},
        v: {id: 'v', parent: 'parent', command: '/validate :n=4 criterion', children: []},
      })
      const invokeMock = jest.fn().mockRejectedValue(new Error('timeout'))
      getLLM.mockReturnValue({llm: {invoke: invokeMock}})
      setupExtractor('content')
      const cmd = new ValidateCommand('user1', null, store)
      await cmd.run(store.getNode('v'))
      expect(invokeMock).toHaveBeenCalledTimes(4)
    })
  })

  describe('integration settings are forwarded to getLLM', () => {
    it('passes resolved settings to getLLM', async () => {
      const store = buildStore({
        parent: {id: 'parent', command: '/chat', children: ['v']},
        v: {id: 'v', parent: 'parent', command: '/validate criterion', children: []},
      })
      const fakeSettings = {claude: {apiKey: 'claude-key'}}
      getIntegrationSettings.mockResolvedValue(fakeSettings)
      setupLLM(['YES'])
      setupExtractor('content')
      const cmd = new ValidateCommand('user1', 'wf1', store)
      await cmd.run(store.getNode('v'))
      expect(getLLM).toHaveBeenCalledWith(expect.objectContaining({settings: fakeSettings}))
    })
  })
})
