import {createOpenaiIntegration} from './createOpenaiIntegration'

jest.mock('../../constants', () => ({
  INITIAL_OPENAI_MODEL_NAME: 'model-initial',
  OPENAI_API_KEY: 'sk-test',
  OPENAI_MODELS: {GPT_4_1_MINI: 'model-mini'},
}))

jest.mock('../../models/Integration', () => ({
  __esModule: true,
  default: {updateOne: jest.fn()},
}))

import Integration from '../../models/Integration'

const mockeds = require('../../constants')

describe('createOpenaiIntegration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockeds.OPENAI_API_KEY = 'sk-test'
  })

  describe('DB call invariants', () => {
    it('issues exactly one updateOne call per invocation', async () => {
      await createOpenaiIntegration('user-1')
      expect(Integration.updateOne).toHaveBeenCalledTimes(1)
    })

    it('always passes upsert:true so the document is created when absent', async () => {
      await createOpenaiIntegration('user-1')
      const [, , options] = Integration.updateOne.mock.calls[0]
      expect(options).toEqual({upsert: true})
    })
  })

  describe('userId forwarding', () => {
    it.each([
      ['alphanumeric', 'user-123'],
      ['email-shaped', 'admin@example.com'],
      ['UUID-shaped', '550e8400-e29b-41d4-a716-446655440000'],
      ['single character', 'x'],
    ])('%s userId is forwarded unchanged to both filter and $set', async (_label, userId) => {
      await createOpenaiIntegration(userId)
      const [filter, update] = Integration.updateOne.mock.calls[0]
      expect(filter.userId).toBe(userId)
      expect(update.$set.userId).toBe(userId)
    })
  })

  describe('scope isolation — filter targets only user-level documents', () => {
    it('filter workflowId is null so workflow-scoped documents are never matched', async () => {
      await createOpenaiIntegration('user-1')
      const [filter] = Integration.updateOne.mock.calls[0]
      expect(filter.workflowId).toBeNull()
    })

    it('filter contains exactly userId and workflowId with no extra keys', async () => {
      await createOpenaiIntegration('user-1')
      const [filter] = Integration.updateOne.mock.calls[0]
      expect(Object.keys(filter).sort()).toEqual(['userId', 'workflowId'])
    })
  })

  describe('scope anchoring — upsert creates a user-level document', () => {
    it('$set workflowId is null so an upserted document lands at user scope', async () => {
      await createOpenaiIntegration('user-1')
      const [, update] = Integration.updateOne.mock.calls[0]
      expect(update.$set.workflowId).toBeNull()
    })

    it('filter.workflowId and $set.workflowId are identical — filter and write scopes are consistent', async () => {
      await createOpenaiIntegration('user-1')
      const [filter, update] = Integration.updateOne.mock.calls[0]
      expect(filter.workflowId).toBe(update.$set.workflowId)
    })
  })

  describe('model selection', () => {
    it.each([
      ['non-empty string key', 'sk-present', 'model-initial'],
      ['empty string key', '', 'model-mini'],
      ['undefined key', undefined, 'model-mini'],
    ])('OPENAI_API_KEY is %s — selects model from corresponding constant', async (_label, apiKey, expectedModel) => {
      mockeds.OPENAI_API_KEY = apiKey
      await createOpenaiIntegration('user-1')
      const [, update] = Integration.updateOne.mock.calls[0]
      expect(update.$set.openai.model).toBe(expectedModel)
    })

    it('model is nested under the openai key in $set', async () => {
      await createOpenaiIntegration('user-1')
      const [, update] = Integration.updateOne.mock.calls[0]
      expect(update.$set).toHaveProperty('openai')
      expect(typeof update.$set.openai).toBe('object')
      expect(update.$set.openai).toHaveProperty('model')
    })
  })
})
