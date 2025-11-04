import {describe, beforeEach, afterAll, it, expect} from '@jest/globals'
import {setupDb, teardownDb, isHttpMode} from './setup'
import {subscriberRequest, publicRequest, customerRequest, administratorRequest} from './shared/requests'
import Template from '../src/models/Template'
import {subscriber} from '../src/utils/test/users'

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

const {title, ...workflowTemplateData} = workflowData

describe('Template Router', () => {
  const timestamp = Date.now()
  
  beforeEach(async () => {
    await setupDb()
    
    /* Only skip database operations in HTTP mode - keep test execution */
    if (!isHttpMode()) {
      await Template.deleteMany({})
    }
  })

  afterAll(async () => {
    if (!isHttpMode()) {
      await Template.deleteMany({})
    }
    await teardownDb()
  })

  describe('POST /templates (private)', () => {
    it('creates private template for authenticated user', async () => {
      const userTemplateData = {
        ...workflowTemplateData,
        name: `user-test-template-${timestamp}`,
        keywords: ['test'],
        share: {public: false},
      }

      const response = await subscriberRequest.post('/templates').send(JSON.stringify(userTemplateData))

      expect(response.status).toBe(200)

      const data = JSON.parse(response.res.text)
      expect(data.templateId).toBeDefined()
    })

    it('rejects unauthenticated requests', async () => {
      const userTemplateData = {
        ...workflowTemplateData,
        name: 'user-test-template-${timestamp}',
        keywords: ['test'],
        share: {public: false},
      }

      const response = await publicRequest.post('/templates').send(JSON.stringify(userTemplateData))

      expect(response.status).toBe(401)
    })
  })

  describe('GET /templates/:templateId (private)', () => {
    let userTemplateId

    beforeEach(async () => {
      const userTemplateData = {
        ...workflowTemplateData,
        name: 'user-test-template-${timestamp}',
        keywords: ['test'],
        share: {public: false},
      }

      const response = await subscriberRequest.post('/templates').send(JSON.stringify(userTemplateData))
      userTemplateId = JSON.parse(response.res.text).templateId
    })

    it('serves private template to creator', async () => {
      const response = await subscriberRequest.get(`/templates/${userTemplateId}`)

      expect(response.status).toBe(200)

      const data = JSON.parse(response.res.text)
      expect(data.name).toBe('user-test-template-${timestamp}')
    })

    it('rejects other users', async () => {
      const response = await customerRequest.get(`/templates/${userTemplateId}`)

      expect(response.status).toBe(403)
    })
  })

  describe('GET /templates', () => {
    let userTemplateId

    beforeEach(async () => {
      const userTemplateData = {
        ...workflowTemplateData,
        name: 'user-test-template-${timestamp}',
        keywords: ['test'],
        share: {public: false},
      }

      const response = await subscriberRequest.post('/templates').send(JSON.stringify(userTemplateData))
      userTemplateId = JSON.parse(response.res.text).templateId
    })

    it('lists templates', async () => {
      const response = await subscriberRequest.get('/templates')

      expect(response.status).toBe(200)

      const data = JSON.parse(response.res.text)
      expect(data).toBeInstanceOf(Array)
      expect(data.map(({_id}) => _id)).toContain(userTemplateId)
    })
  })

  describe('POST /templates (update)', () => {
    let userTemplateId

    beforeEach(async () => {
      const userTemplateData = {
        ...workflowTemplateData,
        name: 'user-test-template-${timestamp}',
        keywords: ['test'],
        share: {public: false},
      }

      const response = await subscriberRequest.post('/templates').send(JSON.stringify(userTemplateData))
      userTemplateId = JSON.parse(response.res.text).templateId
    })

    it('accepts new version with existing id', async () => {
      const name = 'new version'
      const userTemplateData = {
        ...workflowTemplateData,
        name,
        keywords: ['test'],
        share: {public: false},
      }

      const response = await subscriberRequest
        .post('/templates')
        .send(JSON.stringify({...userTemplateData, _id: userTemplateId}))

      expect(response.status).toBe(200)

      const data = JSON.parse(response.res.text)
      expect(data.templateId).toBe(userTemplateId)

      const verifyResponse = await subscriberRequest.get(`/templates/${userTemplateId}`)
      const newData = JSON.parse(verifyResponse.res.text)

      expect(newData.name).toBe(name)
    })
  })

  describe('DELETE /templates/:templateId', () => {
    let userTemplateId

    beforeEach(async () => {
      const userTemplateData = {
        ...workflowTemplateData,
        name: 'user-test-template-${timestamp}',
        keywords: ['test'],
        share: {public: false},
      }

      const response = await subscriberRequest.post('/templates').send(JSON.stringify(userTemplateData))
      userTemplateId = JSON.parse(response.res.text).templateId
    })

    it('deletes template', async () => {
      const response = await subscriberRequest.delete(`/templates/${userTemplateId}`)

      expect(response.status).toBe(200)

      const data = JSON.parse(response.res.text)
      expect(data.success).toBe(true)
    })
  })

  describe('POST /templates (public)', () => {
    it('creates public template for admin user', async () => {
      const publicTemplateData = {
        ...workflowTemplateData,
        name: 'public-test-template-${timestamp}',
        keywords: ['test'],
        share: {public: true},
      }

      const response = await administratorRequest.post('/templates').send(JSON.stringify(publicTemplateData))

      expect(response.status).toBe(200)

      const data = JSON.parse(response.res.text)
      expect(data.templateId).toBeDefined()
    })

    it('rejects public template from normal user', async () => {
      const publicTemplateData = {
        ...workflowTemplateData,
        name: 'public-test-template-${timestamp}',
        keywords: ['test'],
        share: {public: true},
      }

      const response = await subscriberRequest.post('/templates').send(JSON.stringify(publicTemplateData))

      expect(response.status).toBe(403)
    })
  })

  describe('GET /templates/:templateId (public)', () => {
    let publicTemplateId

    beforeEach(async () => {
      const publicTemplateData = {
        ...workflowTemplateData,
        name: 'public-test-template-${timestamp}',
        keywords: ['test'],
        share: {public: true},
      }

      const response = await administratorRequest.post('/templates').send(JSON.stringify(publicTemplateData))
      publicTemplateId = JSON.parse(response.res.text).templateId
    })

    it('serves public template to normal users', async () => {
      const response = await subscriberRequest.get(`/templates/${publicTemplateId}`)

      expect(response.status).toBe(200)

      const data = JSON.parse(response.res.text)
      expect(data.name).toBe('public-test-template-${timestamp}')
    })

    it('rejects unauthenticated users', async () => {
      const response = await publicRequest.get(`/templates/${publicTemplateId}`)

      expect(response.status).toBe(401)
    })
  })

  describe('GET /templates (public)', () => {
    let publicTemplateId

    beforeEach(async () => {
      const publicTemplateData = {
        ...workflowTemplateData,
        name: 'public-test-template-${timestamp}',
        keywords: ['test'],
        share: {public: true},
      }

      const response = await administratorRequest.post('/templates').send(JSON.stringify(publicTemplateData))
      publicTemplateId = JSON.parse(response.res.text).templateId
    })

    it('lists public template for normal users', async () => {
      const response = await customerRequest.get('/templates')

      expect(response.status).toBe(200)

      const data = JSON.parse(response.res.text)
      expect(data).toBeInstanceOf(Array)
      expect(data.map(({_id}) => _id)).toContain(publicTemplateId)
    })
  })

  describe('DELETE /templates/:templateId (public)', () => {
    let publicTemplateId

    beforeEach(async () => {
      const publicTemplateData = {
        ...workflowTemplateData,
        name: 'public-test-template-${timestamp}',
        keywords: ['test'],
        share: {public: true},
      }

      const response = await administratorRequest.post('/templates').send(JSON.stringify(publicTemplateData))
      publicTemplateId = JSON.parse(response.res.text).templateId
    })

    it('deletes public template', async () => {
      const response = await administratorRequest.delete(`/templates/${publicTemplateId}`)

      expect(response.status).toBe(200)

      const data = JSON.parse(response.res.text)
      expect(data.success).toBe(true)
    })
  })
})

describe('Template Router - Subscriber Tests', () => {
  let subscriberTemplateId

  beforeAll(async () => {
    await setupDb()

    if (isHttpMode()) {
      /* Create template via API */
      const timestamp = Date.now()
      const res = await subscriberRequest.post('/templates').send({
        name: `subscriber-template-${timestamp}`,
        title: `subscriber-template-${timestamp}`,
        nodes: {},
        edges: {},
        root: 'root',
        share: {public: false},
      })
      if (res.status === 200) {
        const body = JSON.parse(res.text)
        subscriberTemplateId = body.templateId || body._id
      }
    } else {
      /* Create template in database */
      const timestamp = Date.now()
      const subTemplate = new Template({
        userId: subscriberUserId,
        name: `subscriber-template-${timestamp}`,
        title: `subscriber-template-${timestamp}`,
        isPublic: false,
        nodes: {},
        edges: {},
        root: 'root',
      })
      await subTemplate.save()
      subscriberTemplateId = subTemplate._id.toString()
    }
  })

  afterAll(async () => {
    if (!isHttpMode() && subscriberTemplateId) {
      await Template.deleteOne({_id: subscriberTemplateId})
    }
    await teardownDb()
  })

  describe('POST /templates (subscriber)', () => {
    it('creates private template for subscriber', async () => {
      const timestamp = Date.now()
      const res = await subscriberRequest.post('/templates').send({
        name: `subscriber-new-template-${timestamp}`,
        title: `subscriber-new-template-${timestamp}`,
        nodes: {},
        edges: {},
        root: 'root',
        share: {public: false},
      })

      expect(res.status).toBe(200)
      const body = JSON.parse(res.text)
      expect(body).toHaveProperty('templateId')
      expect(typeof body.templateId).toBe('string')
    })
  })

  describe('GET /templates (subscriber)', () => {
    it('lists subscriber templates', async () => {
      const res = await subscriberRequest.get('/templates')
      expect(res.status).toBe(200)
      const templates = JSON.parse(res.text)
      expect(Array.isArray(templates)).toBe(true)
    })
  })

  describe('GET /templates/:templateId (subscriber)', () => {
    it('retrieves subscriber own template', async () => {
      if (!subscriberTemplateId) {
        throw new Error('subscriberTemplateId not set - test setup failed')
      }
      const res = await subscriberRequest.get(`/templates/${subscriberTemplateId}`)
      expect(res.status).toBe(200)
      const template = JSON.parse(res.text)
      expect(template).toHaveProperty('_id')
    })
  })
})
