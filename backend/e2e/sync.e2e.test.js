import {describe, beforeEach, afterAll, it, expect} from '@jest/globals'
import {setupDb, teardownDb, isHttpMode} from './setup'
import {syncRequest, subscriberRequest} from './shared/requests'
import User from '../src/models/User'

describe('Sync Router', () => {
  beforeEach(async () => {
    await setupDb()
    
    /* Only skip database operations in HTTP mode - keep test execution */
    if (!isHttpMode()) {
      await User.deleteMany({})
    }
  })

  afterAll(async () => {
    if (!isHttpMode()) {
      await User.deleteMany({})
    }
    await teardownDb()
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
