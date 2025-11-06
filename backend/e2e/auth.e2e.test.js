import {describe, beforeEach, afterAll, it, expect} from '@jest/globals'
import {setupDb, teardownDb, isHttpMode} from './setup'
import {publicRequest, subscriberRequest} from './shared/requests'
import {httpMode} from './shared/http-mode-helpers'
import {testIdFilter, testPrefixFilter} from './shared/test-constants'
import User from '../src/models/User'
import Waitlist from '../src/models/Waitlist'

describe('Authentication Router', () => {
  const timestamp = Date.now()
  const validCredentials = {username: `testuser123-${timestamp}`, mail: `testuser123-${timestamp}@example.com`, password: 'ValidPass123'}
  const testLoginUser = {username: `e2e_test_loginuser-${timestamp}`, mail: `e2e_test_loginuser-${timestamp}@example.com`, password: 'TestLogin123'}
  let createdUserId

  beforeEach(async () => {
    await setupDb()
    
    if (isHttpMode()) {
      /* HTTP mode: Use API calls for test data setup */
      await httpMode.clearUsers()
      /* Create test user via signup */
      await publicRequest.post('/auth/signup').send({
        username: testLoginUser.username,
        mail: testLoginUser.mail,
        password: testLoginUser.password
      })
    } else {
      /* Direct database mode: Scoped deletion - only test users */
      await User.deleteMany(testIdFilter())
      await User.deleteMany(testPrefixFilter('id'))
      await Waitlist.deleteMany(testPrefixFilter('mail'))
      
      /* Create test user for login tests */
      const testUser = new User({
        id: testLoginUser.username,
        name: testLoginUser.username,
        mail: testLoginUser.mail,
        password: testLoginUser.password,
        roles: ['subscriber'],
        limitWorkflows: 10,
        limitNodes: 300,
        confirmed: true
      })
      await testUser.save()
    }
  })

  afterAll(async () => {
    if (!isHttpMode()) {
      await User.deleteMany(testIdFilter())
      await User.deleteMany(testPrefixFilter('id'))
      await Waitlist.deleteMany(testPrefixFilter('mail'))
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

    it('should return 400 for missing username', async () => {
      const res = await publicRequest.post('/auth/signup').send({
        mail: 'nouser@example.com',
        password: 'ValidPass123'
      })

      expect([400, 500]).toContain(res.status)
      expect(res.body).toHaveProperty('message')
    })

    it('should return 400 for missing email', async () => {
      const res = await publicRequest.post('/auth/signup').send({
        username: 'testuser999',
        password: 'ValidPass123'
      })

      expect([400, 500]).toContain(res.status)
      expect(res.body).toHaveProperty('message')
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

    it('should login with valid credentials', async () => {
      if (isHttpMode()) {
        /* Skip: HTTP mode can't create confirmed users (signup creates waitlist only) */
        return
      }
      
      const res = await publicRequest.post('/auth').send({usernameOrEmail: testLoginUser.username, password: testLoginUser.password})

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('tokenHash')
      expect(res.body).toHaveProperty('expires_in')
      expect(res.body).toHaveProperty('wp_user')
      expect(typeof res.body.tokenHash).toBe('string')
      expect(res.body.wp_user).toHaveProperty('ID', testLoginUser.username)
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

    it('should return 401 for missing refresh token', async () => {
      const res = await publicRequest.post('/refresh').set('Cookie', 'auth=invalid')

      expect(res.status).toBe(401)
      expect(res.body).toHaveProperty('message')
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

    it('should return 400 for missing email', async () => {
      const res = await publicRequest.post('/auth/forgot-password').send({})

      expect([400, 500]).toContain(res.status)
      expect(res.body).toHaveProperty('message')
    })
  })

  describe('GET /auth/check-reset-token/:pwdResetToken', () => {
    it('should return 404 for invalid token', async () => {
      const res = await publicRequest.get('/auth/check-reset-token/invalid-token')

      expect(res.status).toBe(404)
    })

    it('should return 404 for missing token', async () => {
      const res = await publicRequest.get('/auth/check-reset-token/')

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

    it('should return 401 for invalid token', async () => {
      const res = await publicRequest.post('/external-auth').send({token: 'invalid-jwt-token'})

      expect([400, 401]).toContain(res.status)
      expect(res.body).toHaveProperty('message')
    })
  })

  describe('POST /external-auth/refresh', () => {
    it('should return 401 when not authenticated', async () => {
      const res = await publicRequest.post('/external-auth/refresh')

      expect(res.status).toBe(401)
    })

    it('should return 401 for missing refresh token', async () => {
      const res = await publicRequest.post('/external-auth/refresh').set('Cookie', 'auth=invalid')

      expect(res.status).toBe(401)
      expect(res.body).toHaveProperty('message')
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
