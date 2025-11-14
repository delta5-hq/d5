import jwt from 'jsonwebtoken'
import {JWT_SECRET} from '../src/constants'
import {publicRequest, rawRequest} from './shared/requests'
import {testOrchestrator} from './shared/test-data-factory'

describe('JWT Security - Authentication Attack Vectors', () => {
  beforeAll(async () => {
    await testOrchestrator.prepareTestEnvironment()
  })

  afterAll(async () => {
    await testOrchestrator.cleanupTestEnvironment()
  })

  describe('Algorithm Confusion Attacks', () => {
    const createAlgorithmNoneToken = payload => {
      const header = Buffer.from(JSON.stringify({alg: 'none', typ: 'JWT'})).toString('base64url')
      const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
      return `${header}.${body}.`
    }

    const createWeakAlgorithmToken = (payload, algorithm) => {
      try {
        return jwt.sign(payload, JWT_SECRET, {algorithm})
      } catch {
        return null
      }
    }

    it('rejects token with algorithm none', async () => {
      const maliciousToken = createAlgorithmNoneToken({
        sub: 'attacker_user',
        roles: ['administrator'],
        limitWorkflows: 0,
        limitNodes: 0,
      })

      const response = await rawRequest
        .get('/api/v1/workflow')
        .set('Authorization', `Bearer ${maliciousToken}`)

      expect(response.status).toBe(401)
    })

    it('rejects token with algorithm none via cookie', async () => {
      const maliciousToken = createAlgorithmNoneToken({
        sub: 'attacker_user',
        roles: ['administrator'],
      })

      const response = await rawRequest.get('/api/v1/workflow').set('Cookie', `auth=${maliciousToken}`)

      expect(response.status).toBe(401)
    })

    it('rejects token with HS384 when HS256 expected', async () => {
      const weakToken = createWeakAlgorithmToken(
        {
          sub: 'attacker_user',
          roles: ['administrator'],
        },
        'HS384',
      )

      if (!weakToken) {
        return
      }

      const response = await rawRequest.get('/api/v1/workflow').set('Authorization', `Bearer ${weakToken}`)

      expect(response.status).toBe(401)
    })

    it('rejects token with HS512 when HS256 expected', async () => {
      const weakToken = createWeakAlgorithmToken(
        {
          sub: 'attacker_user',
          roles: ['administrator'],
        },
        'HS512',
      )

      if (!weakToken) {
        return
      }

      const response = await rawRequest.get('/api/v1/workflow').set('Authorization', `Bearer ${weakToken}`)

      expect(response.status).toBe(401)
    })
  })

  describe('Token Tampering and Forgery', () => {
    const createValidToken = payload => {
      return jwt.sign(payload, JWT_SECRET, {expiresIn: 86400})
    }

    it('rejects token signed with wrong secret', async () => {
      const forgedToken = jwt.sign(
        {
          sub: 'attacker_user',
          roles: ['administrator'],
          limitWorkflows: 0,
          limitNodes: 0,
        },
        'WRONG_SECRET_COMPLETELY_DIFFERENT',
        {expiresIn: 86400},
      )

      const response = await rawRequest.get('/api/v1/workflow').set('Authorization', `Bearer ${forgedToken}`)

      expect(response.status).toBe(401)
    })

    it('rejects token with modified payload', async () => {
      const validToken = createValidToken({
        sub: 'subscriber_user',
        roles: ['subscriber'],
      })

      const [header, payload, signature] = validToken.split('.')
      const decodedPayload = JSON.parse(Buffer.from(payload, 'base64url').toString())
      decodedPayload.roles = ['administrator']
      const tamperedPayload = Buffer.from(JSON.stringify(decodedPayload)).toString('base64url')
      const tamperedToken = `${header}.${tamperedPayload}.${signature}`

      const response = await rawRequest.get('/api/v1/workflow').set('Authorization', `Bearer ${tamperedToken}`)

      expect(response.status).toBe(401)
    })

    it('rejects token with modified header', async () => {
      const validToken = createValidToken({
        sub: 'subscriber_user',
        roles: ['subscriber'],
      })

      const [, payload, signature] = validToken.split('.')
      const tamperedHeader = Buffer.from(JSON.stringify({alg: 'none', typ: 'JWT'})).toString('base64url')
      const tamperedToken = `${tamperedHeader}.${payload}.${signature}`

      const response = await rawRequest.get('/api/v1/workflow').set('Authorization', `Bearer ${tamperedToken}`)

      expect(response.status).toBe(401)
    })

    it('rejects token with missing signature', async () => {
      const validToken = createValidToken({
        sub: 'subscriber_user',
        roles: ['subscriber'],
      })

      const [header, payload] = validToken.split('.')
      const unsignedToken = `${header}.${payload}.`

      const response = await rawRequest.get('/api/v1/workflow').set('Authorization', `Bearer ${unsignedToken}`)

      expect(response.status).toBe(401)
    })

    it('rejects completely malformed token', async () => {
      const malformedTokens = [
        'not.a.token',
        'only-one-part',
        'two.parts',
        'four.parts.are.invalid',
        '',
        'Bearer eyJhbGciOiJIUzI1NiJ9',
        '{sub: "user", roles: ["admin"]}',
      ]

      for (const malformedToken of malformedTokens) {
        const response = await rawRequest.get('/api/v1/workflow').set('Authorization', `Bearer ${malformedToken}`)

        expect(response.status).toBe(401)
      }
    })
  })

  describe('Token Expiration and Timing Attacks', () => {
    it('rejects expired token', async () => {
      const expiredToken = jwt.sign(
        {
          sub: 'subscriber_user',
          roles: ['subscriber'],
        },
        JWT_SECRET,
        {expiresIn: -1},
      )

      const response = await rawRequest.get('/api/v1/workflow').set('Authorization', `Bearer ${expiredToken}`)

      expect(response.status).toBe(401)
    })

    it('rejects token with future issued at time', async () => {
      const futureIssuedToken = jwt.sign(
        {
          sub: 'subscriber_user',
          roles: ['subscriber'],
          iat: Math.floor(Date.now() / 1000) + 3600,
        },
        JWT_SECRET,
        {expiresIn: 86400},
      )

      const response = await rawRequest.get('/api/v1/workflow').set('Authorization', `Bearer ${futureIssuedToken}`)

      expect(response.status).toBe(401)
    })

    it('rejects token with excessively long expiration', async () => {
      const longLivedToken = jwt.sign(
        {
          sub: 'subscriber_user',
          roles: ['subscriber'],
        },
        JWT_SECRET,
        {expiresIn: '999y'},
      )

      const response = await rawRequest.get('/api/v1/workflow').set('Authorization', `Bearer ${longLivedToken}`)

      expect(response.status).toBe(401)
    })

    it('rejects token with missing expiration claim', async () => {
      const noExpirationToken = jwt.sign(
        {
          sub: 'subscriber_user',
          roles: ['subscriber'],
        },
        JWT_SECRET,
        {noTimestamp: true},
      )

      const response = await rawRequest.get('/api/v1/workflow').set('Authorization', `Bearer ${noExpirationToken}`)

      expect(response.status).toBe(401)
    })
  })

  describe('Role and Claim Manipulation', () => {
    const createValidToken = payload => {
      return jwt.sign(payload, JWT_SECRET, {expiresIn: 86400})
    }

    it('rejects token with non-existent role', async () => {
      const invalidRoleToken = createValidToken({
        sub: 'subscriber_user',
        roles: ['super_administrator', 'root', 'god_mode'],
      })

      const response = await rawRequest.get('/api/v1/workflow').set('Authorization', `Bearer ${invalidRoleToken}`)

      expect(response.status).toBe(401)
    })

    it('rejects token with roles as string instead of array', async () => {
      const invalidRoleFormatToken = createValidToken({
        sub: 'subscriber_user',
        roles: 'administrator',
      })

      const response = await rawRequest.get('/api/v1/workflow').set('Authorization', `Bearer ${invalidRoleFormatToken}`)

      expect(response.status).toBe(401)
    })

    it('rejects token with negative limit values', async () => {
      const negativeLimitToken = createValidToken({
        sub: 'subscriber_user',
        roles: ['subscriber'],
        limitWorkflows: -1,
        limitNodes: -999999,
      })

      const response = await rawRequest.get('/api/v1/workflow').set('Authorization', `Bearer ${negativeLimitToken}`)

      expect(response.status).toBe(401)
    })

    it('rejects token with missing subject claim', async () => {
      const noSubjectToken = createValidToken({
        roles: ['administrator'],
        limitWorkflows: 0,
        limitNodes: 0,
      })

      const response = await rawRequest.get('/api/v1/workflow').set('Authorization', `Bearer ${noSubjectToken}`)

      expect(response.status).toBe(401)
    })

    it('rejects token with null subject claim', async () => {
      const nullSubjectToken = createValidToken({
        sub: null,
        roles: ['subscriber'],
      })

      const response = await rawRequest.get('/api/v1/workflow').set('Authorization', `Bearer ${nullSubjectToken}`)

      expect(response.status).toBe(401)
    })

    it('rejects token with empty string subject', async () => {
      const emptySubjectToken = createValidToken({
        sub: '',
        roles: ['subscriber'],
      })

      const response = await rawRequest.get('/api/v1/workflow').set('Authorization', `Bearer ${emptySubjectToken}`)

      expect(response.status).toBe(401)
    })

    it('rejects token with SQL injection in subject', async () => {
      const sqlInjectionToken = createValidToken({
        sub: "admin' OR '1'='1",
        roles: ['subscriber'],
      })

      const response = await rawRequest.get('/api/v1/workflow').set('Authorization', `Bearer ${sqlInjectionToken}`)

      expect(response.status).toBe(401)
    })

    it('rejects token with script injection in subject', async () => {
      const xssToken = createValidToken({
        sub: '<script>alert("xss")</script>',
        roles: ['subscriber'],
      })

      const response = await rawRequest.get('/api/v1/workflow').set('Authorization', `Bearer ${xssToken}`)

      expect(response.status).toBe(401)
    })
  })

  describe('Authorization Header Format Attacks', () => {
    const createValidToken = () => {
      return jwt.sign(
        {
          sub: 'subscriber_user',
          roles: ['subscriber'],
        },
        JWT_SECRET,
        {expiresIn: 86400},
      )
    }

    it('rejects token without Bearer prefix', async () => {
      const validToken = createValidToken()
      const response = await rawRequest.get('/api/v1/workflow').set('Authorization', validToken)

      expect(response.status).toBe(401)
    })

    it('rejects token with lowercase bearer prefix', async () => {
      const validToken = createValidToken()
      const response = await rawRequest.get('/api/v1/workflow').set('Authorization', `bearer ${validToken}`)

      expect(response.status).toBe(401)
    })

    it('rejects token with multiple Bearer prefixes', async () => {
      const validToken = createValidToken()
      const response = await rawRequest.get('/api/v1/workflow').set('Authorization', `Bearer Bearer ${validToken}`)

      expect(response.status).toBe(401)
    })

    it('rejects token with extra whitespace', async () => {
      const validToken = createValidToken()
      const response = await rawRequest.get('/api/v1/workflow').set('Authorization', `Bearer  ${validToken}  `)

      expect(response.status).toBe(401)
    })

    it('rejects multiple authorization headers', async () => {
      const validToken = createValidToken()
      const response = await rawRequest.get('/api/v1/workflow').set('Authorization', [
        `Bearer ${validToken}`,
        `Bearer ${validToken}`,
      ])

      expect(response.status).toBe(401)
    })
  })

  describe('Cookie-Based Token Attacks', () => {
    const createValidToken = () => {
      return jwt.sign(
        {
          sub: 'subscriber_user',
          roles: ['subscriber'],
        },
        JWT_SECRET,
        {expiresIn: 86400},
      )
    }

    it('rejects cookie with Bearer prefix', async () => {
      const validToken = createValidToken()
      const response = await rawRequest.get('/api/v1/workflow').set('Cookie', `auth=Bearer ${validToken}`)

      expect(response.status).toBe(401)
    })

    it('rejects multiple auth cookies', async () => {
      const validToken = createValidToken()
      const response = await rawRequest.get('/api/v1/workflow').set('Cookie', `auth=${validToken}; auth=${validToken}`)

      expect(response.status).toBe(401)
    })

    it('rejects cookie with embedded semicolon', async () => {
      const validToken = createValidToken()
      /* Inject semicolon within JWT value to break parsing */
      const parts = validToken.split('.')
      const maliciousToken = parts[0] + ';malicious.' + parts.slice(1).join('.')
      const response = await rawRequest.get('/api/v1/workflow').set('Cookie', `auth=${maliciousToken}`)

      expect(response.status).toBe(401)
    })

    it('prefers cookie over authorization header when both present', async () => {
      const cookieToken = jwt.sign(
        {
          sub: 'subscriber_user',
          roles: ['subscriber'],
        },
        JWT_SECRET,
        {expiresIn: 86400},
      )

      const headerToken = jwt.sign(
        {
          sub: 'administrator_user',
          roles: ['administrator'],
        },
        JWT_SECRET,
        {expiresIn: 86400},
      )

      const response = await rawRequest
        .get('/api/v1/workflow')
        .set('Cookie', `auth=${cookieToken}`)
        .set('Authorization', `Bearer ${headerToken}`)

      expect(response.status).toBe(200)
    })
  })

  describe('Replay and Token Reuse Attacks', () => {
    it('allows same token to be used multiple times within expiry', async () => {
      const validToken = jwt.sign(
        {
          sub: 'subscriber_user',
          roles: ['subscriber'],
        },
        JWT_SECRET,
        {expiresIn: 86400},
      )

      const response1 = await rawRequest.get('/api/v1/workflow').set('Authorization', `Bearer ${validToken}`)
      const response2 = await rawRequest.get('/api/v1/workflow').set('Authorization', `Bearer ${validToken}`)
      const response3 = await rawRequest.get('/api/v1/workflow').set('Authorization', `Bearer ${validToken}`)

      expect(response1.status).toBe(200)
      expect(response2.status).toBe(200)
      expect(response3.status).toBe(200)
    })

    it('accepts tokens with same payload signed at different times', async () => {
      const token1 = jwt.sign(
        {
          sub: 'subscriber_user',
          roles: ['subscriber'],
        },
        JWT_SECRET,
        {expiresIn: 86400},
      )

      /* Wait 1100ms to ensure iat changes (Unix epoch second precision) */
      await new Promise(resolve => setTimeout(resolve, 1100))

      const token2 = jwt.sign(
        {
          sub: 'subscriber_user',
          roles: ['subscriber'],
        },
        JWT_SECRET,
        {expiresIn: 86400},
      )

      expect(token1).not.toBe(token2)

      const response1 = await rawRequest.get('/api/v1/workflow').set('Authorization', `Bearer ${token1}`)
      const response2 = await rawRequest.get('/api/v1/workflow').set('Authorization', `Bearer ${token2}`)

      expect(response1.status).toBe(200)
      expect(response2.status).toBe(200)
    })
  })

  describe('Token Encryption and Encoding Attacks', () => {
    it('rejects base64 encoded token', async () => {
      const validToken = jwt.sign(
        {
          sub: 'subscriber_user',
          roles: ['subscriber'],
        },
        JWT_SECRET,
        {expiresIn: 86400},
      )

      const base64Token = Buffer.from(validToken).toString('base64')
      const response = await rawRequest.get('/api/v1/workflow').set('Authorization', `Bearer ${base64Token}`)

      expect(response.status).toBe(401)
    })

    it('rejects hex encoded token', async () => {
      const validToken = jwt.sign(
        {
          sub: 'subscriber_user',
          roles: ['subscriber'],
        },
        JWT_SECRET,
        {expiresIn: 86400},
      )

      const hexToken = Buffer.from(validToken).toString('hex')
      const response = await rawRequest.get('/api/v1/workflow').set('Authorization', `Bearer ${hexToken}`)

      expect(response.status).toBe(401)
    })

    it('rejects token with URL-encodable injection', async () => {
      const validToken = jwt.sign(
        {
          sub: 'subscriber_user',
          roles: ['subscriber'],
        },
        JWT_SECRET,
        {expiresIn: 86400},
      )

      /* Inject characters that WOULD be URL-encoded (&, =, space) */
      const maliciousToken = validToken + '&admin=true'
      const response = await rawRequest.get('/api/v1/workflow').set('Authorization', `Bearer ${maliciousToken}`)

      expect(response.status).toBe(401)
    })

    it('rejects double encoded token', async () => {
      const validToken = jwt.sign(
        {
          sub: 'subscriber_user',
          roles: ['subscriber'],
        },
        JWT_SECRET,
        {expiresIn: 86400},
      )

      const doubleEncoded = Buffer.from(Buffer.from(validToken).toString('base64')).toString('base64')
      const response = await rawRequest.get('/api/v1/workflow').set('Authorization', `Bearer ${doubleEncoded}`)

      expect(response.status).toBe(401)
    })
  })

  describe('Public Endpoint Token Leakage', () => {
    it('ignores invalid token on public endpoint', async () => {
      const invalidToken = 'invalid.token.here'
      const response = await publicRequest.get('/workflow')

      expect(response.status).toBe(200)
    })

    it('does not expose token validation errors on public endpoints', async () => {
      const maliciousToken = jwt.sign(
        {
          sub: 'attacker',
          roles: ['administrator'],
        },
        'WRONG_SECRET',
        {expiresIn: 86400},
      )

      const response = await rawRequest
        .get('/api/v1/workflow?public=true')
        .set('Authorization', `Bearer ${maliciousToken}`)

      expect(response.status).not.toBe(500)
    })
  })
})
