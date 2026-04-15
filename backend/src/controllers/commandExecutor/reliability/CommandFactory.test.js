import CommandFactory from './CommandFactory'
import Store from '../commands/utils/Store'
import {CHAT_QUERY_TYPE} from '../constants/chat'
import {CLAUDE_QUERY_TYPE} from '../constants/claude'
import {OUTLINE_QUERY_TYPE} from '../constants/outline'
import {REFINE_QUERY_TYPE} from '../constants/refine'
import {STEPS_QUERY_TYPE} from '../constants/steps'
import {COMPLETION_QUERY_TYPE} from '../constants/completion'
import {DEEPSEEK_QUERY_TYPE} from '../constants/deepseek'
import {YANDEX_QUERY_TYPE} from '../constants/yandex'
import {SUMMARIZE_QUERY_TYPE} from '../constants/summarize'
import {FOREACH_QUERY_TYPE} from '../constants/foreach'
import {SWITCH_QUERY_TYPE} from '../constants/switch'

jest.mock('debug', () => {
  const fn = jest.fn(() => fn)
  fn.extend = jest.fn(() => fn)
  return fn
})

describe('CommandFactory', () => {
  describe('isLLMCommand', () => {
    it('should classify chat commands as LLM', () => {
      expect(CommandFactory.isLLMCommand(CHAT_QUERY_TYPE)).toBe(true)
      expect(CommandFactory.isLLMCommand(CLAUDE_QUERY_TYPE)).toBe(true)
    })

    it('should classify outline/summarize as LLM', () => {
      expect(CommandFactory.isLLMCommand(OUTLINE_QUERY_TYPE)).toBe(true)
    })

    it('should not classify completion as LLM (dispatcher)', () => {
      expect(CommandFactory.isLLMCommand(COMPLETION_QUERY_TYPE)).toBe(false)
    })

    it('should not classify orchestrators as LLM', () => {
      expect(CommandFactory.isLLMCommand(STEPS_QUERY_TYPE)).toBe(false)
    })

    it('should return false for unknown types', () => {
      expect(CommandFactory.isLLMCommand('unknown')).toBe(false)
    })

    it('should return false for null', () => {
      expect(CommandFactory.isLLMCommand(null)).toBe(false)
    })

    it('should return false for undefined', () => {
      expect(CommandFactory.isLLMCommand(undefined)).toBe(false)
    })
  })

  describe('isOrchestrator', () => {
    it('should classify steps as orchestrator', () => {
      expect(CommandFactory.isOrchestrator(STEPS_QUERY_TYPE)).toBe(true)
    })

    it('should not classify LLM commands as orchestrator', () => {
      expect(CommandFactory.isOrchestrator(CHAT_QUERY_TYPE)).toBe(false)
    })

    it('should not classify refine as orchestrator', () => {
      expect(CommandFactory.isOrchestrator(REFINE_QUERY_TYPE)).toBe(false)
    })

    it('should return false for unknown types', () => {
      expect(CommandFactory.isOrchestrator('unknown')).toBe(false)
    })
  })

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

        const runner1 = CommandFactory.createRunner(REFINE_QUERY_TYPE, cell1, mockContext, mockPrompt)
        const runner2 = CommandFactory.createRunner(REFINE_QUERY_TYPE, cell2, mockContext, mockPrompt)

        expect(runner1).not.toBe(runner2)
      })

      it('should create independent runners for same queryType', () => {
        const runner1 = CommandFactory.createRunner(CHAT_QUERY_TYPE, mockCell, 'ctx1', 'prompt1')
        const runner2 = CommandFactory.createRunner(CHAT_QUERY_TYPE, mockCell, 'ctx2', 'prompt2')

        expect(runner1).not.toBe(runner2)
      })
    })

    describe('store parameter handling', () => {
      it('should accept store at invocation time', async () => {
        const runner = CommandFactory.createRunner(REFINE_QUERY_TYPE, mockCell, mockContext, mockPrompt)

        const RefineCommand = require('../commands/RefineCommand').RefineCommand
        const runSpy = jest.spyOn(RefineCommand.prototype, 'run').mockResolvedValue()

        await runner(mockStore)

        expect(RefineCommand.prototype.run).toHaveBeenCalled()

        runSpy.mockRestore()
      })

      it('should allow different stores for same runner', async () => {
        const runner = CommandFactory.createRunner(REFINE_QUERY_TYPE, mockCell, mockContext, mockPrompt)

        const RefineCommand = require('../commands/RefineCommand').RefineCommand
        const runSpy = jest.spyOn(RefineCommand.prototype, 'run').mockResolvedValue()

        const store1 = new Store({userId: 'u1', nodes: {}})
        const store2 = new Store({userId: 'u2', nodes: {}})

        await runner(store1)
        await runner(store2)

        expect(runSpy).toHaveBeenCalledTimes(2)

        runSpy.mockRestore()
      })
    })

    describe('command type coverage', () => {
      const testCases = [
        {queryType: CHAT_QUERY_TYPE, name: 'chat'},
        {queryType: CLAUDE_QUERY_TYPE, name: 'claude'},
        {queryType: DEEPSEEK_QUERY_TYPE, name: 'deepseek'},
        {queryType: YANDEX_QUERY_TYPE, name: 'yandex'},
        {queryType: OUTLINE_QUERY_TYPE, name: 'outline'},
        {queryType: SUMMARIZE_QUERY_TYPE, name: 'summarize'},
        {queryType: REFINE_QUERY_TYPE, name: 'refine'},
        {queryType: STEPS_QUERY_TYPE, name: 'steps'},
        {queryType: FOREACH_QUERY_TYPE, name: 'foreach'},
        {queryType: SWITCH_QUERY_TYPE, name: 'switch'},
      ]

      testCases.forEach(({queryType, name}) => {
        it(`should create runner for ${name} command`, () => {
          const runner = CommandFactory.createRunner(queryType, mockCell, mockContext, mockPrompt)

          expect(typeof runner).toBe('function')
        })
      })
    })

    describe('cell resolution from fork store', () => {
      it('should resolve cell from fork store when node exists', async () => {
        const originalCell = {id: 'cell1', command: '/refine test', title: 'Original'}
        const forkCell = {id: 'cell1', command: '/refine test', title: 'Fork Version'}

        const storeWithNode = new Store({
          userId: 'user1',
          workflowId: 'wf1',
          nodes: {cell1: forkCell},
        })

        const runner = CommandFactory.createRunner(REFINE_QUERY_TYPE, originalCell, mockContext, mockPrompt)

        const RefineCommand = require('../commands/RefineCommand').RefineCommand
        const runSpy = jest.spyOn(RefineCommand.prototype, 'run').mockImplementation(cell => {
          expect(cell).toBe(forkCell)
          expect(cell.title).toBe('Fork Version')
        })

        await runner(storeWithNode)

        runSpy.mockRestore()
      })

      it('should fallback to original cell when node not in store', async () => {
        const originalCell = {id: 'nonexistent', command: '/refine test', title: 'Original'}

        const runner = CommandFactory.createRunner(REFINE_QUERY_TYPE, originalCell, mockContext, mockPrompt)

        const RefineCommand = require('../commands/RefineCommand').RefineCommand
        const runSpy = jest.spyOn(RefineCommand.prototype, 'run').mockImplementation(cell => {
          expect(cell).toBe(originalCell)
          expect(cell.title).toBe('Original')
        })

        await runner(mockStore)

        runSpy.mockRestore()
      })

      it('should resolve cell independently across different command types', () => {
        const cell = {id: 'cell1', command: '/chatgpt test', title: 'Test'}

        const chatRunner = CommandFactory.createRunner(CHAT_QUERY_TYPE, cell, 'context', 'prompt')
        const refineRunner = CommandFactory.createRunner(REFINE_QUERY_TYPE, cell, 'context', 'prompt')

        expect(typeof chatRunner).toBe('function')
        expect(typeof refineRunner).toBe('function')
        expect(chatRunner).not.toBe(refineRunner)
      })
    })
  })
})
