import {BaseChatModel} from 'langchain/chat_models/base'

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
  const mapId = 'mapId'
  const mockStore = new Store({
    userId,
    mapId,
    nodes: {},
  })
  const command = new ExtCommand(userId, mapId, mockStore)

  beforeEach(() => {
    jest.clearAllMocks()
    substituteReferencesAndHashrefsChildrenAndSelf.mockReturnValue('substituted prompt')
  })

  const callSpy = jest.spyOn(BaseChatModel.prototype, 'call')

  beforeEach(() => {
    callSpy.mockClear()
  })

  describe('run', () => {
    beforeEach(() => {
      command.store = mockStore

      mockStore.importer.createNodes = jest.fn()
      mockStore.importer.createTable = jest.fn()
      mockStore.importer.createJoinNode = jest.fn()
    })

    it('should use substituteReferencesAndHashrefsChildrenAndSelf when title contains a reference', async () => {
      callSpy.mockResolvedValue({content: 'Response'})
      referencePatterns.withAssignmentPrefix().test.mockReturnValue(true)

      const node = {id: 'node', title: '/ext prompt with @@reference'}

      await command.run(node, null)

      expect(substituteReferencesAndHashrefsChildrenAndSelf).toHaveBeenCalled()
      expect(clearStepsPrefix).not.toHaveBeenCalled()
    })

    it('should use substituteReferencesAndHashrefsChildrenAndSelf when prompt is falsy', async () => {
      callSpy.mockResolvedValue({content: 'Response'})

      const node = {id: 'node', title: '/ext prompt without reference'}

      await command.run(node, null)

      expect(substituteReferencesAndHashrefsChildrenAndSelf).toHaveBeenCalled()
      expect(clearStepsPrefix).not.toHaveBeenCalled()
    })

    it('should use clearStepsPrefix when prompt is provided and title has no reference', async () => {
      callSpy.mockResolvedValue({content: 'Response'})
      referencePatterns.withAssignmentPrefix().test.mockReturnValue(false)

      const node = {id: 'node', title: '/ext prompt without reference'}
      const originalPrompt = 'original prompt'

      await command.run(node, originalPrompt)

      expect(substituteReferencesAndHashrefsChildrenAndSelf).not.toHaveBeenCalled()
      expect(clearStepsPrefix).toHaveBeenCalledWith(originalPrompt)
    })
  })
})
