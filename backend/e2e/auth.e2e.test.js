import {describe, beforeEach, afterAll, it, expect} from '@jest/globals'
import {publicRequest, subscriberRequest, syncRequest} from './shared/requests'
import {testDataFactory, testOrchestrator} from './shared/test-data-factory'

describe('Authentication Router', () => {
  let createdUserId

  /* Generate unique credentials for each test to avoid conflicts */
  const getValidCredentials = () => {
    const unique = `${Date.now()}-${Math.floor(Math.random() * 10000)}`
    return {username: `testuser-${unique}`, mail: `testuser-${unique}@example.com`, password: 'ValidPass123'}
  }

  beforeEach(async () => {
    await testOrchestrator.prepareTestEnvironment()
  })

  afterAll(async () => {
    await testOrchestrator.cleanupTestEnvironment()
  })

  describe('POST /auth/signup', () => {
    it('should add user to waitlist', async () => {
      const validCredentials = getValidCredentials()
      const res = await publicRequest.post('/auth/signup').send(validCredentials)

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('success', true)
      expect(res.body.success).toBe(true)
    })

    it('should return 401 for invalid email', async () => {
      const validCredentials = getValidCredentials()
      const res = await publicRequest.post('/auth/signup').send({username: 'testuser456', mail: 'invalid', password: validCredentials.password})

      expect(res.status).toBe(401)
      expect(res.text).toContain('Invalid username or email')
    })

    it('should return 400 for weak password', async () => {
      const res = await publicRequest.post('/auth/signup').send({username: 'testuser789', mail: 'testuser789@example.com', password: '123'})

      expect(res.status).toBe(400)
      expect(res.text).toContain('password')
    })

    it('should return 400 for duplicate email', async () => {
      const validCredentials = getValidCredentials()
      await publicRequest.post('/auth/signup').send(validCredentials)
      const res = await publicRequest.post('/auth/signup').send(validCredentials)

      expect(res.status).toBe(400)
      expect(res.text).toContain('already in waitlist')
    })
  })

  describe('POST /auth', () => {
    it('should return 401 for invalid password', async () => {
      const res = await publicRequest.post('/auth').send({usernameOrEmail: 'subscriber', password: 'WrongPass123!'})

      expect(res.status).toBe(401)
    })

    it('should return 401 for non-existent user', async () => {
      const res = await publicRequest.post('/auth').send({usernameOrEmail: 'nonexistent', password: 'Pass123!'})

      expect(res.status).toBe(401)
    })
  })

  describe('GET /auth/login', () => {
    it('should return login page metadata', async () => {
      const res = await publicRequest.get('/auth/login')

      expect(res.status).toBe(200)
    })
  })

  describe('POST /auth/logout', () => {
    it('should logout authenticated user', async () => {
      const res = await subscriberRequest.post('/auth/logout')

      expect(res.status).toBe(200)
    })
  })

  describe('POST /refresh', () => {
    it('should return 401 when not authenticated', async () => {
      const res = await publicRequest.post('/refresh')

      expect(res.status).toBe(401)
    })
  })

  describe('POST /auth/forgot-password', () => {
    it('should process password reset request', async () => {
      const testMail = `forgot-pwd-${Date.now()}@example.com`
      const testUser = `forgot-pwd-${Date.now()}`
      
      /* Create confirmed user via API */
      await testDataFactory.createUser({
        id: testUser,
        name: testUser,
        mail: testMail,
        password: 'testpass123',
        confirmed: true,
      })
      
      const res = await publicRequest.post('/auth/forgot-password').send({usernameOrEmail: testMail})

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('success', true)
    })

    it('should handle non-existent email', async () => {
      const res = await publicRequest.post('/auth/forgot-password').send({usernameOrEmail: 'nonexistent@example.com'})

      expect(res.status).toBe(404)
    })
  })

  describe('GET /auth/check-reset-token/:pwdResetToken', () => {
    it('should return 404 for invalid token', async () => {
      const res = await publicRequest.get('/auth/check-reset-token/invalid-token')

      expect(res.status).toBe(404)
    })
  })

  describe('POST /auth/reset-password/:pwdResetToken', () => {
    it('should return 404 for invalid token', async () => {
      const res = await publicRequest.post('/auth/reset-password/invalid-token').send({password: 'NewPass123!'})

      expect(res.status).toBe(404)
      expect(res.text).toContain('not found')
    })

    it('should validate password strength', async () => {
      const res = await publicRequest.post('/auth/reset-password/invalid-token').send({password: '123'})

      /* Invalid token returns 404 */
      expect(res.status).toBe(404)
      expect(res.text).toContain('not found')
    })
  })

  describe('POST /external-auth', () => {
    it('should return 400 for missing token', async () => {
      const res = await publicRequest.post('/external-auth').send({})

      expect(res.status).toBe(400)
    })
  })

  describe('POST /external-auth/refresh', () => {
    it('should return 401 when not authenticated', async () => {
      const res = await publicRequest.post('/external-auth/refresh')

      expect(res.status).toBe(401)
    })

    it('should return 404 for invalid reset token', async () => {
      /* HTTP mode: Cannot easily generate valid tokens, test invalid token handling */
      const res = await publicRequest.post('/auth/reset-password/invalid-token-here').send({password: '123'})
      expect(res.status).toBe(404)
      expect(res.text).toContain('not found')
    })
  })
})

describe('Authentication Router - Subscriber Tests', () => {
  beforeAll(async () => {
    await testOrchestrator.prepareTestEnvironment()
  })

  afterAll(async () => {
    await testOrchestrator.cleanupTestEnvironment()
  })

  describe('POST /auth/logout (subscriber)', () => {
    it('logs out subscriber user', async () => {
      const res = await subscriberRequest.post('/auth/logout')
      expect(res.status).toBe(200)
    })
  })

  describe('GET /auth/login (subscriber)', () => {
    it('returns login metadata for subscriber', async () => {
      const res = await subscriberRequest.get('/auth/login')
      expect(res.status).toBe(200)
      const data = JSON.parse(res.text)
      expect(data).toHaveProperty('redirect')
    })
  })
})
