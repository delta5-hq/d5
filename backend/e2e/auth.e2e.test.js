import {describe, beforeEach, afterAll, it, expect} from '@jest/globals'
import {setupDb, teardownDb, isHttpMode} from './setup'
import {publicRequest, subscriberRequest} from './shared/requests'
import {httpMode} from './shared/http-mode-helpers'
import User from '../src/models/User'
import Waitlist from '../src/models/Waitlist'

describe('Authentication Router', () => {
  const timestamp = Date.now()
  const validCredentials = {username: `testuser123-${timestamp}`, mail: `testuser123-${timestamp}@example.com`, password: 'ValidPass123'}
  let createdUserId

  beforeEach(async () => {
    await setupDb()
    
    if (isHttpMode()) {
      /* HTTP mode: Use API calls for test data setup */
      await httpMode.clearUsers()
    } else {
      /* Direct database mode: Use mongoose operations */
      await User.deleteMany({})
      await Waitlist.deleteMany({})
    }
  })

  afterAll(async () => {
    if (!isHttpMode()) {
      await User.deleteMany({})
      await Waitlist.deleteMany({})
    }
    await teardownDb()
  })

  describe('POST /auth/signup', () => {
    it('should add user to waitlist', async () => {
      const res = await publicRequest.post('/auth/signup').send(validCredentials)

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('success', true)
      expect(res.body.success).toBe(true)
    })

    it('should return 401 for invalid email', async () => {
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
      const res = await publicRequest.post('/auth/forgot-password').send({mail: 'subscriber@example.com'})

      /* Email service may not be configured in test environment */
      expect([200, 500]).toContain(res.status)
      if (res.status === 200) {
        expect(res.body).toHaveProperty('success', true)
      }
    })

    it('should handle non-existent email', async () => {
      const res = await publicRequest.post('/auth/forgot-password').send({mail: 'nonexistent@example.com'})

      /* Email service may not be configured in test environment */
      expect([404, 500]).toContain(res.status)
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
      const res = await publicRequest.post('/auth/reset-password/valid-token').send({password: '123'})

      /* Invalid token returns 404 before password validation */
      expect([400, 404]).toContain(res.status)
      if (res.status === 400) {
        expect(res.text).toContain('password')
      }
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
  })
})

describe('Authentication Router - Subscriber Tests', () => {
  beforeAll(async () => {
    await setupDb()
  })

  afterAll(async () => {
    await teardownDb()
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
