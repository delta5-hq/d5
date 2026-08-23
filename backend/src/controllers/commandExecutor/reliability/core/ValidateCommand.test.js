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

const runValidation = async nodes => {
  const store = buildStore(nodes)
  const cmd = new ValidateCommand('user1', null, store)
  return cmd.run(store.getNode('v'))
}

beforeEach(() => {
  jest.clearAllMocks()
  getIntegrationSettings.mockResolvedValue({openai: {apiKey: 'test-key'}})
  determineLLMType.mockReturnValue('openai')
})

describe('ValidateCommand.run', () => {
  describe('target-content availability guards', () => {
    it.each([
      [
        'validate node has no parent field',
        {
          v: {
            id: 'v',
            command: '/validate must include numbers',
            children: [],
          },
        },
        'must include numbers',
      ],
      [
        'parent id does not resolve',
        {
          v: {
            id: 'v',
            parent: 'ghost',
            command: '/validate criterion',
            children: [],
          },
        },
        'criterion',
      ],
    ])('%s → failed without invoking extractor or LLM', async (_caseName, nodes, criterion) => {
      const result = await runValidation(nodes)
      expect(result).toEqual({
        passed: false,
        criterion,
        reason: 'parent cell is missing',
      })
      expect(NodeTextExtractor).not.toHaveBeenCalled()
      expect(getLLM).not.toHaveBeenCalled()
    })

    it.each([
      ['empty string', ''],
      ['spaces only', '   '],
      ['tabs and newlines only', '\n\t  \n'],
    ])('parent content is %s → failed without invoking LLM', async (_caseName, content) => {
      setupExtractor(content)
      const result = await runValidation({
        parent: {id: 'parent', command: '/chat', children: ['v']},
        v: {
          id: 'v',
          parent: 'parent',
          command: '/validate criterion',
          children: [],
        },
      })
      expect(result).toEqual({
        passed: false,
        criterion: 'criterion',
        reason: 'parent output is empty',
      })
      expect(NodeTextExtractor).toHaveBeenCalledTimes(1)
      expect(getLLM).not.toHaveBeenCalled()
    })
  })

  describe('single juror (default :n=1)', () => {
    it('YES response → {passed: true}', async () => {
      const store = buildStore({
        parent: {id: 'parent', command: '/chat', children: ['v']},
        v: {
          id: 'v',
          parent: 'parent',
          command: '/validate must include numbers',
          children: [],
        },
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
        v: {
          id: 'v',
          parent: 'parent',
          command: '/validate must include numbers',
          children: [],
        },
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
        v: {
          id: 'v',
          parent: 'parent',
          command: '/validate :n=3 criterion',
          children: [],
        },
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
        v: {
          id: 'v',
          parent: 'parent',
          command: '/validate :n=3 criterion',
          children: [],
        },
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
        v: {
          id: 'v',
          parent: 'parent',
          command: '/validate :n=3 criterion',
          children: [],
        },
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
        v: {
          id: 'v',
          parent: 'parent',
          command: '/validate :n=1 criterion',
          children: [],
        },
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
        v: {
          id: 'v',
          parent: 'parent',
          command: '/validate must mention competitors',
          children: [],
        },
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
        v: {
          id: 'v',
          parent: 'parent',
          command: '/validate :n=2 :retry=1 must cite sources',
          children: [],
        },
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
        v: {
          id: 'v',
          parent: 'parent',
          command: '/validate criterion',
          children: [],
        },
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
        v: {
          id: 'v',
          parent: 'parent',
          command: '/validate criterion',
          children: [],
        },
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
        v: {
          id: 'v',
          parent: 'parent',
          command: '/validate criterion',
          children: [],
        },
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
        v: {
          id: 'v',
          parent: 'parent',
          command: '/validate criterion',
          children: [],
        },
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
        v: {
          id: 'v',
          parent: 'parent',
          command: '/validate criterion',
          children: [],
        },
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
        v: {
          id: 'v',
          parent: 'parent',
          command: '/validate criterion',
          children: [],
        },
      })
      const ac = new AbortController()
      const mockLlm = setupLLM(['YES'])
      setupExtractor('content')
      const cmd = new ValidateCommand('user1', null, store)
      await cmd.run(store.getNode('v'), {signal: ac.signal})
      expect(mockLlm.invoke).toHaveBeenCalledWith(expect.anything(), {
        signal: ac.signal,
      })
    })

    it('passes undefined options to llm.invoke when signal is absent', async () => {
      const store = buildStore({
        parent: {id: 'parent', command: '/chat', children: ['v']},
        v: {
          id: 'v',
          parent: 'parent',
          command: '/validate criterion',
          children: [],
        },
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
        v: {
          id: 'v',
          parent: 'parent',
          command: '/validate criterion',
          children: [],
        },
      })
      getLLM.mockReturnValue({
        llm: {
          invoke: jest.fn().mockRejectedValue(new Error('network timeout')),
        },
      })
      setupExtractor('some content')
      const cmd = new ValidateCommand('user1', null, store)
      const result = await cmd.run(store.getNode('v'))
      expect(result.passed).toBe(false)
      expect(result.reason).toBe('all jurors failed')
    })

    it(':n=3, one juror crashes → surviving two form quorum; YES+YES → passed', async () => {
      const store = buildStore({
        parent: {id: 'parent', command: '/chat', children: ['v']},
        v: {
          id: 'v',
          parent: 'parent',
          command: '/validate :n=3 criterion',
          children: [],
        },
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
        v: {
          id: 'v',
          parent: 'parent',
          command: '/validate :n=3 criterion',
          children: [],
        },
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
        v: {
          id: 'v',
          parent: 'parent',
          command: '/validate :n=3 criterion',
          children: [],
        },
      })
      getLLM.mockReturnValue({
        llm: {
          invoke: jest.fn().mockRejectedValue(new Error('provider down')),
        },
      })
      setupExtractor('some content')
      const cmd = new ValidateCommand('user1', null, store)
      const result = await cmd.run(store.getNode('v'))
      expect(result.passed).toBe(false)
      expect(result.reason).toBe('all jurors failed')
    })

    it(':n=3, two jurors crash → single survivor decides; NO → failed', async () => {
      const store = buildStore({
        parent: {id: 'parent', command: '/chat', children: ['v']},
        v: {
          id: 'v',
          parent: 'parent',
          command: '/validate :n=3 criterion',
          children: [],
        },
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
        v: {
          id: 'v',
          parent: 'parent',
          command: '/validate must cite sources',
          children: [],
        },
      })
      getLLM.mockReturnValue({
        llm: {invoke: jest.fn().mockRejectedValue(new Error('error'))},
      })
      setupExtractor('content')
      const cmd = new ValidateCommand('user1', null, store)
      const result = await cmd.run(store.getNode('v'))
      expect(result.passed).toBe(false)
      expect(result.criterion).toBe('must cite sources')
    })

    it('all N juror calls are fired in parallel regardless of partial failures', async () => {
      const store = buildStore({
        parent: {id: 'parent', command: '/chat', children: ['v']},
        v: {
          id: 'v',
          parent: 'parent',
          command: '/validate :n=4 criterion',
          children: [],
        },
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
        v: {
          id: 'v',
          parent: 'parent',
          command: '/validate criterion',
          children: [],
        },
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

describe('elect-local validation content', () => {
  it("when validate parent is /elect with no prompts, walks up to /elect's parent for content", async () => {
    const store = buildStore({
      grandparent: {
        id: 'grandparent',
        command: '/chat do task',
        children: ['elect'],
      },
      elect: {
        id: 'elect',
        parent: 'grandparent',
        command: '/elect :n=2',
        children: ['v'],
      },
      v: {
        id: 'v',
        parent: 'elect',
        command: '/validate must include numbers',
        children: [],
      },
    })
    setupLLM(['YES'])
    let capturedNode
    NodeTextExtractor.mockImplementation(() => ({
      extractFullContent: jest.fn().mockImplementation(node => {
        capturedNode = node
        return Promise.resolve('content with 42 numbers')
      }),
    }))

    const cmd = new ValidateCommand('user1', null, store)
    const result = await cmd.run(store.getNode('v'))

    expect(capturedNode).toBe(store.getNode('grandparent'))
    expect(result.passed).toBe(true)
  })

  it('fails when /elect itself yields no content', async () => {
    const store = buildStore({
      elect: {id: 'elect', command: '/elect :n=2', children: ['v']},
      v: {
        id: 'v',
        parent: 'elect',
        command: '/validate must include numbers',
        children: [],
      },
    })
    setupLLM(['NO: missing'])
    setupExtractor('')

    const cmd = new ValidateCommand('user1', null, store)
    const result = await cmd.run(store.getNode('v'))
    expect(result).toEqual({
      passed: false,
      criterion: 'must include numbers',
      reason: 'parent output is empty',
    })
  })

  it('falls through to extractor when /elect has no prompts and grandparent yields empty content', async () => {
    const store = buildStore({
      grandparent: {
        id: 'grandparent',
        command: '/chat do task',
        children: ['elect'],
        prompts: [],
      },
      elect: {
        id: 'elect',
        parent: 'grandparent',
        command: '/elect :n=2',
        children: ['v'],
        prompts: [],
      },
      v: {
        id: 'v',
        parent: 'elect',
        command: '/validate must include numbers',
        children: [],
      },
    })
    setupLLM(['NO: missing'])
    NodeTextExtractor.mockImplementation(() => ({
      extractFullContent: jest.fn().mockResolvedValue(''),
    }))

    const cmd = new ValidateCommand('user1', null, store)
    const result = await cmd.run(store.getNode('v'))

    expect(result).toEqual({
      passed: false,
      criterion: 'must include numbers',
      reason: 'parent output is empty',
    })
  })

  it('when /elect prompts array has a stale id (node absent from store), falls through to grandparent content', async () => {
    const store = buildStore({
      grandparent: {
        id: 'grandparent',
        command: '/chat do task',
        children: ['elect'],
        prompts: ['grandparent-output'],
      },
      'grandparent-output': {
        id: 'grandparent-output',
        parent: 'grandparent',
        title: 'grandparent content with numbers: 42',
        children: [],
      },
      elect: {
        id: 'elect',
        parent: 'grandparent',
        command: '/elect :n=2',
        children: ['v'],
        prompts: ['dangling-id'], // stale: node does not exist in store
      },
      v: {
        id: 'v',
        parent: 'elect',
        command: '/validate must include numbers',
        children: [],
      },
    })
    setupLLM(['YES'])
    NodeTextExtractor.mockImplementation(() => ({
      extractFullContent: jest.fn().mockImplementation(node => Promise.resolve(node.title ?? '')),
    }))

    const cmd = new ValidateCommand('user1', null, store)
    const result = await cmd.run(store.getNode('v'))

    // Stale prompt ID does not resolve in store → hasMaterializedPromptOutput returns false
    // → falls through to grandparent → receives "grandparent content with numbers: 42"
    // → juror passes the "must include numbers" criterion
    expect(result.passed).toBe(true)
  })

  it('normal topology (validate parent is /chat, not /elect) is unaffected', async () => {
    const store = buildStore({
      chat: {id: 'chat', command: '/chat do task', children: ['v']},
      v: {
        id: 'v',
        parent: 'chat',
        command: '/validate must include numbers',
        children: [],
      },
    })
    setupLLM(['YES'])
    let capturedNode
    NodeTextExtractor.mockImplementation(() => ({
      extractFullContent: jest.fn().mockImplementation(node => {
        capturedNode = node
        return Promise.resolve('content with 42 numbers')
      }),
    }))

    const cmd = new ValidateCommand('user1', null, store)
    await cmd.run(store.getNode('v'))

    expect(capturedNode).toBe(store.getNode('chat'))
  })

  it('when validate parent is /elect with materialized prompts, validates the winner prompt node — does not walk up to grandparent', async () => {
    const store = buildStore({
      grandparent: {
        id: 'grandparent',
        command: '/chat do task',
        children: ['elect'],
        prompts: ['grandparent-output'],
      },
      'grandparent-output': {
        id: 'grandparent-output',
        parent: 'grandparent',
        title: 'grandparent output — must NOT be used',
        children: [],
      },
      elect: {
        id: 'elect',
        parent: 'grandparent',
        command: '/elect :n=2',
        children: ['v'],
        prompts: ['elect-winner'],
      },
      'elect-winner': {
        id: 'elect-winner',
        parent: 'elect',
        title: 'elect winner content with 42 numbers',
        children: [],
      },
      v: {
        id: 'v',
        parent: 'elect',
        command: '/validate must include numbers',
        children: [],
      },
    })
    setupLLM(['YES'])
    const capturedNodes = []
    NodeTextExtractor.mockImplementation(() => ({
      extractFullContent: jest.fn().mockImplementation(node => {
        capturedNodes.push(node)
        return Promise.resolve(node.title ?? '')
      }),
    }))

    const cmd = new ValidateCommand('user1', null, store)
    const result = await cmd.run(store.getNode('v'))

    const visitedIds = capturedNodes.map(n => n.id)
    expect(visitedIds).toContain('elect-winner')
    expect(visitedIds).not.toContain('grandparent-output')
    expect(result.passed).toBe(true)
  })

  it('when validate parent is /elect with materialized prompts, a failing criterion discriminates against grandparent content', async () => {
    const store = buildStore({
      grandparent: {
        id: 'grandparent',
        command: '/chat do task',
        children: ['elect'],
        prompts: ['grandparent-output'],
      },
      'grandparent-output': {
        id: 'grandparent-output',
        parent: 'grandparent',
        title: 'grandparent content also has numbers: 42',
        children: [],
      },
      elect: {
        id: 'elect',
        parent: 'grandparent',
        command: '/elect :n=2',
        children: ['v'],
        prompts: ['elect-winner'],
      },
      'elect-winner': {
        id: 'elect-winner',
        parent: 'elect',
        title: 'elect winner output: no digits here',
        children: [],
      },
      v: {
        id: 'v',
        parent: 'elect',
        command: '/validate must include numbers',
        children: [],
      },
    })
    // grandparent content would pass (has "42"), elect's own output would not (no digits)
    // the verdict proves which content the judge received
    setupLLM(['NO: no numbers found'])
    NodeTextExtractor.mockImplementation(() => ({
      extractFullContent: jest.fn().mockImplementation(node => Promise.resolve(node.title ?? '')),
    }))

    const cmd = new ValidateCommand('user1', null, store)
    const result = await cmd.run(store.getNode('v'))

    expect(result.passed).toBe(false)
  })
})

describe('nested /elect: /validate checks nearest-enclosing elect winner, not outer elect', () => {
  // Structure:
  //   outerElect (/elect :n=2)
  //     └── innerElect (/elect :n=2)
  //           ├── innerWinner  ← the content /validate must check
  //           └── v (/validate)
  //   outerWinner ← outer elect's winner; must NOT be used by v
  //
  // Criterion: "must contain INNER" passes for innerWinner, fails for outerWinner.
  // If the walk-up logic mistakenly escapes to outerElect's prompts, the test sees outerWinner's
  // content and the juror response doesn't match — a discriminating failure.

  it('passes on inner-elect winner content and would fail on outer-elect content', async () => {
    const store = buildStore({
      outerElect: {
        id: 'outerElect',
        command: '/elect :n=2',
        children: ['innerElect'],
        prompts: ['outerWinner'],
        parent: null,
      },
      outerWinner: {
        id: 'outerWinner',
        parent: 'outerElect',
        title: 'outer elect winner: OUTER content only',
        children: [],
      },
      innerElect: {
        id: 'innerElect',
        parent: 'outerElect',
        command: '/elect :n=2',
        children: ['v'],
        prompts: ['innerWinner'],
      },
      innerWinner: {
        id: 'innerWinner',
        parent: 'innerElect',
        title: 'inner elect winner: INNER content',
        children: [],
      },
      v: {
        id: 'v',
        parent: 'innerElect',
        command: '/validate must contain INNER',
        children: [],
      },
    })

    setupLLM(['YES'])
    NodeTextExtractor.mockImplementation(() => ({
      extractFullContent: jest.fn().mockImplementation(node => Promise.resolve(node.title ?? '')),
    }))

    const cmd = new ValidateCommand('user1', null, store)
    const result = await cmd.run(store.getNode('v'))

    // Passes because innerWinner's title contains "INNER".
    // Would fail if the outer winner ("OUTER content only") were used instead.
    expect(result.passed).toBe(true)
  })

  it('fails when inner-elect winner does not satisfy the criterion, even if outer winner would pass', async () => {
    const store = buildStore({
      outerElect: {
        id: 'outerElect',
        command: '/elect :n=2',
        children: ['innerElect'],
        prompts: ['outerWinner'],
        parent: null,
      },
      outerWinner: {
        id: 'outerWinner',
        parent: 'outerElect',
        title: 'outer winner has INNER too — must not mislead the validate',
        children: [],
      },
      innerElect: {
        id: 'innerElect',
        parent: 'outerElect',
        command: '/elect :n=2',
        children: ['v'],
        prompts: ['innerWinner'],
      },
      innerWinner: {
        id: 'innerWinner',
        parent: 'innerElect',
        title: 'inner winner: only OUTER keyword here',
        children: [],
      },
      v: {
        id: 'v',
        parent: 'innerElect',
        command: '/validate must contain INNER',
        children: [],
      },
    })

    setupLLM(['NO: keyword INNER not found'])
    NodeTextExtractor.mockImplementation(() => ({
      extractFullContent: jest.fn().mockImplementation(node => Promise.resolve(node.title ?? '')),
    }))

    const cmd = new ValidateCommand('user1', null, store)
    const result = await cmd.run(store.getNode('v'))

    // Fails because innerWinner's title does NOT contain "INNER".
    // The outer winner's title does — proving the test would give a false PASS
    // if the outer elect's content were used. This discriminates the two paths.
    expect(result.passed).toBe(false)
  })
})
