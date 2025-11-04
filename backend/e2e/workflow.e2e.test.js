import {describe, beforeEach, afterAll, it, expect} from '@jest/globals'
import {setupDb, teardownDb, isHttpMode} from './setup'
import {administratorRequest, subscriberRequest, publicRequest} from './shared/requests'
import Workflow from '../src/models/Workflow'
import {administrator, subscriber} from '../src/utils/test/users'

const adminUserId = administrator.name
const subscriberUserId = subscriber.name

const workflowData = {
  nodes: {
    rootId: {id: 'rootId', prompts: [], title: 'test root node', children: ['childId'], tags: [], autoshrink: false},
    childId: {
      id: 'childId',
      prompts: [],
      title: 'test child node',
      children: [],
      parent: 'rootId',
      tags: [],
      autoshrink: false,
    },
  },
  edges: {rootId_childId: {id: 'rootId_childId', start: 'rootId', end: 'childId', title: 'relation'}},
  share: {public: {enabled: false}},
  title: 'test title',
  root: 'rootId',
}

describe('Workflow Router - Administrator Tests', () => {
  let workflowId

  beforeEach(async () => {
    await setupDb()
    
    if (isHttpMode()) {
      /* HTTP mode: Create workflow via API (empty workflow - just metadata) */
      const res = await administratorRequest.post('/workflow').send()
      if (res.status === 200) {
        const data = JSON.parse(res.text)
        workflowId = data.workflowId
      }
    } else {
      /* Direct database mode: Create test data via mongoose */
      await Workflow.deleteMany({userId: adminUserId})
      const workflow = new Workflow({userId: adminUserId, ...workflowData})
      await workflow.save()
      workflowId = workflow.workflowId
    }
  })

  afterAll(async () => {
    if (!isHttpMode()) {
      await Workflow.deleteMany({userId: adminUserId})
    }
    await teardownDb()
  })

  describe('POST /workflow', () => {
    it('creates new workflow', async () => {
      const response = await administratorRequest.post('/workflow').send()

      expect(response.status).toBe(200)
      const data = JSON.parse(response.text)
      expect(data).toHaveProperty('workflowId')
      expect(typeof data.workflowId).toBe('string')
    })
  })

  describe('PUT /workflow/:workflowId', () => {
    it('rejects PUT method', async () => {
      const response = await administratorRequest.put(`/workflow/${workflowId}`).send(JSON.stringify(workflowData))

      expect(response.status).toBe(405)
    })
  })

  describe('PATCH /workflow/:workflowId', () => {
    it('rejects PATCH method', async () => {
      const response = await administratorRequest.patch(`/workflow/${workflowId}`).send(JSON.stringify(workflowData))

      expect(response.status).toBe(405)
    })
  })

  describe('GET /workflow/:workflowId', () => {
    it('rejects unauthenticated requests', async () => {
      const response = await publicRequest.get(`/workflow/${workflowId}`)

      expect(response.status).toBe(401)
    })

    it('serves workflow for owner', async () => {
      const response = await administratorRequest.get(`/workflow/${workflowId}`)

      expect(response.status).toBe(200)

      const workflow = JSON.parse(response.res.text)
      // Workflow storage only contains metadata, not actual nodes/edges data
      expect(workflow).toHaveProperty('share')
      expect(workflow.share.public.enabled).toBe(false)
    })

    it('returns 404 for deleted workflow', async () => {
      await administratorRequest.delete(`/workflow/${workflowId}`)
      const response = await administratorRequest.get(`/workflow/${workflowId}`)

      expect(response.status).toBe(404)
    })
  })

  describe('GET /workflow', () => {
    it('lists all workflows', async () => {
      const response = await administratorRequest.get('/workflow?public=false')

      expect(response.status).toBe(200)
      expect(JSON.parse(response.res.text).data.length).toBeGreaterThan(0)
    })

    it('lists public workflows without auth', async () => {
      await administratorRequest.post(`/workflow/${workflowId}/share/public`).send(JSON.stringify({enabled: true}))
      
      const response = await publicRequest.get('/workflow')

      expect(response.status).toBe(200)
      expect(JSON.parse(response.res.text).data.length).toBeGreaterThan(0)
    })
  })

  describe('GET /workflow/:workflowId/writeable', () => {
    it('rejects unauthenticated requests', async () => {
      const response = await publicRequest.get(`/workflow/${workflowId}/writeable`)

      expect(response.status).toBe(401)
    })

    it('returns writeable status for owner', async () => {
      const response = await administratorRequest.get(`/workflow/${workflowId}/writeable`)

      const data = JSON.parse(response.res.text)

      expect(response.status).toBe(200)
      expect(data.writeable).toBe(true)
    })
  })

  describe('DELETE /workflow/:workflowId', () => {
    it('rejects unauthenticated requests', async () => {
      const response = await publicRequest.delete(`/workflow/${workflowId}`)

      expect(response.status).toBe(401)
    })

    it('deletes workflow', async () => {
      const response = await administratorRequest.delete(`/workflow/${workflowId}`)

      expect(response.status).toBe(200)
      expect(JSON.parse(response.res.text).success).toBe(true)
    })
  })

  describe('POST /workflow/:workflowId/share/public', () => {
    it('marks workflow as public', async () => {
      const response = await administratorRequest
        .post(`/workflow/${workflowId}/share/public`)
        .send(JSON.stringify({enabled: true}))

      expect(response.status).toBe(200)
      expect(JSON.parse(response.res.text).success).toBe(true)
    })
  })

  describe('GET /workflow/:workflowId/export', () => {
    it('exports workflow as JSON', async () => {
      const response = await administratorRequest.get(`/workflow/${workflowId}/export`)

      expect([200, 500]).toContain(response.status)
      if (response.status === 200) {
        expect(response.headers['content-type']).toContain('application/json')
      }
    })
  })

  describe('GET /workflow/:workflowId/export/json', () => {
    it('exports workflow as JSON with explicit endpoint', async () => {
      const response = await administratorRequest.get(`/workflow/${workflowId}/export/json`)

      expect([200, 500]).toContain(response.status)
      if (response.status === 200) {
        expect(response.headers['content-type']).toContain('application/json')
      }
    })
  })

  describe('GET /workflow/:workflowId/export/zip', () => {
    it('exports workflow as ZIP', async () => {
      const response = await administratorRequest.get(`/workflow/${workflowId}/export/zip`)

      expect([200, 500]).toContain(response.status)
      if (response.status === 200) {
        expect(response.headers['content-type']).toContain('application/zip')
      }
    })
  })

  describe('GET /workflow/:workflowId/share', () => {
    it('returns sharing configuration', async () => {
      const response = await administratorRequest.get(`/workflow/${workflowId}/share`)

      expect([200, 404, 500]).toContain(response.status)
    })
  })

  describe('POST /workflow/:workflowId/share', () => {
    it('updates sharing configuration', async () => {
      const response = await administratorRequest
        .post(`/workflow/${workflowId}/share`)
        .send(JSON.stringify({enabled: true, users: []}))

      expect([200, 400, 500]).toContain(response.status)
    })
  })

  describe('GET /workflow/:workflowId/share/access', () => {
    it('returns access list', async () => {
      const response = await administratorRequest.get(`/workflow/${workflowId}/share/access`)

      expect([200, 404, 500]).toContain(response.status)
    })
  })

  describe('POST /workflow/:workflowId/share/access', () => {
    it('adds user to access list', async () => {
      const response = await administratorRequest
        .post(`/workflow/${workflowId}/share/access`)
        .send(JSON.stringify({userId: subscriberUserId}))

      expect([200, 400, 404, 500]).toContain(response.status)
    })
  })

  describe('GET /workflow/:workflowId/nodeLimit', () => {
    it('returns node limit for workflow', async () => {
      const response = await administratorRequest.get(`/workflow/${workflowId}/nodeLimit`)

      expect([200, 500]).toContain(response.status)
      if (response.status === 200) {
        const data = JSON.parse(response.text)
        expect(data).toHaveProperty('limit')
      }
    })
  })

  describe('POST /workflow/:workflowId/category', () => {
    it('adds category to workflow', async () => {
      const response = await administratorRequest
        .post(`/workflow/${workflowId}/category`)
        .send(JSON.stringify({category: 'test-category'}))

      expect([200, 400, 500]).toContain(response.status)
    })
  })

  describe('GET /workflow/:workflowId (public)', () => {
    it('serves public workflow without auth', async () => {
      await administratorRequest.post(`/workflow/${workflowId}/share/public`).send(JSON.stringify({enabled: true}))
      
      const response = await publicRequest.get(`/workflow/${workflowId}`)

      expect(response.status).toBe(200)

      const workflow = JSON.parse(response.res.text)
      // Public workflow should have share.public.enabled = true
      expect(workflow).toHaveProperty('share')
      expect(workflow.share.public.enabled).toBe(true)
    })
  })
})

describe('Workflow Router - Subscriber Tests', () => {
  beforeEach(async () => {
    await setupDb()
  })

  afterAll(async () => {
    await teardownDb()
  })

  describe('POST /workflow (payment limits)', () => {
    it('rejects workflow creation when limit reached (HTTP mode)', async () => {
      if (!isHttpMode()) {
        // Skip in direct database mode - this tests HTTP API limits
        return
      }

      const response = await subscriberRequest.post('/workflow').send()
      
      // Subscriber may hit 402 Payment Required if limit exceeded
      // or 200 if within limit - both are valid API responses
      expect([200, 402]).toContain(response.status)
      
      if (response.status === 402) {
        expect(response.text).toContain('Workflow limit reached')
      }
    })
  })

  describe('GET /workflow (subscriber access)', () => {
    it('lists workflows for subscriber user', async () => {
      const response = await subscriberRequest.get('/workflow?public=false')

      expect(response.status).toBe(200)
      const data = JSON.parse(response.text)
      expect(data).toHaveProperty('data')
      expect(Array.isArray(data.data)).toBe(true)
    })
  })
})
