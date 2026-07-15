import CommandFactory from './CommandFactory'
import Store from '../commands/utils/Store'
import {CHAT_QUERY_TYPE} from '../constants/chat'
import {CLAUDE_QUERY_TYPE} from '../constants/claude'
import {COMPLETION_QUERY_TYPE} from '../constants/completion'
import {CUSTOM_LLM_CHAT_QUERY_TYPE} from '../constants/custom_llm'
import {DEEPSEEK_QUERY_TYPE} from '../constants/deepseek'
import {DOWNLOAD_QUERY_TYPE} from '../constants/download'
import {EXT_QUERY_TYPE} from '../constants/ext'
import {FOREACH_QUERY_TYPE} from '../constants/foreach'
import {PERPLEXITY_QUERY_TYPE} from '../constants/perplexity'
import {QWEN_QUERY_TYPE} from '../constants/qwen'
import {REFINE_QUERY_TYPE} from '../constants/refine'
import {STEPS_QUERY_TYPE} from '../constants/steps'
import {SUMMARIZE_QUERY_TYPE} from '../constants/summarize'
import {VALIDATE_QUERY_TYPE} from '../constants/validate'
import {SWITCH_QUERY_TYPE} from '../constants/switch'
import {WEB_QUERY_TYPE} from '../constants/web'
import {YANDEX_QUERY_TYPE} from '../constants/yandex'
import {SCHOLAR_QUERY_TYPE} from '../constants/scholar'
import {OUTLINE_QUERY_TYPE} from '../constants/outline'
import {MEMORIZE_QUERY_TYPE} from '../constants/memorize'

jest.mock('debug', () => {
  const fn = jest.fn(() => fn)
  fn.extend = jest.fn(() => fn)
  return fn
})

describe('CommandFactory', () => {
  const commandModules = {
    [CHAT_QUERY_TYPE]: ['../commands/ChatCommand', 'ChatCommand'],
    [CLAUDE_QUERY_TYPE]: ['../commands/ClaudeCommand', 'ClaudeCommand'],
    [COMPLETION_QUERY_TYPE]: ['../commands/CompletionCommand', 'CompletionCommand'],
    [CUSTOM_LLM_CHAT_QUERY_TYPE]: ['../commands/CustomLLMChatCommand', 'CustomLLMChatCommand'],
    [DEEPSEEK_QUERY_TYPE]: ['../commands/DeepseekCommand', 'DeepseekCommand'],
    [EXT_QUERY_TYPE]: ['../commands/ExtCommand', 'ExtCommand'],
    [FOREACH_QUERY_TYPE]: ['../commands/ForeachCommand', 'ForeachCommand'],
    [MEMORIZE_QUERY_TYPE]: ['../commands/MemorizeCommand', 'MemorizeCommand'],
    [OUTLINE_QUERY_TYPE]: ['../commands/OutlineCommand', 'OutlineCommand'],
    [PERPLEXITY_QUERY_TYPE]: ['../commands/PerplexityCommand', 'PerplexityCommand'],
    [QWEN_QUERY_TYPE]: ['../commands/QwenCommand', 'QwenCommand'],
    [SCHOLAR_QUERY_TYPE]: ['../commands/ScholarCommand', 'ScholarCommand'],
    [STEPS_QUERY_TYPE]: ['../commands/StepsCommand', 'StepsCommand'],
    [SUMMARIZE_QUERY_TYPE]: ['../commands/SummarizeCommand', 'SummarizeCommand'],
    [SWITCH_QUERY_TYPE]: ['../commands/SwitchCommand', 'SwitchCommand'],
    [WEB_QUERY_TYPE]: ['../commands/WebCommand', 'WebCommand'],
    [YANDEX_QUERY_TYPE]: ['../commands/YandexCommand', 'YandexCommand'],
  }

  const spyOnRun = queryType => {
    const [modulePath, exportName] = commandModules[queryType]
    const CommandClass = require(modulePath)[exportName]
    return jest.spyOn(CommandClass.prototype, 'run').mockResolvedValue()
  }

  describe('createCommand', () => {
    const mockStore = {
      _userId: 'user1',
      _workflowId: 'wf1',
    }

    it('should create command with correct userId and workflowId', () => {
      const command = CommandFactory.createCommand(CHAT_QUERY_TYPE, mockStore)

      expect(command.userId).toBe('user1')
      expect(command.workflowId).toBe('wf1')
      expect(command.store).toBe(mockStore)
    })

    it('should create command with progress for orchestrators', () => {
      const mockProgress = {}
      const command = CommandFactory.createCommand(STEPS_QUERY_TYPE, mockStore, mockProgress)

      expect(command.progress).toBe(mockProgress)
    })

    it('should return null for unknown queryType', () => {
      const command = CommandFactory.createCommand('unknown', mockStore)

      expect(command).toBeNull()
    })
  })

  describe('createRunner', () => {
    let mockStore
    let mockCell
    const mockContext = 'context'
    const mockPrompt = 'prompt'

    beforeEach(() => {
      mockStore = new Store({userId: 'user1', workflowId: 'wf1', nodes: {}})
      mockCell = {id: 'cell1', command: '/chatgpt test', title: 'Test Cell'}
    })

    describe('runner function creation', () => {
      it('should return a function', () => {
        const runner = CommandFactory.createRunner(CHAT_QUERY_TYPE, mockCell, mockContext, mockPrompt)

        expect(typeof runner).toBe('function')
      })

      it('should return async function', () => {
        const runner = CommandFactory.createRunner(CHAT_QUERY_TYPE, mockCell, mockContext, mockPrompt)
        const result = runner(mockStore)

        expect(result instanceof Promise).toBe(true)
      })
    })

    describe('error handling', () => {
      it('should throw for unknown queryType', async () => {
        const runner = CommandFactory.createRunner('unknown', mockCell, mockContext, mockPrompt)

        await expect(runner(mockStore)).rejects.toThrow('Unknown queryType: unknown')
      })
    })

    describe('parameter binding', () => {
      it('should bind cell parameter at creation time', () => {
        const cell1 = {id: 'c1', title: 'Cell 1'}
        const cell2 = {id: 'c2', title: 'Cell 2'}

        const runner1 = CommandFactory.createRunner(COMPLETION_QUERY_TYPE, cell1, mockContext, mockPrompt)
        const runner2 = CommandFactory.createRunner(COMPLETION_QUERY_TYPE, cell2, mockContext, mockPrompt)

        expect(runner1).not.toBe(runner2)
      })

      it('should create independent runners for same queryType', () => {
        const runner1 = CommandFactory.createRunner(CHAT_QUERY_TYPE, mockCell, 'ctx1', 'prompt1')
        const runner2 = CommandFactory.createRunner(CHAT_QUERY_TYPE, mockCell, 'ctx2', 'prompt2')

        expect(runner1).not.toBe(runner2)
      })

      it.each([
        CHAT_QUERY_TYPE,
        CLAUDE_QUERY_TYPE,
        PERPLEXITY_QUERY_TYPE,
        QWEN_QUERY_TYPE,
        DEEPSEEK_QUERY_TYPE,
        CUSTOM_LLM_CHAT_QUERY_TYPE,
        YANDEX_QUERY_TYPE,
      ])('passes invocation options to context/prompt runner %s', async queryType => {
        const signal = new AbortController().signal
        const runSpy = spyOnRun(queryType)
        const runner = CommandFactory.createRunner(queryType, mockCell, mockContext, mockPrompt, {signal})

        await runner(mockStore)

        expect(runSpy).toHaveBeenCalledWith(expect.any(Object), mockContext, mockPrompt, {signal})

        runSpy.mockRestore()
      })

      it.each([SUMMARIZE_QUERY_TYPE, SWITCH_QUERY_TYPE])(
        'passes invocation options to prompt runner %s',
        async queryType => {
          const signal = new AbortController().signal
          const runSpy = spyOnRun(queryType)
          const runner = CommandFactory.createRunner(queryType, mockCell, mockContext, mockPrompt, {signal})

          await runner(mockStore)

          expect(runSpy).toHaveBeenCalledWith(expect.any(Object), mockPrompt, {signal})

          runSpy.mockRestore()
        },
      )

      it.each([COMPLETION_QUERY_TYPE, FOREACH_QUERY_TYPE, STEPS_QUERY_TYPE])(
        'passes invocation options to option-object runner %s',
        async queryType => {
          const signal = new AbortController().signal
          const runSpy = spyOnRun(queryType)
          const runner = CommandFactory.createRunner(queryType, mockCell, mockContext, mockPrompt, {signal})

          await runner(mockStore)

          expect(runSpy).toHaveBeenCalledWith(expect.any(Object), {signal})

          runSpy.mockRestore()
        },
      )
    })

    describe('store parameter handling', () => {
      it('should accept store at invocation time', async () => {
        const runner = CommandFactory.createRunner(COMPLETION_QUERY_TYPE, mockCell, mockContext, mockPrompt)

        const CompletionCommand = require('../commands/CompletionCommand').CompletionCommand
        const runSpy = jest.spyOn(CompletionCommand.prototype, 'run').mockResolvedValue()

        await runner(mockStore)

        expect(CompletionCommand.prototype.run).toHaveBeenCalled()

        runSpy.mockRestore()
      })

      it('should allow different stores for same runner', async () => {
        const runner = CommandFactory.createRunner(COMPLETION_QUERY_TYPE, mockCell, mockContext, mockPrompt)

        const CompletionCommand = require('../commands/CompletionCommand').CompletionCommand
        const runSpy = jest.spyOn(CompletionCommand.prototype, 'run').mockResolvedValue()

        const store1 = new Store({userId: 'u1', nodes: {}})
        const store2 = new Store({userId: 'u2', nodes: {}})

        await runner(store1)
        await runner(store2)

        expect(runSpy).toHaveBeenCalledTimes(2)

        runSpy.mockRestore()
      })
    })

    describe('command type coverage', () => {
      it.each([
        [CHAT_QUERY_TYPE, 'chat'],
        [COMPLETION_QUERY_TYPE, 'completion'],
        [CLAUDE_QUERY_TYPE, 'claude'],
        [DEEPSEEK_QUERY_TYPE, 'deepseek'],
        [DOWNLOAD_QUERY_TYPE, 'download'],
        [EXT_QUERY_TYPE, 'ext'],
        [QWEN_QUERY_TYPE, 'qwen'],
        [PERPLEXITY_QUERY_TYPE, 'perplexity'],
        [CUSTOM_LLM_CHAT_QUERY_TYPE, 'custom_llm_chat'],
        [YANDEX_QUERY_TYPE, 'yandex'],
        [OUTLINE_QUERY_TYPE, 'outline'],
        [MEMORIZE_QUERY_TYPE, 'memorize'],
        [SCHOLAR_QUERY_TYPE, 'scholar'],
        [SUMMARIZE_QUERY_TYPE, 'summarize'],
        [STEPS_QUERY_TYPE, 'steps'],
        [FOREACH_QUERY_TYPE, 'foreach'],
        [SWITCH_QUERY_TYPE, 'switch'],
        [REFINE_QUERY_TYPE, 'refine'],
        [VALIDATE_QUERY_TYPE, 'validate'],
        [WEB_QUERY_TYPE, 'web'],
      ])('creates runner for %s (%s) command', queryType => {
        const runner = CommandFactory.createRunner(queryType, mockCell, mockContext, mockPrompt)

        expect(typeof runner).toBe('function')
      })
    })

    describe('cell resolution from fork store', () => {
      it('should resolve cell from fork store when node exists', async () => {
        const originalCell = {id: 'cell1', command: '/completion test', title: 'Original'}
        const forkCell = {id: 'cell1', command: '/completion test', title: 'Fork Version'}

        const storeWithNode = new Store({
          userId: 'user1',
          workflowId: 'wf1',
          nodes: {cell1: forkCell},
        })

        const runner = CommandFactory.createRunner(COMPLETION_QUERY_TYPE, originalCell, mockContext, mockPrompt)

        const CompletionCommand = require('../commands/CompletionCommand').CompletionCommand
        const runSpy = jest.spyOn(CompletionCommand.prototype, 'run').mockImplementation(cell => {
          expect(cell).toBe(forkCell)
          expect(cell.title).toBe('Fork Version')
        })

        await runner(storeWithNode)

        runSpy.mockRestore()
      })

      it('should fallback to original cell when node not in store', async () => {
        const originalCell = {id: 'nonexistent', command: '/completion test', title: 'Original'}

        const runner = CommandFactory.createRunner(COMPLETION_QUERY_TYPE, originalCell, mockContext, mockPrompt)

        const CompletionCommand = require('../commands/CompletionCommand').CompletionCommand
        const runSpy = jest.spyOn(CompletionCommand.prototype, 'run').mockImplementation(cell => {
          expect(cell).toBe(originalCell)
          expect(cell.title).toBe('Original')
        })

        await runner(mockStore)

        runSpy.mockRestore()
      })

      it('should resolve cell independently across different command types', () => {
        const cell = {id: 'cell1', command: '/chatgpt test', title: 'Test'}

        const chatRunner = CommandFactory.createRunner(CHAT_QUERY_TYPE, cell, 'context', 'prompt')
        const refineRunner = CommandFactory.createRunner(COMPLETION_QUERY_TYPE, cell, 'context', 'prompt')

        expect(typeof chatRunner).toBe('function')
        expect(typeof refineRunner).toBe('function')
        expect(chatRunner).not.toBe(refineRunner)
      })
    })
  })

  describe('severed research types — R1 boundary', () => {
    const SEVERED_TYPES = [
      [WEB_QUERY_TYPE, '/web'],
      [SCHOLAR_QUERY_TYPE, '/scholar'],
      [EXT_QUERY_TYPE, '/ext'],
      [OUTLINE_QUERY_TYPE, '/outline'],
      [DOWNLOAD_QUERY_TYPE, '/download'],
      [MEMORIZE_QUERY_TYPE, '/memorize'],
    ]

    describe('createCommand', () => {
      it.each(SEVERED_TYPES)('returns null for %s (%s)', queryType => {
        const store = {_userId: 'u', _workflowId: 'wf'}
        expect(CommandFactory.createCommand(queryType, store)).toBeNull()
      })
    })

    describe('createRunner', () => {
      it.each(SEVERED_TYPES)('throws UnknownQueryTypeError for %s (%s)', async queryType => {
        const cell = {id: 'cell', command: `${queryType} test`}
        const store = new Store({userId: 'u', nodes: {}})
        const runner = CommandFactory.createRunner(queryType, cell, 'ctx', 'prompt')

        await expect(runner(store)).rejects.toThrow('Unknown queryType')
      })
    })
  })
})
