// Mock the reference patterns module before any other imports
jest.mock('./references/utils/referencePatterns', () => ({
  referencePatterns: {
    withAssignmentPrefix: jest.fn(() => ({
      test: jest.fn(),
    })),
  },
}))

// Mock the constants module before importing from it
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

// Now import the constants after mocking
import {clearStepsPrefix} from '../constants/steps'
import {referencePatterns} from './references/utils/referencePatterns'

import YandexService from '../../integrations/yandex/YandexService'

import {YandexCommand} from './YandexCommand'
import {getIntegrationSettings} from './utils/langchain/getLLM'
import {substituteReferencesAndHashrefsChildrenAndSelf} from './references/substitution'
import Store from './utils/Store'

jest.mock('../../integrations/yandex/YandexService')
jest.mock('./utils/langchain/getLLM')
jest.mock('./references/substitution')

describe('YandexCommand', () => {
  const userId = 'userId'
  const workflowId = 'workflowId'
  const mockStore = new Store({
    userId,
    workflowId,
    nodes: {},
  })
  const command = new YandexCommand(userId, workflowId, mockStore)

  beforeEach(() => {
    jest.clearAllMocks()
    substituteReferencesAndHashrefsChildrenAndSelf.mockReturnValue('substituted prompt')
  })

  describe('replyYandex', () => {
    it('should return the text from Yandex API response', async () => {
      getIntegrationSettings.mockResolvedValue({
        yandex: {apiKey: 'apiKey', folder_id: 'folder_id', model: 'model'},
      })
      YandexService.completionWithRetry.mockResolvedValue({
        alternatives: [{message: {text: 'Response'}}],
      })

      const messages = [{text: 'prompt', role: 'user'}]
      const result = await command.replyYandex(messages, userId)

      expect(result).toBe('Response')
    })

    it('should return an empty string on error', async () => {
      getIntegrationSettings.mockResolvedValue({
        yandex: {apiKey: 'apiKey', folder_id: 'folder_id', model: 'model'},
      })
      YandexService.completionWithRetry.mockRejectedValue(new Error('API Error'))

      const messages = [{text: 'prompt', role: 'user'}]
      const result = await command.replyYandex(messages, userId)

      expect(result).toBe('')
    })
  })

  describe('run', () => {
    beforeEach(() => {
      YandexService.completionWithRetry.mockResolvedValue({
        alternatives: [{message: {text: 'Yandex response'}}],
      })
      command.store = mockStore

      mockStore.importer.createNodes = jest.fn()
      mockStore.importer.createTable = jest.fn()
      mockStore.importer.createJoinNode = jest.fn()
    })

    it('should use substituteReferencesAndHashrefsChildrenAndSelf when title contains a reference', async () => {
      referencePatterns.withAssignmentPrefix().test.mockReturnValue(true)

      const node = {id: 'node', title: '/yandexgpt prompt with @@reference'}
      const mapNodes = {node: node}
      const store = new Store({
        userId,
        nodes: mapNodes,
      })

      command.store = store
      await command.run(node, null, null)

      expect(substituteReferencesAndHashrefsChildrenAndSelf).toHaveBeenCalled()
      expect(clearStepsPrefix).not.toHaveBeenCalled()
    })

    it('should use substituteReferencesAndHashrefsChildrenAndSelf when prompt is falsy', async () => {
      const node = {id: 'node', title: '/yandexgpt prompt without reference'}
      const mapNodes = {node: node}
      const store = new Store({
        userId,
        nodes: mapNodes,
      })

      command.store = store

      await command.run(node, null, null)

      expect(substituteReferencesAndHashrefsChildrenAndSelf).toHaveBeenCalled()
      expect(clearStepsPrefix).not.toHaveBeenCalled()
    })

    it('should use clearStepsPrefix when prompt is provided and title has no reference', async () => {
      referencePatterns.withAssignmentPrefix().test.mockReturnValue(false)

      const node = {id: 'node', title: '/yandexgpt prompt without reference'}
      const mapNodes = {node: node}
      const originalPrompt = 'original prompt'
      const store = new Store({
        userId,
        nodes: mapNodes,
      })

      command.store = store

      await command.run(node, null, originalPrompt)

      expect(substituteReferencesAndHashrefsChildrenAndSelf).not.toHaveBeenCalled()
      expect(clearStepsPrefix).toHaveBeenCalledWith(originalPrompt)
    })

    it('should create nodes with createNodes when not using table or join params', async () => {
      mockStore.importer.createNodes.mockResolvedValue([{id: 'newNode'}])

      const node = {id: 'node', title: '/yandexgpt prompt'}

      await command.run(node, null, 'test prompt')

      expect(mockStore.importer.createNodes).toHaveBeenCalled()
    })

    it('should create table nodes when readTableParam is true', async () => {
      mockStore.importer.createTable.mockReturnValue({id: 'tableNode'})

      const node = {id: 'node', title: '/yandexgpt prompt --table'}

      await command.run(node, null, 'test prompt', {})

      expect(mockStore.importer.createTable).toHaveBeenCalled()
    })

    it('should create join nodes when readJoinParam is true', async () => {
      mockStore.importer.createJoinNode.mockReturnValue({id: 'joinNode'})

      const node = {id: 'node', title: '/yandexgpt prompt --join'}

      await command.run(node, null, 'test prompt', {})

      expect(mockStore.importer.createJoinNode).toHaveBeenCalled()
    })

    it('should substitue node children to prompt', async () => {
      const subChild = {id: 'sc', title: '@@subject'}
      const child = {title: 'для научной статьи на тему', depth: 3, id: 'c', children: [subChild.id]}
      const parent = {
        title: '/yandexgpt придумай 2 поисковых запроса',
        depth: 2,
        id: 'p',
        children: [child.id],
      }

      const mapNodes = {
        [subChild.id]: subChild,
        [child.id]: child,
        [parent.id]: parent,
      }
      const store = new Store({
        userId,
        nodes: mapNodes,
      })

      command.store = store

      substituteReferencesAndHashrefsChildrenAndSelf.mockReturnValueOnce(
        'придумай 2 поисковых запроса\n  для научной статьи на тему',
      )

      const replySpy = jest.spyOn(YandexCommand.prototype, 'replyYandex').mockReturnValue('response')

      await command.run(parent, null, undefined)

      const messages = [
        {role: 'user', text: 'Context:\n```\n```\nпридумай 2 поисковых запроса\n  для научной статьи на тему'},
      ]

      expect(replySpy).toHaveBeenCalledWith(messages, expect.anything())
    })
  })
})
