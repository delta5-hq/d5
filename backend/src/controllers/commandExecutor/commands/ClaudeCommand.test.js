import {ClaudeCommand} from './ClaudeCommand'
import {substituteReferencesAndHashrefsChildrenAndSelf} from './references/substitution'
import {getIntegrationSettings} from './utils/langchain/getLLM'
import {ClaudeService} from '../../integrations/claude/ClaudeService'
import {refRegExp} from '../constants'
import {clearStepsPrefix} from '../constants/steps'
import Store from './utils/Store'

jest.mock('./references/substitution')
jest.mock('./utils/langchain/getLLM')
jest.mock('../../integrations/claude/ClaudeService')

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

describe('ClaudeCommand', () => {
  const userId = 'userId'
  const mapId = 'mapId'
  const mockStore = new Store({
    userId,
    mapId,
    nodes: {},
  })
  const command = new ClaudeCommand(userId, mapId, mockStore)

  beforeEach(() => {
    jest.clearAllMocks()
    substituteReferencesAndHashrefsChildrenAndSelf.mockReturnValue('substituted prompt')
    clearStepsPrefix.mockImplementation(str => `cleared ${str}`)
    getIntegrationSettings.mockResolvedValue({
      claude: {apiKey: 'apiKey', model: 'model'},
    })

    // Mock ClaudeService sendMessages method
    ClaudeService.sendMessages.mockResolvedValue({
      content: [{text: 'claude response'}],
    })
  })

  describe('run', () => {
    it('should use substituteReferencesAndHashrefsChildrenAndSelf when title contains a reference', async () => {
      jest.spyOn(refRegExp, 'test').mockReturnValue(true)

      const node = {id: 'node', title: '/claude prompt with @@reference'}

      await command.run(node, null, null)

      expect(substituteReferencesAndHashrefsChildrenAndSelf).toHaveBeenCalled()
      expect(clearStepsPrefix).not.toHaveBeenCalled()
    })

    it('should use substituteReferencesAndHashrefsChildrenAndSelf when prompt is falsy', async () => {
      const node = {id: 'node', title: '/claude prompt without reference'}

      await command.run(node, null, null)

      expect(substituteReferencesAndHashrefsChildrenAndSelf).toHaveBeenCalled()
      expect(clearStepsPrefix).not.toHaveBeenCalled()
    })

    it('should use clearStepsPrefix when prompt is provided and title has no reference', async () => {
      jest.spyOn(refRegExp, 'test').mockReturnValue(false)

      const node = {id: 'node', title: '/claude prompt without reference'}
      const originalPrompt = 'original prompt'

      await command.run(node, null, originalPrompt)

      expect(substituteReferencesAndHashrefsChildrenAndSelf).not.toHaveBeenCalled()
      expect(clearStepsPrefix).toHaveBeenCalledWith(originalPrompt)
    })

    it('should create nodes with Claude response', async () => {
      const createSpy = jest.spyOn(mockStore.importer, 'createNodes')
      const node = {id: 'node', title: '/claude prompt'}

      await command.run(node, null, 'test prompt', {})

      expect(createSpy).toHaveBeenCalledWith('claude response', node.id)
      createSpy.mockRestore()
    })
  })
})
