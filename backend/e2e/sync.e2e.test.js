import {describe, beforeEach, afterAll, it, expect} from '@jest/globals'
import {setupDb, teardownDb, isHttpMode} from './setup'
import {syncRequest, subscriberRequest} from './shared/requests'
import {testIdFilter} from './shared/test-constants'
import User from '../src/models/User'

describe('Sync Router', () => {
  beforeEach(async () => {
    await setupDb()
    
    /* Only skip database operations in HTTP mode - keep test execution */
    if (!isHttpMode()) {
      await User.deleteMany(testIdFilter())
    }
  })

  afterAll(async () => {
    if (!isHttpMode()) {
      await User.deleteMany(testIdFilter())
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

    it('syncs user data successfully', async () => {
      const res = await syncRequest.post('/sync/users').send({
        id: 'test-sync-user-001',
        name: 'Test Sync User',
        mail: 'testsync@example.com',
        roles: ['user']
      })
      
      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('success', true)
    })

    it('syncs multiple users successfully', async () => {
      const res = await syncRequest.post('/sync/users').send([
        {id: 'test-sync-user-002', name: 'User Two', mail: 'user2@example.com', roles: ['user']},
        {id: 'test-sync-user-003', name: 'User Three', mail: 'user3@example.com', roles: ['admin']}
      ])
      
      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('success', true)
    })

    it('rejects user without required id', async () => {
      const res = await syncRequest.post('/sync/users').send({
        name: 'No ID User',
        mail: 'noid@example.com',
        roles: ['user']
      })
      
      expect(res.status).toBe(400)
      expect(res.body).toHaveProperty('message')
    })

    it('rejects user without required email', async () => {
      const res = await syncRequest.post('/sync/users').send({
        id: 'test-sync-no-email',
        name: 'No Email User',
        roles: ['user']
      })
      
      expect([400, 500]).toContain(res.status)
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

    it('syncs user metadata successfully', async () => {
      /* Create user first */
      await syncRequest.post('/sync/users').send({
        id: 'test-sync-user-004',
        name: 'Test Meta User',
        mail: 'metauser@example.com',
        roles: ['user']
      })

      const res = await syncRequest.post('/sync/userMetaData').send({
        id: 'test-sync-user-004',
        userdata: JSON.stringify({
          Delta5_WhatFor: 'testing',
          Demographics_Pupil: false,
          Demographics_Student: true,
          Demographics_StudyPhase: 'bachelor',
          Demographics_FirstName: 'Test',
          Demographics_LastName: 'User'
        })
      })
      
      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('success', true)
    })

    it('syncs multiple user metadata successfully', async () => {
      /* Create users first */
      await syncRequest.post('/sync/users').send([
        {id: 'test-sync-user-005', name: 'User Five', mail: 'user5@example.com', roles: ['user']},
        {id: 'test-sync-user-006', name: 'User Six', mail: 'user6@example.com', roles: ['user']}
      ])

      const res = await syncRequest.post('/sync/userMetaData').send([
        {id: 'test-sync-user-005', userdata: JSON.stringify({Delta5_WhatFor: 'test1', Demographics_Student: true})},
        {id: 'test-sync-user-006', userdata: JSON.stringify({Delta5_WhatFor: 'test2', Demographics_Employee: true})}
      ])
      
      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('success', true)
    })
  })
})
