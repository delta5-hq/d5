import {PerplexityCommand} from './PerplexityCommand'
import {substituteReferencesAndHashrefsChildrenAndSelf} from './references/substitution'
import {getIntegrationSettings} from './utils/langchain/getLLM'
import {cleanChainOfThoughtText} from '../../utils/cleanChainOfThoughtText'
import {refRegExp} from '../constants'
import {clearStepsPrefix} from '../constants/steps'
import Store from './utils/Store'

jest.mock('./references/substitution')
jest.mock('./utils/langchain/getLLM')
jest.mock('openai')
jest.mock('../../utils/cleanChainOfThoughtText')
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

describe('PerplexityCommand', () => {
  const userId = 'userId'
  const workflowId = 'workflowId'
  const mockStore = new Store({
    userId,
    workflowId,
    nodes: {},
  })
  const command = new PerplexityCommand(userId, workflowId, mockStore)

  beforeEach(() => {
    jest.clearAllMocks()
    substituteReferencesAndHashrefsChildrenAndSelf.mockReturnValue('substituted prompt')
    getIntegrationSettings.mockResolvedValue({
      perplexity: {apiKey: 'apiKey', model: 'model'},
    })
    cleanChainOfThoughtText.mockReturnValue('cleaned response')

    // Mock static call method
    jest.spyOn(PerplexityCommand, 'call').mockResolvedValue({
      choices: [{message: {content: 'perplexity response'}}],
      citations: [],
    })
  })

  describe('run', () => {
    it('should use substituteReferencesAndHashrefsChildrenAndSelf when title contains a reference', async () => {
      jest.spyOn(refRegExp, 'test').mockReturnValue(true)

      const node = {id: 'node', title: '/perplexity prompt with @@reference'}

      await command.run(node, null, null)

      expect(substituteReferencesAndHashrefsChildrenAndSelf).toHaveBeenCalled()
      expect(clearStepsPrefix).not.toHaveBeenCalled()
    })

    it('should use substituteReferencesAndHashrefsChildrenAndSelf when prompt is falsy', async () => {
      const node = {id: 'node', title: '/perplexity prompt without reference'}

      await command.run(node, null, null)

      expect(substituteReferencesAndHashrefsChildrenAndSelf).toHaveBeenCalled()
      expect(clearStepsPrefix).not.toHaveBeenCalled()
    })

    it('should use clearStepsPrefix when prompt is provided and title has no reference', async () => {
      jest.spyOn(refRegExp, 'test').mockReturnValue(false)

      const node = {id: 'node', title: '/perplexity prompt without reference'}
      const originalPrompt = 'original prompt'

      await command.run(node, null, originalPrompt)

      expect(substituteReferencesAndHashrefsChildrenAndSelf).not.toHaveBeenCalled()
      expect(clearStepsPrefix).toHaveBeenCalledWith(originalPrompt)
    })

    it('should create nodes with Perplexity response', async () => {
      const createSpy = jest.spyOn(mockStore.importer, 'createNodes')
      const node = {id: 'node', title: '/perplexity prompt'}

      await command.run(node, null, 'test prompt')

      expect(createSpy).toHaveBeenCalledWith('cleaned response', node.id)
      createSpy.mockRestore()
    })
  })
})
