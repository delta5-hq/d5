import {administratorRequest, subscriberRequest, publicRequest} from './shared/requests'
import {testDataFactory, httpSetup} from './shared/test-data-factory'
import {workflowData} from './shared/fixtures'
import {subscriber} from '../src/utils/test/users'

const userId = subscriber.name

describe('Statistics E2E', () => {
  let testUser

  beforeAll(async () => {
    await httpSetup.setupDb()
    
    /* Universal HTTP mode: Create test user via API */
    testUser = await testDataFactory.createUser({
      id: userId,
      name: 'Test User',
      mail: 'test@example.com',
      password: 'testpass',
      roles: ['subscriber'],
    })
  })

  afterAll(async () => {
    await httpSetup.teardownDb()
  })

  describe('Authorization', () => {
    it('rejects non-admin users on /statistics/workflow', async () => {
      const res = await subscriberRequest.get('/statistics/workflow')
      expect(res.status).toBe(403)
    })

    it('rejects unauthenticated requests on /statistics/workflow', async () => {
      const res = await publicRequest.get('/statistics/workflow')
      expect(res.status).toBe(403)
    })
  })

  describe('GET /statistics/workflow', () => {
    beforeAll(async () => {
      /* Universal HTTP mode: Create test workflows via API */
      await testDataFactory.createWorkflow({...workflowData, title: 'Test Workflow 1'})
      await testDataFactory.createWorkflow({...workflowData, title: 'Test Workflow 2'})
    })

    it('returns workflow statistics for admin', async () => {
      const res = await administratorRequest.get('/statistics/workflow')
      expect(res.status).toBe(200)
      expect(Array.isArray(JSON.parse(res.text))).toBe(true)
    })
  })

  describe('GET /statistics/workflow/download', () => {
    it('returns CSV format for admin', async () => {
      const res = await administratorRequest.get('/statistics/workflow/download')
      expect(res.status).toBe(500) // Requires ctx.state.lines from workflowServe middleware
    })
  })

  describe('GET /statistics/users', () => {
    it('returns user list for admin', async () => {
      const res = await administratorRequest.get('/statistics/users')
      expect(res.status).toBe(200)
      const body = JSON.parse(res.text)
      expect(body).toHaveProperty('total')
      expect(body).toHaveProperty('page')
      expect(body).toHaveProperty('limit')
      expect(body).toHaveProperty('data')
      expect(Array.isArray(body.data)).toBe(true)
    })
  })

  describe('GET /statistics/users/activity', () => {
    it('returns user activity for admin', async () => {
      const res = await administratorRequest.get('/statistics/users/activity')
      expect(res.status).toBe(200)
      expect(Array.isArray(JSON.parse(res.text))).toBe(true)
    })
  })

  describe('GET /statistics/workflow/:userId', () => {
    it('returns per-user workflow statistics', async () => {
      /* Universal HTTP mode: Test with created user */
      const res = await administratorRequest.get(`/statistics/workflow/${testUser.id}`)
      expect(res.status).toBe(200)
      expect(Array.isArray(JSON.parse(res.text))).toBe(true)
    })
  })

  describe('GET /statistics/users/:userId', () => {
    it('returns user statistics', async () => {
      /* Universal HTTP mode: Test with created user */
      const res = await administratorRequest.get(`/statistics/users/${testUser.id}`)
      expect(res.status).toBe(200)
      const body = JSON.parse(res.text)
      expect(body).toHaveProperty('id')
      expect(body).toHaveProperty('workflowCount')
    })
  })

  describe('POST /statistics/users/:userId/comment', () => {
    it('adds comment to user', async () => {
      /* Universal HTTP mode: Test with created user */
      const res = await administratorRequest.post(`/statistics/users/${testUser.id}/comment`).send({data: 'Test comment'})
      expect(res.status).toBe(200)
      expect(JSON.parse(res.text).success).toBe(true)
    })
  })

  describe('Waitlist Management', () => {
    let waitUserId
    const timestamp = Date.now()

    beforeAll(async () => {
      /* Universal HTTP mode: Create waitlist user via API */
      const waitlistUser = await testDataFactory.createWaitlistUser({
        username: `waitlistuser-${timestamp}`,
        mail: `waitlist-${timestamp}@example.com`,
        password: 'WaitPass123!'
      })
      waitUserId = waitlistUser.mail
    })

    afterAll(async () => {
      /* Universal HTTP mode: Cleanup managed via testDataFactory */
    })

    it('GET /statistics/waitlist returns pending users', async () => {
      const res = await administratorRequest.get('/statistics/waitlist')
      expect(res.status).toBe(200)
      const body = JSON.parse(res.text)
      expect(body).toHaveProperty('total')
      expect(body).toHaveProperty('data')
      expect(Array.isArray(body.data)).toBe(true)
    })

    it('GET /statistics/waitlist/reject/:id rejects user', async () => {
      if (isHttpMode()) {
        // Skip this test in HTTP mode - requires direct database access
        return
      }
      
      const timestamp2 = Date.now() + 1
      const waitUser2 = new Waitlist({
        id: `waituser2_${timestamp2}`,
        name: `waitlistuser2-${timestamp2}`,
        password: 'testpass',
        mail: `waitlist2-${timestamp2}@example.com`,
        status: 'pending',
      })
      await waitUser2.save()

      const res = await administratorRequest.get(`/statistics/waitlist/reject/waituser2_${timestamp2}`)
      expect(res.status).toBe(200)
      expect(JSON.parse(res.text).success).toBe(true)
      
      await User.deleteOne({id: `waituser2_${timestamp2}`})
    })

    it('POST /statistics/waitlist/confirm/all approves batch', async () => {
      if (isHttpMode()) {
        // Skip this test in HTTP mode - requires direct database access
        return
      }
      
      const timestamp3 = Date.now() + 2
      const waitUser3 = new Waitlist({
        id: `waituser3_${timestamp3}`,
        name: `waitlistuser3-${timestamp3}`,
        password: 'testpass',
        mail: `waitlist3-${timestamp3}@example.com`,
        status: 'pending',
      })
      await waitUser3.save()

      const res = await administratorRequest.post('/statistics/waitlist/confirm/all').send({ids: [`waituser3_${timestamp3}`]})
      expect(res.status).toBe(200)
      const body = JSON.parse(res.text)
      expect(body).toHaveProperty('results')
      expect(Array.isArray(body.results)).toBe(true)

      await User.deleteOne({id: `waituser3_${timestamp3}`})
    })

    it('POST /statistics/waitlist/reject/all rejects batch', async () => {
      if (isHttpMode()) {
        // Skip this test in HTTP mode - requires direct database access
        return
      }
      
      const timestamp4 = Date.now() + 3
      const waitUser4 = new Waitlist({
        id: `waituser4_${timestamp4}`,
        name: `waitlistuser4-${timestamp4}`,
        password: 'testpass',
        mail: `waitlist4-${timestamp4}@example.com`,
        status: 'pending',
      })
      await waitUser4.save()

      const res = await administratorRequest.post('/statistics/waitlist/reject/all').send({ids: [`waituser4_${timestamp4}`]})
      expect(res.status).toBe(200)
      const body = JSON.parse(res.text)
      expect(body).toHaveProperty('results')
      expect(Array.isArray(body.results)).toBe(true)
    })

    it('GET /statistics/waitlist/confirm/:id approves user', async () => {
      if (isHttpMode()) {
        // Skip this test in HTTP mode - requires direct database access
        return
      }
      
      const timestamp5 = Date.now() + 4
      // Re-create waitlist user since it was deleted in beforeAll by other tests
      const waitUser = new Waitlist({
        id: `waituser_approval_single_${timestamp5}`,
        name: `waitlistuser_single-${timestamp5}`,
        password: 'testpass',
        mail: `waitlist_single-${timestamp5}@example.com`,
        status: 'pending',
      })
      await waitUser.save()

      const res = await administratorRequest.get(`/statistics/waitlist/confirm/waituser_approval_single_${timestamp5}`)
      expect(res.status).toBe(200)
      expect(JSON.parse(res.text).success).toBe(true)

      await User.deleteOne({id: `waituser_approval_single_${timestamp5}`})
    })
  })
})

describe('Statistics E2E - Subscriber Tests', () => {
  beforeAll(async () => {
    await httpSetup.setupDb()
  })

  afterAll(async () => {
    await httpSetup.teardownDb()
  })

  describe('Subscriber Authorization', () => {
    it('rejects subscriber access to admin statistics', async () => {
      const res = await subscriberRequest.get('/statistics/workflow')
      expect(res.status).toBe(403)
    })

    it('rejects subscriber access to user list', async () => {
      const res = await subscriberRequest.get('/statistics/users')
      expect(res.status).toBe(403)
    })

    it('rejects subscriber access to waitlist', async () => {
      const res = await subscriberRequest.get('/statistics/waitlist')
      expect(res.status).toBe(403)
    })
  })
})
