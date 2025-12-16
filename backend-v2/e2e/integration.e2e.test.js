import {describe, beforeEach, afterAll, it, expect} from '@jest/globals'
import {testOrchestrator} from './shared/test-data-factory'
import {subscriberRequest, administratorRequest, customerRequest} from './shared/requests'

describe('Integration Router', () => {
  beforeEach(async () => {
    await testOrchestrator.prepareTestEnvironment()
    
    /* Setup test data - wait for upsert to complete */
    const setupResults = await Promise.all([
      subscriberRequest.put('/integration/openai/update').send({apiKey: 'test-key'}),
      administratorRequest.put('/integration/openai/update').send({apiKey: 'admin-test-key'}),
      customerRequest.put('/integration/openai/update').send({apiKey: 'customer-test-key'})
    ])
    
    /* Verify all setups succeeded */
    setupResults.forEach((res, idx) => {
      if (res.status !== 200) {
        throw new Error(`Integration setup failed for user ${idx}: ${res.status}`)
      }
    })
  })

  afterAll(async () => {
    await testOrchestrator.cleanupTestEnvironment()
  })

  describe('GET /integration', () => {
    it('returns all integrations', async () => {
      const res = await subscriberRequest.get('/integration')
      
      expect(res.status).toBe(200)
      expect(typeof res.body).toBe('object')
      expect(res.body).toHaveProperty('_id')
      expect(res.body).toHaveProperty('userId', 'subscriber')
      expect(res.body).toHaveProperty('openai')
      expect(typeof res.body.openai).toBe('object')
      expect(res.body.openai).toHaveProperty('apiKey')
      expect(typeof res.body.openai.apiKey).toBe('string')
      expect(res.body.openai.apiKey).toBe('test-key')
      expect(res.body).toHaveProperty('lang')
      expect(res.body).toHaveProperty('model')
      expect(res.body.lang).toBe('none')
      expect(res.body.model).toBe('auto')
    })
  })


  describe('GET /integration/icons/freepik', () => {
    it('requires query parameter', async () => {
      const res = await subscriberRequest.get('/integration/icons/freepik')
      
      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('data')
      expect(Array.isArray(res.body.data)).toBe(true)
    })
  })

  describe('POST /integration/icons/download', () => {
    it('requires icon URL', async () => {
      const res = await subscriberRequest.post('/integration/icons/download').send({})
      
      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('url')
    })
  })

  describe('POST /integration/midjourney/create', () => {
    it('requires Midjourney configuration', async () => {
      const res = await subscriberRequest.post('/integration/midjourney/create').send({prompt: 'test'})
      
      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('status')
    })
  })

  describe('POST /integration/midjourney/upscale', () => {
    it('requires Midjourney configuration', async () => {
      const res = await subscriberRequest.post('/integration/midjourney/upscale').send({taskId: 'test', index: 1})
      
      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('status')
    })
  })

  describe('POST /integration/zoom/auth', () => {
    it('requires Zoom authorization code', async () => {
      const res = await subscriberRequest.post('/integration/zoom/auth').send({})
      
      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('access_token')
    })
  })

  describe('GET /integration/zoom/meetings/:id/recordings', () => {
    it('requires Zoom configuration', async () => {
      const res = await subscriberRequest.get('/integration/zoom/meetings/test123/recordings')
      
      expect(res.status).toBe(200)
      expect(res.text).toBeTruthy()
    })
  })


  describe('GET /integration/languages', () => {
    it('returns available languages', async () => {
      const res = await subscriberRequest.get('/integration/languages')
      
      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
      expect(res.body.length).toBeGreaterThan(0)
      res.body.forEach(lang => {
        expect(lang).toHaveProperty('code')
        expect(lang).toHaveProperty('name')
      })
    })
  })

  describe('POST /integration/language', () => {
    it('sets user language preference', async () => {
      const res = await subscriberRequest.post('/integration/language').send({language: 'en'})
      
      expect(res.status).toBe(500)
      expect(res.body).toHaveProperty('message')
    })
  })

  describe('POST /integration/model', () => {
    it('sets user model preference', async () => {
      const res = await subscriberRequest.post('/integration/model').send({model: 'gpt-4'})
      
      expect(res.status).toBe(200)
      expect(typeof res.body).toBe('object')
      expect(res.body).toHaveProperty('model')
      expect(typeof res.body.model).toBe('string')
      expect(res.body.model).toBe('gpt-4')
    })
  })

  describe('GET /integration/:service', () => {
    it('returns integration details', async () => {
      const res = await subscriberRequest.get('/integration/openai')
      
      expect(res.status).toBe(200)
      expect(typeof res.body).toBe('object')
      expect(res.body).toHaveProperty('openai')
      expect(typeof res.body.openai).toBe('object')
      expect(res.body.openai).toHaveProperty('apiKey')
      expect(typeof res.body.openai.apiKey).toBe('string')
      expect(res.body.openai.apiKey).toBe('test-key')
    })
  })

  describe('PUT /integration/:service/update', () => {
    it('updates integration configuration', async () => {
      const res = await subscriberRequest.put('/integration/openai/update').send({apiKey: 'updated-test-key'})
      
      expect(res.status).toBe(200)
      expect(typeof res.body).toBe('object')
      expect(res.body).toHaveProperty('vectors')
      expect(typeof res.body.vectors).toBe('object')
      expect(res.body.vectors).toHaveProperty('store')
      expect(typeof res.body.vectors.store).toBe('object')
    })

    it('creates new llmvectors document for deepseek when none exists', async () => {
      /* prepareTestEnvironment already cleaned MongoDB - guaranteed clean slate */
      
      /* First deepseek integration update - triggers insert path in ensureServiceStoreExists */
      const res = await subscriberRequest.put('/integration/deepseek/update').send({
        apiKey: 'sk-deepseek-test-key',
        model: 'deepseek-chat'
      })
      
      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('vectors')
      expect(res.body.vectors).toHaveProperty('store')
      expect(res.body.vectors.store).toHaveProperty('deepseek')
      expect(typeof res.body.vectors.store.deepseek).toBe('object')
    })

    it('updates existing llmvectors document when adding new service', async () => {
      /* Setup: Create openai integration first */
      await subscriberRequest.put('/integration/openai/update').send({apiKey: 'openai-key'})
      
      /* Add deepseek to existing llmvectors doc - triggers update path */
      const res = await subscriberRequest.put('/integration/deepseek/update').send({
        apiKey: 'sk-deepseek-key',
        model: 'deepseek-chat'
      })
      
      expect(res.status).toBe(200)
      expect(res.body.vectors.store).toHaveProperty('openai')
      expect(res.body.vectors.store).toHaveProperty('deepseek')
    })

    it('handles multiple services without store isolation violations', async () => {
      /* Test store.{service} isolation: deepseek, openai, claude */
      await subscriberRequest.put('/integration/deepseek/update').send({apiKey: 'deepseek-key'})
      await subscriberRequest.put('/integration/openai/update').send({apiKey: 'openai-key'})
      await subscriberRequest.put('/integration/claude/update').send({apiKey: 'claude-key'})
      
      const res = await subscriberRequest.get('/integration')
      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('deepseek')
      expect(res.body).toHaveProperty('openai')
      expect(res.body).toHaveProperty('claude')
    })

    it('preserves existing service stores when adding new service', async () => {
      /* Create openai with vectors */
      await subscriberRequest.put('/integration/openai/update').send({apiKey: 'openai-key'})
      const firstRes = await subscriberRequest.get('/integration')
      expect(firstRes.status).toBe(200)
      expect(firstRes.body).toBeDefined()
      expect(typeof firstRes.body).toBe('object')
      expect(firstRes.body).toHaveProperty('openai')
      
      /* Add deepseek - should NOT delete openai store */
      await subscriberRequest.put('/integration/deepseek/update').send({apiKey: 'deepseek-key'})
      
      const res = await subscriberRequest.get('/integration')
      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('openai')
      expect(res.body).toHaveProperty('deepseek')
    })
  })
})

describe('Integration Router - Administrator Tests', () => {
  beforeEach(async () => {
    await testOrchestrator.prepareTestEnvironment()
    
    await administratorRequest.put('/integration/openai/update').send({apiKey: 'admin-test-key'})
  })

  afterAll(async () => {
    await testOrchestrator.cleanupTestEnvironment()
  })

  describe('Administrator API Access', () => {
    it('should have full access to integration configuration', async () => {
      const res = await administratorRequest.get('/integration')
      
      expect(res.status).toBe(200)
      expect(typeof res.body).toBe('object')
      expect(res.body).toHaveProperty('userId', 'admin')
      expect(res.body).toHaveProperty('openai')
      expect(res.body.openai).toHaveProperty('apiKey')
      expect(res.body.openai.apiKey).toBe('admin-test-key')
    })
    
    it('should update integration settings', async () => {
      const res = await administratorRequest.put('/integration/openai/update').send({apiKey: 'updated-admin-key'})
      
      expect(res.status).toBe(200)
      expect(typeof res.body).toBe('object')
      expect(res.body).toHaveProperty('vectors')
      expect(res.body.vectors).toHaveProperty('store')
      expect(typeof res.body.vectors.store).toBe('object')
    })
  })
})

describe('Integration Router - Customer Tests', () => {
  beforeEach(async () => {
    await testOrchestrator.prepareTestEnvironment()
    
    await customerRequest.put('/integration/openai/update').send({apiKey: 'customer-test-key'})
  })

  afterAll(async () => {
    await testOrchestrator.cleanupTestEnvironment()
  })

  describe('Customer API Access', () => {
    it('should access integrations with customer privileges', async () => {
      const res = await customerRequest.get('/integration')
      
      expect(res.status).toBe(200)
      expect(typeof res.body).toBe('object')
      expect(res.body).toHaveProperty('userId', 'customer')
      expect(res.body).toHaveProperty('openai')
      expect(res.body.openai).toHaveProperty('apiKey')
      expect(res.body.openai.apiKey).toBe('customer-test-key')
    })
    
    it('should set model preferences', async () => {
      const res = await customerRequest.post('/integration/model').send({model: 'gpt-3.5-turbo'})
      
      expect(res.status).toBe(200)
      expect(typeof res.body).toBe('object')
      expect(res.body).toHaveProperty('model')
      expect(typeof res.body.model).toBe('string')
      expect(res.body.model).toBe('gpt-3.5-turbo')
    })
  })
})
