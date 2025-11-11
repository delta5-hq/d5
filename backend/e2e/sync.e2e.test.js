import {describe, beforeEach, afterAll, it, expect} from '@jest/globals'
import {syncRequest, subscriberRequest} from './shared/requests'
import {testDataFactory, httpSetup} from './shared/test-data-factory'

describe('Sync Router', () => {
  beforeEach(async () => {
    await httpSetup.setupDb()
    /* Universal HTTP mode: Test data managed via API */
  })

  afterAll(async () => {
    await httpSetup.teardownDb()
  })

  describe('POST /sync/users', () => {
    it('requires sync user authorization', async () => {
      const res = await subscriberRequest.post('/sync/users').send({})
      
      expect(res.status).toBe(403)
      expect(res.body).toHaveProperty('message')
    })

    it('allows sync user to get all users', async () => {
      const res = await syncRequest.post('/sync/users').send({})
      
      expect(res.status).toBe(400)
      expect(res.body).toHaveProperty('message')
    })
  })

  describe('POST /sync/userMetaData', () => {
    it('requires sync user authorization', async () => {
      const res = await subscriberRequest.post('/sync/userMetaData').send({})
      
      expect(res.status).toBe(403)
      expect(res.body).toHaveProperty('message')
    })

    it('allows sync user to get user metadata', async () => {
      const res = await syncRequest.post('/sync/userMetaData').send({})
      
      expect(res.status).toBe(400)
      expect(res.body).toHaveProperty('message')
    })
  })
})
