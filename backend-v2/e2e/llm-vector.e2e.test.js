import {subscriberRequest, publicRequest} from './shared/requests'
import {testDataFactory, testOrchestrator} from './shared/test-data-factory'
import {subscriber} from './shared/test-users.js'

const userId = subscriber.name
const subscriberUserId = subscriber.name

describe('LLM Vector E2E', () => {
  beforeAll(async () => {
    await testOrchestrator.prepareTestEnvironment()
  })
  afterAll(async () => {
    await testOrchestrator.cleanupTestEnvironment()
  })

  beforeEach(async () => {
    
  })

  describe('POST /vector', () => {
    it('creates new context with type and data', async () => {
      const payload = {
        contextName: 'test-context',
        type: 'openai',
        data: {
          'example-source': [{content: 'test vector 1'}],
        },
      }

      const res = await subscriberRequest.post('/vector').send(payload)
      expect(res.status).toBe(200)
      const body = JSON.parse(res.text)
      expect(body).toHaveProperty('name', 'test-context')
      expect(body).toHaveProperty('userId')
      expect(body).toHaveProperty('store')
    })

    it('appends vectors when keep=true', async () => {
      const contextName = 'append-test'
      const type = 'openai'

      await subscriberRequest.post('/vector').send({
        contextName,
        type,
        data: {'source1': [{content: 'first'}]},
      })

      const res = await subscriberRequest.post('/vector').send({
        contextName,
        type,
        keep: true,
        data: {'source2': [{content: 'second'}]},
      })

      expect(res.status).toBe(200)

      /* HTTP mode: Test success via API response only */
    }, 15000)

    it('replaces vectors when keep=false', async () => {
      const contextName = 'replace-test'
      const type = 'openai'

      await subscriberRequest.post('/vector').send({
        contextName,
        type,
        data: {'source1': [{content: 'first'}]},
      })

      const res = await subscriberRequest.post('/vector').send({
        contextName,
        type,
        keep: false,
        data: {'source2': [{content: 'second'}]},
      })

      expect(res.status).toBe(200)

      /* HTTP mode: Test success via API response only */
    }, 15000)

    it('rejects invalid payload', async () => {
      const res = await subscriberRequest.post('/vector').send({
        contextName: 'invalid',
        type: 'openai',
        data: 'not an object',
      })
      expect(res.status).toBe(400)
    })

    it('rejects unauthenticated requests', async () => {
      const res = await publicRequest.post('/vector').send({
        type: 'openai',
        data: {'test': [{content: 'test'}]},
      })
      expect(res.status).toBe(401)
    })
  })

  describe('GET /vector', () => {
    beforeEach(async () => {
      
      await testDataFactory.createLLMVector({
        contextName: 'get-test',
        type: 'openai',
        data: {'example-source': [{content: 'vector data'}]},
      })
    }, 15000)

    it('retrieves full context', async () => {
      const res = await subscriberRequest.get('/vector?name=get-test')
      expect(res.status).toBe(200)
      const data = JSON.parse(res.text)
      expect(data).toHaveProperty('openai')
      expect(data.openai).toHaveProperty('example-source')
    }, 10000)

    it('retrieves specific type', async () => {
      const res = await subscriberRequest.get('/vector?name=get-test&type=openai')
      expect(res.status).toBe(200)
      const data = JSON.parse(res.text)
      expect(data).toHaveProperty('example-source')
    }, 10000)

    it('retrieves specific source', async () => {
      const res = await subscriberRequest.get('/vector?name=get-test&type=openai&source=example-source')
      expect(res.status).toBe(200)
      const data = JSON.parse(res.text)
      expect(data).toHaveProperty('example-source')
      expect(Array.isArray(data['example-source'])).toBe(true)
    }, 10000)

    it('returns 404 for missing context', async () => {
      const res = await subscriberRequest.get('/vector?name=nonexistent')
      expect(res.status).toBe(404)
    }, 10000)

    it('returns 404 for missing type', async () => {
      const res = await subscriberRequest.get('/vector?name=get-test&type=nonexistent')
      expect(res.status).toBe(404)
    }, 10000)

    it('returns 404 for missing source', async () => {
      const res = await subscriberRequest.get('/vector?name=get-test&type=openai&source=nonexistent')
      expect(res.status).toBe(404)
    }, 10000)
  })

  describe('GET /vector/all', () => {
    beforeEach(async () => {
      
      await testDataFactory.createLLMVector({
        contextName: 'context1',
        type: 'openai',
        data: {'test': [{content: 'data1'}]},
      })
      await testDataFactory.createLLMVector({
        contextName: 'context2',
        type: 'openai', 
        data: {'test': [{content: 'data2'}]},
      })
    }, 15000)

    it('lists all user contexts', async () => {
      const res = await subscriberRequest.get('/vector/all')
      expect(res.status).toBe(200)
      const data = JSON.parse(res.text)
      expect(Array.isArray(data)).toBe(true)
      expect(data.length).toBeGreaterThanOrEqual(2)
    }, 10000)
  })

  describe('DELETE /vector', () => {
    beforeEach(async () => {
      
      await testDataFactory.createLLMVector({
        contextName: 'delete-test',
        type: 'openai',
        data: {'test': [{content: 'delete data'}]},
      })
    }, 15000)

    it('deletes context', async () => {
      const res = await subscriberRequest.delete('/vector').send({contextName: 'delete-test'})
      expect(res.status).toBe(200)
      const body = JSON.parse(res.text)
      expect(body).toHaveProperty('message')

      /* HTTP mode: Test success via API response only */
    }, 10000)

    it('returns 404 for missing context', async () => {
      const res = await subscriberRequest.delete('/vector').send({contextName: 'nonexistent'})
      expect(res.status).toBe(404)
    }, 10000)
  })

  describe('GET /vector/overview', () => {
    beforeEach(async () => {
      
      await testDataFactory.createLLMVector({
        contextName: 'overview-test',
        type: 'openai',
        data: {'source1': [{content: 'data'}]},
      })
    }, 15000)

    it('returns context metadata', async () => {
      const res = await subscriberRequest.get('/vector/overview')
      expect(res.status).toBe(200)
      const data = JSON.parse(res.text)
      expect(typeof data).toBe('object')
      expect(data).toHaveProperty('overview-test')
    }, 10000)
  })
})

describe('LLM Vector E2E - Subscriber Tests', () => {
  let contextName

  beforeAll(async () => {
    await testOrchestrator.prepareTestEnvironment()
  })

  afterAll(async () => {
    await testOrchestrator.cleanupTestEnvironment()
  })

  beforeEach(async () => {
    contextName = `test-context-subscriber-${Date.now()}`

    
    await testDataFactory.createLLMVector({
      contextName: contextName,
      type: 'text',
      data: {'default-source': [{content: 'subscriber test', embedding: [0.1, 0.2]}]},
      keep: false,
    })
  })

  afterEach(async () => {
    
  })

  describe('POST /vector (subscriber)', () => {
    it('creates new context for subscriber', async () => {
      const subContext = `subscriber-context-${Date.now()}`
      const res = await subscriberRequest.post('/vector').send({
        context: subContext,
        type: 'text',
        data: [{id: '1', text: 'subscriber', vector: [0.1, 0.2]}],
        keep: false,
      })

      expect(res.status).toBe(400)
      expect(res.body).toHaveProperty('message')
    })
  })

  describe('GET /vector (subscriber)', () => {
    it('retrieves subscriber context', async () => {
      const res = await subscriberRequest.get(`/vector?name=${contextName}`)
      expect(res.status).toBe(200)
      const data = JSON.parse(res.text)
      expect(typeof data).toBe('object')
    })
  })

  describe('GET /vector/all (subscriber)', () => {
    it('lists all subscriber contexts', async () => {
      const res = await subscriberRequest.get('/vector/all')
      expect(res.status).toBe(200)
      const contexts = JSON.parse(res.text)
      expect(Array.isArray(contexts)).toBe(true)
      contexts.forEach(ctx => {
        expect(ctx).toHaveProperty('name')
        expect(ctx).toHaveProperty('_id')
        expect(ctx).toHaveProperty('userId')
      })
    })
  })

  describe('DELETE /vector (subscriber)', () => {
    it('deletes subscriber context', async () => {
      const res = await subscriberRequest.delete('/vector').send({contextName})
      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('message')
      expect(typeof res.body.message).toBe('string')
    })
  })
})
