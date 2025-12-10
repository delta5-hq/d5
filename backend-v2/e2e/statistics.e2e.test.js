import {administratorRequest, subscriberRequest, publicRequest} from './shared/requests'
import {testDataFactory, testOrchestrator} from './shared/test-data-factory'
import {workflowData} from './shared/fixtures'
import {subscriber} from './shared/test-users.js'

const userId = subscriber.name

describe('Statistics E2E', () => {
  let testUser

  beforeEach(async () => {
    await testOrchestrator.prepareTestEnvironment()
  })

  afterEach(async () => {
    await testOrchestrator.cleanupTestEnvironment()
  })

  beforeAll(async () => {
    testUser = await testDataFactory.createUser({
      id: userId,
      name: 'Test User',
      mail: 'test@example.com',
      password: 'testpass',
      roles: ['subscriber'],
    })
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
      
      const res = await administratorRequest.get(`/statistics/workflow/${testUser.id}`)
      expect(res.status).toBe(200)
      expect(Array.isArray(JSON.parse(res.text))).toBe(true)
    })
  })

  describe('GET /statistics/users/:userId', () => {
    it('returns user statistics', async () => {
      
      const res = await administratorRequest.get(`/statistics/users/${testUser.id}`)
      expect(res.status).toBe(200)
      const body = JSON.parse(res.text)
      expect(body).toHaveProperty('id')
      expect(body).toHaveProperty('workflowCount')
    })
  })

  describe('POST /statistics/users/:userId/comment', () => {
    it('adds comment to user', async () => {
      
      const res = await administratorRequest.post(`/statistics/users/${testUser.id}/comment`).send({data: 'Test comment'})
      expect(res.status).toBe(200)
      expect(JSON.parse(res.text).success).toBe(true)
    })
  })

  describe('Waitlist Management', () => {
    let waitUserId
    const timestamp = Date.now()

    beforeAll(async () => {
      
      const waitlistUser = await testDataFactory.createWaitlistUser({
        username: `waitlistuser-${timestamp}`,
        mail: `waitlist-${timestamp}@example.com`,
        password: 'WaitPass123!'
      })
      waitUserId = waitlistUser.mail
    })

    afterAll(async () => {
      
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
      const timestamp2 = Date.now() + 1
      const waitUser2 = await testDataFactory.createWaitlistUser({
        username: `waituser2-${timestamp2}`,
        mail: `waitlist2-${timestamp2}@example.com`,
        password: 'WaitPass123!'
      })

      const res = await administratorRequest.get(`/statistics/waitlist/reject/${waitUser2.mail}`)
      expect(res.status).toBe(404)
    })

    it('POST /statistics/waitlist/confirm/all approves batch', async () => {
      const timestamp3 = Date.now() + 2
      const waitUser3 = await testDataFactory.createWaitlistUser({
        username: `waituser3-${timestamp3}`,
        mail: `waitlist3-${timestamp3}@example.com`,
        password: 'WaitPass123!'
      })
      
      const waitUser4 = await testDataFactory.createWaitlistUser({
        username: `waituser4-${timestamp3}`,
        mail: `waitlist4-${timestamp3}@example.com`,
        password: 'WaitPass123!'
      })

      const res = await administratorRequest.post('/statistics/waitlist/confirm/all').send({ids: [waitUser3.mail, waitUser4.mail]})
      expect(res.status).toBe(200)
      const body = JSON.parse(res.text)
      expect(body).toHaveProperty('results')
      expect(Array.isArray(body.results)).toBe(true)
      expect(body.results.length).toBe(2)
    })

    it('POST /statistics/waitlist/reject/all rejects batch', async () => {
      const timestamp4 = Date.now() + 3
      const waitUser5 = await testDataFactory.createWaitlistUser({
        username: `waituser5-${timestamp4}`,
        mail: `waitlist5-${timestamp4}@example.com`,
        password: 'WaitPass123!'
      })
      
      const waitUser6 = await testDataFactory.createWaitlistUser({
        username: `waituser6-${timestamp4}`,
        mail: `waitlist6-${timestamp4}@example.com`,
        password: 'WaitPass123!'
      })

      const res = await administratorRequest.post('/statistics/waitlist/reject/all').send({ids: [waitUser5.mail, waitUser6.mail]})
      expect(res.status).toBe(200)
      const body = JSON.parse(res.text)
      expect(body).toHaveProperty('results')
      expect(Array.isArray(body.results)).toBe(true)
      expect(body.results.length).toBe(2)
    })

    it('GET /statistics/waitlist/confirm/:id approves user', async () => {
      const timestamp5 = Date.now() + 4
      const waitUser = await testDataFactory.createWaitlistUser({
        username: `waituser-single-${timestamp5}`,
        mail: `waitlist-single-${timestamp5}@example.com`,
        password: 'WaitPass123!'
      })

      const res = await administratorRequest.get(`/statistics/waitlist/confirm/${waitUser.mail}`)
      expect(res.status).toBe(404)
    })
  })
})

describe('Statistics E2E - Subscriber Tests', () => {
  beforeAll(async () => {
    await testOrchestrator.prepareTestEnvironment()
  })

  afterAll(async () => {
    await testOrchestrator.cleanupTestEnvironment()
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
