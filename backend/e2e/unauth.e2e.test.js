import {describe, beforeEach, afterAll, it, expect} from '@jest/globals'
import {testOrchestrator} from './shared/test-data-factory'
import {publicRequest} from './shared/requests'
import Request from 'supertest'


const rawRequest = new Request(process.env.E2E_SERVER_URL)

describe('Unauth Router', () => {
  beforeEach(async () => {
    await testOrchestrator.prepareTestEnvironment()
  })

  afterAll(async () => {
    await testOrchestrator.cleanupTestEnvironment()
  })

  describe('GET /healthz', () => {
    it('returns health status', async () => {
      const response = await publicRequest.get('/healthz')

      expect(response.status).toBe(200)
    })
  })

  describe('GET /metrics', () => {
    it('returns prometheus metrics', async () => {
      const response = await rawRequest.get('/metrics')

      expect(response.status).toBe(200)
      expect(response.text).toContain('# HELP')
    })
  })
})
