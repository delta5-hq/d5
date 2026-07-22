import {BaseChatModel} from '@langchain/core/language_models/chat_models'
import {ChatCommand} from './ChatCommand'
import {SwitchCommand} from './SwitchCommand'
import {runCommand} from './utils/runCommand'
import {YandexCommand} from './YandexCommand'
import {substituteReferencesAndHashrefsChildrenAndSelf} from './references/substitution'

jest.mock('./references/utils/referencePatterns', () => ({
  referencePatterns: {
    withAssignmentPrefix: jest.fn(() => ({
      test: jest.fn(),
    })),
  },
}))

// Mock the entire constants module before importing actual constants
jest.mock('../constants/steps', () => ({
  clearStepsPrefix: jest.fn(str => {
    if (str.startsWith('/case ')) {
      return str.substring('/case '.length)
    }
    return `cleared ${str}`
  }),
}))
jest.mock('../constants', () => {
  const originalModule = jest.requireActual('../constants')
  return {
    ...originalModule,
    // Make clearStepsPrefix remove the command prefix for case options
    refRegExp: {test: jest.fn()},
    readLangParam: jest.fn().mockReturnValue('en'),
  }
})

import {clearStepsPrefix} from '../constants/steps'
import {referencePatterns} from './references/utils/referencePatterns'
import {getIntegrationSettings} from './utils/langchain/getLLM'
import Store from './utils/Store'

jest.mock('./references/substitution')
jest.mock('./ChatCommand')
jest.mock('./YandexCommand')
jest.mock('./utils/runCommand')
jest.mock('./utils/langchain/getLLM', () => ({
  ...jest.requireActual('./utils/langchain/getLLM'),
  getIntegrationSettings: jest.fn(),
}))

describe('SwitchCommand', () => {
  const userId = 'userId'
  const workflowId = 'workflowId'
  const mockStore = new Store({
    userId,
    workflowId,
    nodes: {},
  })
  const command = new SwitchCommand(userId, workflowId, mockStore)

  const baseLLM = {
    invoke: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    substituteReferencesAndHashrefsChildrenAndSelf.mockReturnValue('substituted prompt')
    jest.spyOn(command, 'executeSwitch').mockResolvedValue('case value')
    jest.spyOn(command, 'processPromptAndExecuteCase').mockResolvedValue([{id: 'newNode'}])

    ChatCommand.prototype.replyChatOpenAIAPI = jest.fn().mockResolvedValue('OpenAI response')
    YandexCommand.prototype.replyYandex = jest.fn().mockResolvedValue('Yandex response')
  })

  describe('getCaseOptions', () => {
    it('should return two options', () => {
      const option1 = {id: 'o1', command: '/case option1'}
      const option2 = {id: 'o2', command: '/case option2'}
      const node = {id: 'n', children: [option1.id, option2.id]}

      mockStore._nodes = {
        [option1.id]: option1,
        [option2.id]: option2,
        [node.id]: node,
      }

      const options = command.getCaseOptions(node)

      expect(Object.keys(options).length).toBe(2)
      expect(options.option1).toEqual(option1)
      expect(options.option2).toEqual(option2)
    })

    it('should return ignore nodes without case query', () => {
      const option1 = {id: 'o1', command: '/case option1'}
      const node1 = {id: 'n1', command: 'node1'}
      const node2 = {id: 'n1', command: 'node2'}
      const node = {id: 'n', children: [option1.id, node1.id, node2.id]}

      mockStore._nodes = {
        [option1.id]: option1,
        [node1.id]: node1,
        [node2.id]: node2,
        [node.id]: node,
      }

      const options = command.getCaseOptions(node)

      expect(Object.keys(options).length).toBe(1)
      expect(Object.keys(options)).toEqual(['option1'])
    })

    it('should use title if command property is undefined', () => {
      const option1 = {id: 'o1', title: '/case option1'}
      const node = {id: 'n', children: [option1.id]}

      mockStore._nodes = {
        [option1.id]: option1,
        [node.id]: node,
      }

      const options = command.getCaseOptions(node)

      expect(Object.keys(options).length).toBe(1)
    })
  })

  describe('getOptionsKeyFromExecutionResult', () => {
    it('lowercases the result', () => {
      expect(command.getOptionsKeyFromExecutionResult('Option1')).toBe('option1')
    })

    it('strips surrounding single quotes', () => {
      expect(command.getOptionsKeyFromExecutionResult("'option1'")).toBe('option1')
    })

    it('strips surrounding double quotes', () => {
      expect(command.getOptionsKeyFromExecutionResult('"Option1"')).toBe('option1')
    })

    it('strips surrounding backticks', () => {
      expect(command.getOptionsKeyFromExecutionResult('`option1`')).toBe('option1')
    })
  })

  describe('executeSwitch', () => {
    afterEach(() => {
      jest.clearAllMocks()
    })
    it('should return success response', async () => {
      const userPrompt = 'user'
      const sysPrompt = 'system'

      jest.spyOn(command, 'executeSwitch').mockRestore()
      baseLLM.invoke.mockResolvedValue({content: 'content'})

      const result = await command.executeSwitch(userPrompt, sysPrompt, baseLLM)

      expect(baseLLM.invoke).toHaveBeenCalled()
      expect(result).toBe('content')
    })

    it('should return empty string and log error on rate limit errors from LLM', async () => {
      jest.spyOn(command, 'executeSwitch').mockRestore()

      const mockLLM = {
        invoke: jest.fn().mockRejectedValue(new Error('Rate limit exceeded')),
      }

      const result = await command.executeSwitch('user', 'system', mockLLM)
      expect(result).toBe('')
    })

    it('should return empty string and log error on network errors from LLM', async () => {
      jest.spyOn(command, 'executeSwitch').mockRestore()

      const mockLLM = {
        invoke: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      }

      const result = await command.executeSwitch('user', 'system', mockLLM)
      expect(result).toBe('')
    })

    it('should return empty string and log error on authentication errors from LLM', async () => {
      jest.spyOn(command, 'executeSwitch').mockRestore()

      const mockLLM = {
        invoke: jest.fn().mockRejectedValue(new Error('Invalid API key')),
      }

      const result = await command.executeSwitch('user', 'system', mockLLM)
      expect(result).toBe('')
    })
  })

  describe('processPromptAndExecuteCase', () => {
    beforeEach(() => {
      jest.clearAllMocks()
    })

    it('should throw when node has no /case children', async () => {
      jest.spyOn(command, 'processPromptAndExecuteCase').mockRestore()
      const child = {id: 'c', command: '/chatgpt prompt'}
      const node = {id: 'n', command: '/switch query', children: [child.id]}
      mockStore._nodes = {[child.id]: child, [node.id]: node}

      await expect(command.processPromptAndExecuteCase(node, 'prompt')).rejects.toThrow(
        '/switch requires child nodes prefixed with /case to define branches',
      )
    })

    it('should throw when node has no children at all', async () => {
      jest.spyOn(command, 'processPromptAndExecuteCase').mockRestore()
      const node = {id: 'n', command: '/switch query', children: []}
      mockStore._nodes = {[node.id]: node}

      await expect(command.processPromptAndExecuteCase(node, 'prompt')).rejects.toThrow(
        '/switch requires child nodes prefixed with /case to define branches',
      )
    })

    it('should execute first option child node', async () => {
      const chatCommand1 = {id: 'c', command: '/chatgpt prompt1'}
      const option1 = {id: 'o1', command: '/case option1', children: [chatCommand1.id]}
      const chatCommand2 = {id: 'c2', command: '/chatgpt prompt2'}
      const option2 = {id: 'o2', command: '/case option2', children: [chatCommand2.id]}
      const node = {id: 'n', command: '/switch query', children: [option1.id, option2.id]}

      mockStore._nodes = {
        [chatCommand1.id]: chatCommand1,
        [chatCommand2.id]: chatCommand2,
        [option1.id]: option1,
        [option2.id]: option2,
        [node.id]: node,
      }

      jest.spyOn(command, 'executeSwitch').mockResolvedValue('option1')
      const callSpy = jest.spyOn(BaseChatModel.prototype, 'invoke').mockResolvedValue({content: 'result'})
      getIntegrationSettings.mockResolvedValue({model: 'OpenAI', openai: {apiKey: 'apiKey', model: 'modelName'}})
      runCommand.mockReturnValue({nodes: []})
      jest.spyOn(command, 'processPromptAndExecuteCase').mockRestore()

      await command.processPromptAndExecuteCase(node, 'prompt')

      expect(runCommand).toHaveBeenCalled()
      callSpy.mockRestore()
    })

    it('should not execute when LLM response does not match any case option', async () => {
      jest.spyOn(command, 'processPromptAndExecuteCase').mockRestore()

      const chatCommand1 = {id: 'c1', command: '/chatgpt prompt1'}
      const option1 = {id: 'o1', command: '/case option1', children: [chatCommand1.id]}
      const chatCommand2 = {id: 'c2', command: '/chatgpt prompt2'}
      const option2 = {id: 'o2', command: '/case option2', children: [chatCommand2.id]}
      const node = {id: 'n', command: '/switch query', children: [option1.id, option2.id]}

      mockStore._nodes = {
        [chatCommand1.id]: chatCommand1,
        [chatCommand2.id]: chatCommand2,
        [option1.id]: option1,
        [option2.id]: option2,
        [node.id]: node,
      }

      jest.spyOn(command, 'executeSwitch').mockResolvedValue('unrecognized response')
      getIntegrationSettings.mockResolvedValue({model: 'OpenAI', openai: {apiKey: 'apiKey', model: 'modelName'}})

      await command.processPromptAndExecuteCase(node, 'prompt')

      expect(runCommand).not.toHaveBeenCalled()
    })

    it('should not execute when LLM produces no response', async () => {
      jest.spyOn(command, 'processPromptAndExecuteCase').mockRestore()

      const option1 = {id: 'o1', command: '/case option1', children: []}
      const node = {id: 'n', command: '/switch query', children: [option1.id]}

      mockStore._nodes = {[option1.id]: option1, [node.id]: node}

      jest.spyOn(command, 'executeSwitch').mockResolvedValue('')
      getIntegrationSettings.mockResolvedValue({model: 'OpenAI', openai: {apiKey: 'apiKey', model: 'modelName'}})

      await command.processPromptAndExecuteCase(node, 'prompt')

      expect(runCommand).not.toHaveBeenCalled()
    })

    describe('case-child error handling', () => {
      let child1, child2, option1, switchNode, createNodesSpy

      beforeEach(() => {
        jest.spyOn(command, 'processPromptAndExecuteCase').mockRestore()
        child1 = {id: 'c1', command: '/chatgpt prompt1'}
        child2 = {id: 'c2', command: '/chatgpt prompt2'}
        option1 = {id: 'o1', command: '/case option1', children: [child1.id, child2.id]}
        switchNode = {id: 'switch-n', command: '/switch query', children: [option1.id]}
        mockStore._nodes = {
          [child1.id]: child1,
          [child2.id]: child2,
          [option1.id]: option1,
          [switchNode.id]: switchNode,
        }
        jest.spyOn(command, 'executeSwitch').mockResolvedValue('option1')
        getIntegrationSettings.mockResolvedValue({model: 'OpenAI', openai: {apiKey: 'apiKey', model: 'modelName'}})
        createNodesSpy = jest.spyOn(mockStore.importer, 'createNodes').mockImplementation(() => {})
      })

      it('creates error node on the failing child node when a case-child command throws', async () => {
        runCommand.mockRejectedValueOnce(new Error('child1 failed')).mockResolvedValueOnce({nodes: []})

        await command.processPromptAndExecuteCase(switchNode, 'prompt')

        expect(createNodesSpy).toHaveBeenCalledWith('Error: child1 failed', child1.id)
      })

      it('continues executing remaining case-children after one fails', async () => {
        runCommand.mockRejectedValueOnce(new Error('child1 failed')).mockResolvedValueOnce({nodes: []})

        await command.processPromptAndExecuteCase(switchNode, 'prompt')

        expect(runCommand).toHaveBeenCalledTimes(2)
      })

      it('does not throw to caller when a case-child command throws', async () => {
        runCommand.mockRejectedValue(new Error('all children fail'))

        await expect(command.processPromptAndExecuteCase(switchNode, 'prompt')).resolves.toBeUndefined()
      })
    })
  })

  describe('run', () => {
    it('should use substituteReferencesAndHashrefsChildrenAndSelf when title contains a reference', async () => {
      referencePatterns.withAssignmentPrefix().test.mockReturnValue(true)

      const node = {id: 'node', title: '/switch prompt with @@reference'}

      await command.run(node, null)

      expect(substituteReferencesAndHashrefsChildrenAndSelf).toHaveBeenCalled()
      expect(clearStepsPrefix).not.toHaveBeenCalled()
    })

    it('should use substituteReferencesAndHashrefsChildrenAndSelf when prompt is falsy', async () => {
      const node = {id: 'node', title: '/switch prompt without reference'}

      await command.run(node, null)

      expect(substituteReferencesAndHashrefsChildrenAndSelf).toHaveBeenCalled()
      expect(clearStepsPrefix).not.toHaveBeenCalled()
    })

    it('should use clearStepsPrefix when prompt is provided and title has no reference', async () => {
      referencePatterns.withAssignmentPrefix().test.mockReturnValue(false)

      const node = {id: 'node', title: '/switch prompt without reference'}
      const originalPrompt = 'original prompt'

      await command.run(node, originalPrompt)

      expect(substituteReferencesAndHashrefsChildrenAndSelf).not.toHaveBeenCalled()
      expect(clearStepsPrefix).toHaveBeenCalledWith(originalPrompt)
    })

    it('should call processPromptAndExecuteCase and return nodes', async () => {
      const node = {id: 'node', title: '/switch what to do?'}

      await command.run(node, 'test prompt')

      expect(command.processPromptAndExecuteCase).toHaveBeenCalled()
    })
  })
})
