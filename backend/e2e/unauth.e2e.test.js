import {describe, beforeEach, afterAll, it, expect} from '@jest/globals'
import {setupDb, teardownDb, isHttpMode} from './setup'
import {publicRequest} from './shared/requests'
import Request from 'supertest'
import app from '../src/app'

const rawRequest = isHttpMode() 
  ? new Request(process.env.E2E_SERVER_URL) 
  : new Request(app.callback())

describe('Unauth Router', () => {
  beforeEach(async () => {
    await setupDb()
  })

  afterAll(async () => {
    await teardownDb()
  })

  describe('GET /healthz', () => {
    it('returns health status', async () => {
      const response = await publicRequest.get('/healthz')

      expect(response.status).toBe(200)
    })
  })

  describe('GET /metrics', () => {
    it('returns prometheus metrics', async () => {
      const response = await rawRequest.get('/metrics')

      expect(response.status).toBe(200)
      expect(response.text).toContain('# HELP')
    })
  })
})
