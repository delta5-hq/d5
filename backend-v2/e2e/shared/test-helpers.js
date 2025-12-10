import request from 'supertest'
import Request from 'supertest'
import jwt from 'jsonwebtoken'
import {generateAuth} from './generate-auth.js'

const API_BASE_PATH = process.env.E2E_API_BASE_PATH || '/api/v1'

function createAppRequest() {
  return process.env.E2E_SERVER_URL
    ? new Request(process.env.E2E_SERVER_URL)
    : new Request('http://localhost:3002')
}

export function createAuthenticatedRequest(user) {
  const userHandler = {
    get: (obj, prop) => url =>
      obj[prop](`${API_BASE_PATH}${url}`).set('Authorization', `Bearer ${generateAuth(user).access_token}`),
  }
  return new Proxy(createAppRequest(), userHandler)
}

export const createTestUser = async (db, overrides = {}) => {
  const defaultUser = {
    email: `test-${Date.now()}@example.com`,
    username: `testuser-${Date.now()}`,
    password: 'TestPassword123!',
    isVerified: true,
    role: 'user',
    createdAt: new Date(),
    ...overrides
  }
  
  const result = await db.collection('users').insertOne(defaultUser)
  return {
    ...defaultUser,
    _id: result.insertedId
  }
}

export const createAdminUser = async (db) => {
  return createTestUser(db, {
    role: 'admin',
    email: `admin-${Date.now()}@example.com`,
    username: `admin-${Date.now()}`
  })
}

export const loginUser = async (app, email, password) => {
  const response = await request(app)
    .post('/api/auth/login')
    .send({email, password})
    .expect(200)
  
  return response.body.token
}

export const createAuthHeaders = (token) => {
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
}

export const createMultipartHeaders = (token) => {
  return {
    'Authorization': `Bearer ${token}`
    // Content-Type will be set automatically by supertest for multipart
  }
}

export const decodeToken = (token) => {
  return jwt.decode(token)
}

export const waitForAsync = (ms = 100) => {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Unified response expectation utilities
export const expectError = (response, statusCode, errorCode = null) => {
  expect(response.status).toBe(statusCode)
  expect(response.body).toHaveProperty('error')
  
  if (errorCode) {
    expect(response.body.error).toMatch(new RegExp(errorCode, 'i'))
  }
}

export const expectSuccess = (response, statusCode = 200) => {
  expect(response.status).toBe(statusCode)
  expect(response.body).not.toHaveProperty('error')
}

export const expectValidationError = (response, field = null) => {
  expect(response.status).toBe(400)
  expect(response.body).toHaveProperty('error')
  
  if (field) {
    expect(response.body.error.toLowerCase()).toContain(field.toLowerCase())
  }
}

export const expectUnauthorized = (response) => {
  expect(response.status).toBe(401)
  expect(response.body).toHaveProperty('error')
  expect(response.body.error.toLowerCase()).toContain('unauthorized')
}

export const expectForbidden = (response) => {
  expect(response.status).toBe(403)
  expect(response.body).toHaveProperty('error')
  expect(response.body.error.toLowerCase()).toContain('forbidden')
}

export const expectNotFound = (response) => {
  expect(response.status).toBe(404)
  expect(response.body).toHaveProperty('error')
  expect(response.body.error.toLowerCase()).toContain('not found')
}

// Database utilities
export const cleanupDatabase = async (db, collections = ['users', 'files', 'sessions']) => {
  for (const collection of collections) {
    await db.collection(collection).deleteMany({})
  }
}

export const createTestSession = async (db, userId, overrides = {}) => {
  const session = {
    userId,
    token: jwt.sign({userId}, process.env.JWT_SECRET),
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    ...overrides
  }
  
  const result = await db.collection('sessions').insertOne(session)
  return {
    ...session,
    _id: result.insertedId
  }
}

// Test factory patterns for protected endpoints
export const testUnauthorizedAccess = (description, requestFn) => {
  it(`should return 401 when not authenticated - ${description}`, async () => {
    const res = await requestFn()
    expectUnauthorized(res)
  })
}

export const testForbiddenAccess = (description, requestFn) => {
  it(`should return 403 when insufficient permissions - ${description}`, async () => {
    const res = await requestFn()
    expectForbidden(res)
  })
}

export const testProtectedEndpoint = (description, {unauthRequest, subscriberRequest, method, path, body = null}) => {
  describe(`${method.toUpperCase()} ${path}`, () => {
    testUnauthorizedAccess(description, () => {
      const req = unauthRequest[method](path)
      return body ? req.send(body) : req
    })

    if (subscriberRequest) {
      testForbiddenAccess(description, () => {
        const req = subscriberRequest[method](path)
        return body ? req.send(body) : req
      })
    }
  })
}