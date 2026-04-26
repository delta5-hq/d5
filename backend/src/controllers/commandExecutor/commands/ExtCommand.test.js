import {BaseChatModel} from '@langchain/core/language_models/chat_models'

// Mock the reference patterns module
jest.mock('./references/utils/referencePatterns', () => ({
  referencePatterns: {
    withAssignmentPrefix: jest.fn(() => ({
      test: jest.fn(),
    })),
  },
}))

jest.mock('../constants/steps', () => ({
  clearStepsPrefix: jest.fn(str => `cleared ${str}`),
}))
jest.mock('../constants', () => {
  const originalModule = jest.requireActual('../constants')
  return {
    ...originalModule,
    refRegExp: {test: jest.fn()},
  }
})

import {clearStepsPrefix} from '../constants/steps'
import {referencePatterns} from './references/utils/referencePatterns'

import {substituteReferencesAndHashrefsChildrenAndSelf} from './references/substitution'
import Store from './utils/Store'
import {ExtCommand} from './ExtCommand'

jest.mock('./utils/langchain/getLLM')
jest.mock('openai')
jest.mock('./references/substitution')

describe('ExtCommand', () => {
  const userId = 'userId'
  const workflowId = 'workflowId'
  const mockStore = new Store({
    userId,
    workflowId,
    nodes: {},
  })
  const command = new ExtCommand(userId, workflowId, mockStore)

  beforeEach(() => {
    jest.clearAllMocks()
    substituteReferencesAndHashrefsChildrenAndSelf.mockReturnValue('substituted prompt')
  })

  const callSpy = jest.spyOn(BaseChatModel.prototype, 'invoke')

  beforeEach(() => {
    callSpy.mockClear()
  })

  describe('run', () => {
    let createResponseExtSpy

    beforeEach(() => {
      command.store = mockStore

      mockStore.importer.createNodes = jest.fn()
      mockStore.importer.createTable = jest.fn()
      mockStore.importer.createJoinNode = jest.fn()

      createResponseExtSpy = jest.spyOn(ExtCommand.prototype, 'createResponseExt').mockResolvedValue('Response')
    })

    afterEach(() => {
      createResponseExtSpy.mockRestore()
    })

    it('should use substituteReferencesAndHashrefsChildrenAndSelf when title contains a reference', async () => {
      referencePatterns.withAssignmentPrefix().test.mockReturnValue(true)

      const node = {id: 'node', title: '/ext prompt with @@reference'}

      await command.run(node, null)

      expect(substituteReferencesAndHashrefsChildrenAndSelf).toHaveBeenCalled()
      expect(clearStepsPrefix).not.toHaveBeenCalled()
    })

    it('should use substituteReferencesAndHashrefsChildrenAndSelf when prompt is falsy', async () => {
      const node = {id: 'node', title: '/ext prompt without reference'}

      await command.run(node, null)

      expect(substituteReferencesAndHashrefsChildrenAndSelf).toHaveBeenCalled()
      expect(clearStepsPrefix).not.toHaveBeenCalled()
    })

    it('should use clearStepsPrefix when prompt is provided and title has no reference', async () => {
      referencePatterns.withAssignmentPrefix().test.mockReturnValue(false)

      const node = {id: 'node', title: '/ext prompt without reference'}
      const originalPrompt = 'original prompt'

      await command.run(node, originalPrompt)

      expect(substituteReferencesAndHashrefsChildrenAndSelf).not.toHaveBeenCalled()
      expect(clearStepsPrefix).toHaveBeenCalledWith(originalPrompt)
    })

    it('should create error node when createResponseExt fails', async () => {
      createResponseExtSpy.mockRejectedValue(new Error('Vector store initialization failed'))

      const node = {id: 'node', title: '/ext query knowledge base'}

      await command.run(node, 'test prompt')

      expect(command.store.importer.createNodes).toHaveBeenCalledWith(
        'Error: Vector store initialization failed',
        'node',
      )
    })

    it('should create error node on network errors from createResponseExt', async () => {
      createResponseExtSpy.mockRejectedValue(new Error('ECONNREFUSED'))

      const node = {id: 'node', title: '/ext query'}

      await command.run(node, 'test')

      expect(command.store.importer.createNodes).toHaveBeenCalledWith('Error: ECONNREFUSED', 'node')
    })

    it('should create error node on LLM errors from createResponseExt', async () => {
      createResponseExtSpy.mockRejectedValue(new Error('Rate limit exceeded'))

      const node = {id: 'node', title: '/ext search'}

      await command.run(node, 'query')

      expect(command.store.importer.createNodes).toHaveBeenCalledWith('Error: Rate limit exceeded', 'node')
    })
  })
})
