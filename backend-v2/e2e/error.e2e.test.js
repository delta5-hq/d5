import {describe, beforeAll, afterAll, it, expect} from '@jest/globals'
import {subscriberRequest, publicRequest} from './shared/requests'
import {testDataFactory, testOrchestrator} from './shared/test-data-factory'

describe('Error Router', () => {
  beforeEach(async () => {
    await testOrchestrator.prepareTestEnvironment()
    
  })

  afterAll(async () => {
    await testOrchestrator.cleanupTestEnvironment()
  })

  describe('POST /errors', () => {
    it('accepts client errors', async () => {
      const response = await subscriberRequest.post('/errors').send({
        backtrace: 'test',
        addition: 'additional information',
        path: '/test',
        workflowId: 'test-workflow-id',
        userId: 'any-user-id',
      })

      const data = JSON.parse(response.res.text)

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('success', true)
      expect(typeof data.success).toBe('boolean')
    })
  })

  describe('Unknown paths', () => {
    it('returns 404 for authenticated unknown path', async () => {
      const response = await subscriberRequest.get('/any/unknown/url')

      expect(response.status).toBe(404)
      expect(response.res.text).toBe('Not Found')
      expect(typeof response.res.text).toBe('string')
    })

    it('returns 404 for public unknown path', async () => {
      const response = await publicRequest.get('/another/unknown/url')

      expect(response.status).toBe(404)
      expect(response.res.text).toBe('Not Found')
      expect(typeof response.res.text).toBe('string')
    })
  })
})
