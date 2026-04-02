import {describe, beforeEach, afterAll, it, expect, beforeAll} from '@jest/globals'
import {administratorRequest, subscriberRequest, publicRequest} from './shared/requests'
import {testDataFactory, testOrchestrator} from './shared/test-data-factory'
import {administrator, subscriber} from './shared/test-users.js'
import {createAuthenticatedRequest} from './shared/test-helpers.js'

/* eslint-disable-next-line no-unused-vars */
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
    await testOrchestrator.prepareTestEnvironment()

    
    const workflow = await testDataFactory.createWorkflow(workflowData)
    workflowId = workflow.workflowId
  })

  afterAll(async () => {
    await testOrchestrator.cleanupTestEnvironment()
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
    it('updates workflow', async () => {
      const updatedData = {...workflowData, title: 'updated title'}
      const response = await administratorRequest.put(`/workflow/${workflowId}`).send(updatedData)

      expect(response.status).toBe(200)
      const data = JSON.parse(response.res.text)
      expect(data.message).toBe('workflow updated successfully')
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

      if (response.status !== 200) {
        console.log('Export error:', response.status, response.body || response.text)
      }
      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toContain('application/json')
    })
  })

  describe('GET /workflow/:workflowId/export/json', () => {
    it('exports workflow as JSON with explicit endpoint', async () => {
      const response = await administratorRequest.get(`/workflow/${workflowId}/export/json`)

      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toContain('application/json')
    })
  })

  describe('GET /workflow/:workflowId/export/zip', () => {
    it('exports workflow as ZIP', async () => {
      const response = await administratorRequest.get(`/workflow/${workflowId}/export/zip`)

      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toMatch(/application\/(zip|octet-stream)/)
    })
  })

  describe('GET /workflow/:workflowId/share', () => {
    it('returns sharing configuration', async () => {
      const response = await administratorRequest.get(`/workflow/${workflowId}/share`)

      expect(response.status).toBe(200)
    })
  })

  describe('POST /workflow/:workflowId/share', () => {
    it('updates sharing configuration', async () => {
      const response = await administratorRequest.post(`/workflow/${workflowId}/share/public`).send({enabled: true})

      expect(response.status).toBe(200)
    })
  })

  describe('GET /workflow/:workflowId/share/access', () => {
    it('returns access list', async () => {
      const response = await administratorRequest.get(`/workflow/${workflowId}/share/access`)

      expect(response.status).toBe(200)
    })
  })

  describe('POST /workflow/:workflowId/share/access', () => {
    it('adds user to access list', async () => {
      const response = await administratorRequest
        .post(`/workflow/${workflowId}/share/access`)
        .send([{subjectId: subscriberUserId, subjectType: 'user', role: 'reader'}])

      expect(response.status).toBe(200)
    })
  })

  describe('GET /workflow/:workflowId/nodeLimit', () => {
    it('returns node limit for workflow', async () => {
      const response = await administratorRequest.get(`/workflow/${workflowId}/nodeLimit`)

      expect(response.status).toBe(200)
      const data = JSON.parse(response.text)
      expect(data).toHaveProperty('limit')
    })
  })

  describe('POST /workflow/:workflowId/category', () => {
    it('adds category to workflow', async () => {
      const response = await administratorRequest
        .post(`/workflow/${workflowId}/category`)
        .send(JSON.stringify({category: 'test-category'}))

      expect(response.status).toBe(200)
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
  let createdWorkflows = []
  let limitTestUser = null
  let limitTestRequest = null

  beforeEach(async () => {
    await testOrchestrator.prepareTestEnvironment()
  })

  afterEach(async () => {
    await testOrchestrator.cleanupTestEnvironment()
  })

  describe('POST /workflow (payment limits)', () => {
    beforeAll(async () => {
      limitTestUser = await testDataFactory.createUser({
        id: `limit-test-${Date.now()}`,
        name: `limit-test-${Date.now()}`,
        mail: `limit-test-${Date.now()}@example.com`,
        password: 'TestPass123!',
        roles: ['subscriber'],
        limitWorkflows: 10,
        limitNodes: 300,
        confirmed: true,
      })
      limitTestRequest = createAuthenticatedRequest(limitTestUser)

      for (let i = 0; i < 10; i++) {
        const response = await limitTestRequest.post('/workflow').send({
          ...workflowData,
          title: `Setup Workflow ${i + 1}`,
        })
        expect(response.status).toBe(200)
        const data = JSON.parse(response.text)
        createdWorkflows.push(data.workflowId)
      }
    })

    afterAll(async () => {
      for (const workflowId of createdWorkflows) {
        try {
          await limitTestRequest.delete(`/workflow/${workflowId}`)
        } catch (err) {
          /* Best effort cleanup */
        }
      }
      createdWorkflows = []
    })

    it('rejects workflow creation when limit reached', async () => {
      const response = await limitTestRequest.post('/workflow').send({
        ...workflowData,
        title: 'Limit Test Workflow',
      })
      expect(response.status).toBe(402)
      expect(response.body).toHaveProperty('message')
      expect(response.body.message).toContain('Workflow limit reached')
    })

    it('allows workflow creation after deleting existing workflow', async () => {
      const listResponse = await limitTestRequest.get('/workflow')
      expect(listResponse.status).toBe(200)
      const listData = JSON.parse(listResponse.text)
      const existingWorkflows = listData.data || []

      expect(existingWorkflows.length).toBeGreaterThan(0)

      const workflowToDelete = existingWorkflows[0].workflowId
      const deleteResponse = await limitTestRequest.delete(`/workflow/${workflowToDelete}`)
      expect(deleteResponse.status).toBe(200)

      const createResponse = await limitTestRequest.post('/workflow').send({
        ...workflowData,
        title: 'Post-Delete Workflow',
      })
      expect(createResponse.status).toBe(200)
      const data = JSON.parse(createResponse.text)
      createdWorkflows.push(data.workflowId)
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

  describe('Edge Cases and Error Handling', () => {
    let edgeTestWorkflowId

    beforeAll(async () => {
      try {
        /* Create workflow using administrator request to ensure proper ownership */
        const response = await administratorRequest.post('/workflow').send({
          ...workflowData,
          title: 'Edge Test Workflow',
        })
        if (response.status !== 200) {
          throw new Error(`Failed to create workflow: ${response.status} - ${response.text}`)
        }
        const data = JSON.parse(response.text)
        edgeTestWorkflowId = data.workflowId
        console.log('Edge test workflow created with ID:', edgeTestWorkflowId)
      } catch (error) {
        console.error('Failed to create edge test workflow:', error)
        throw error
      }
    })

    it('handles invalid workflow ID in GET request', async () => {
      const response = await administratorRequest.get('/workflow/invalid-id')
      expect(response.status).toBe(404)
    })

    it('handles invalid workflow ID in DELETE request', async () => {
      const response = await administratorRequest.delete('/workflow/invalid-id')
      expect(response.status).toBe(404)
    })

    it('handles invalid workflow ID in share operations', async () => {
      const response = await administratorRequest.get('/workflow/invalid-id/share')
      expect(response.status).toBe(404)
    })

    it('handles malformed share configuration', async () => {
      const response = await administratorRequest
        .post(`/workflow/${edgeTestWorkflowId}/share/public`)
        .send('invalid-json')
      expect(response.status).toBe(400)
    })

    it('handles invalid access list data', async () => {
      const response = await administratorRequest
        .post(`/workflow/${edgeTestWorkflowId}/share/access`)
        .send('not-an-array')
      expect(response.status).toBe(400)
    })

    it('handles empty access list', async () => {
      const response = await administratorRequest.post(`/workflow/${edgeTestWorkflowId}/share/access`).send([])
      expect(response.status).toBe(200)
    })

    it('handles invalid category data', async () => {
      const response = await administratorRequest
        .post(`/workflow/${edgeTestWorkflowId}/category`)
        .send({invalidField: 'test'})
      expect(response.status).toBe(500)
    })

    it('handles double deletion attempt', async () => {
      const workflow = await testDataFactory.createWorkflow({
        ...workflowData,
        title: 'Double Delete Test',
      })

      const firstDelete = await administratorRequest.delete(`/workflow/${workflow.workflowId}`)
      expect(firstDelete.status).toBe(200)

      const secondDelete = await administratorRequest.delete(`/workflow/${workflow.workflowId}`)
      expect(secondDelete.status).toBe(404)
    })

    it('handles concurrent access to same workflow', async () => {
      const [getResponse1, getResponse2] = await Promise.all([
        administratorRequest.get(`/workflow/${edgeTestWorkflowId}`),
        administratorRequest.get(`/workflow/${edgeTestWorkflowId}`),
      ])

      expect(getResponse1.status).toBe(200)
      expect(getResponse2.status).toBe(200)
    })

    it('handles export of non-existent workflow', async () => {
      const response = await administratorRequest.get('/workflow/invalid-id/export')
      expect(response.status).toBe(404)
    })

    it('verifies workflow node limit endpoint', async () => {
      const response = await administratorRequest.get(`/workflow/${edgeTestWorkflowId}/nodeLimit`)
      expect(response.status).toBe(200)
      const data = JSON.parse(response.text)
      expect(data).toHaveProperty('limit')
      expect(typeof data.limit).toBe('number')
    })
  })

  describe('Positive Edge Cases', () => {
    it('handles workflow with special characters in title', async () => {
      const specialWorkflow = await testDataFactory.createWorkflow({
        ...workflowData,
        title: 'Test @#$%^&*() Workflow 测试 🚀',
      })

      const response = await administratorRequest.get(`/workflow/${specialWorkflow.workflowId}`)
      expect(response.status).toBe(200)
    })

    it('handles large workflow data structures', async () => {
      const largeNodes = {}
      const largeEdges = {}

      // Create 50 nodes and edges
      for (let i = 0; i < 50; i++) {
        const nodeId = `node_${i}`
        largeNodes[nodeId] = {
          id: nodeId,
          prompts: [],
          title: `Large Node ${i}`,
          children: i < 49 ? [`node_${i + 1}`] : [],
          tags: [`tag_${i}`],
          autoshrink: false,
        }

        if (i < 49) {
          const edgeId = `${nodeId}_node_${i + 1}`
          largeEdges[edgeId] = {
            id: edgeId,
            start: nodeId,
            end: `node_${i + 1}`,
            title: `Edge ${i}`,
          }
        }
      }

      const largeWorkflow = await testDataFactory.createWorkflow({
        nodes: largeNodes,
        edges: largeEdges,
        share: {public: {enabled: false}},
        title: 'Large Workflow Test',
        root: 'node_0',
      })

      const response = await administratorRequest.get(`/workflow/${largeWorkflow.workflowId}`)
      expect(response.status).toBe(200)
    })

    it('verifies public workflow access without authentication', async () => {
      const publicWorkflow = await testDataFactory.createWorkflow({
        ...workflowData,
        title: 'Public Access Test',
      })

      // Make workflow public
      await administratorRequest.post(`/workflow/${publicWorkflow.workflowId}/share/public`).send({enabled: true})

      // Verify public access
      const response = await publicRequest.get(`/workflow/${publicWorkflow.workflowId}`)
      expect(response.status).toBe(200)

      const workflow = JSON.parse(response.text)
      expect(workflow.share.public.enabled).toBe(true)
    })

    it('handles workflow list with various query parameters', async () => {
      const responses = await Promise.all([
        administratorRequest.get('/workflow?public=true&limit=5'),
        administratorRequest.get('/workflow?public=false&page=1'),
        administratorRequest.get('/workflow?search=test'),
        administratorRequest.get('/workflow'), // No parameters
      ])

      responses.forEach(response => {
        expect(response.status).toBe(200)
        const data = JSON.parse(response.text)
        expect(data).toHaveProperty('data')
        expect(Array.isArray(data.data)).toBe(true)
      })
    })
  })
})
