import {describe, beforeEach, afterAll, it, expect, jest} from '@jest/globals'
import {setupDb, teardownDb} from './setup'
import {subscriberRequest, administratorRequest, customerRequest} from './shared/requests'

describe('Integration Router', () => {
  beforeEach(async () => {
    await setupDb()
    
    await subscriberRequest.delete('/integration')
    await administratorRequest.delete('/integration')
    await customerRequest.delete('/integration')
    
    await subscriberRequest.put('/integration/openai/update').send({apiKey: 'test-key'})
    await administratorRequest.put('/integration/openai/update').send({apiKey: 'admin-test-key'})
    await customerRequest.put('/integration/openai/update').send({apiKey: 'customer-test-key'})
  })

  afterAll(async () => {
    await subscriberRequest.delete('/integration')
    await administratorRequest.delete('/integration')
    await customerRequest.delete('/integration')
    await teardownDb()
  })

  describe('GET /integration', () => {
    it('returns all integrations', async () => {
      const res = await subscriberRequest.get('/integration')
      
      expect(res.status).toBe(200)
      expect(typeof res.body).toBe('object')
      expect(res.body).toHaveProperty('_id')
      expect(res.body).toHaveProperty('userId', 'subscriber_user')
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

  describe('POST /integration/yandex/completion', () => {
    it('requires authentication', async () => {
      const res = await subscriberRequest.post('/integration/yandex/completion').send({})
      
      expect(res.status).toBe(500)
      expect(res.body).toHaveProperty('message')
    })
  })

  describe('POST /integration/yandex/embeddings', () => {
    it('requires authentication', async () => {
      const res = await subscriberRequest.post('/integration/yandex/embeddings').send({})
      
      expect(res.status).toBe(400)
      expect(res.text).toBeTruthy()
    })
  })

  describe('GET /integration/openai_api_key', () => {
    it('checks API key presence', async () => {
      const res = await subscriberRequest.get('/integration/openai_api_key')
      
      expect(res.status).toBe(200)
      expect(typeof res.body).toBe('object')
      expect(res.body).toHaveProperty('success')
      expect(typeof res.body.success).toBe('boolean')
      expect(res.body.success).toBe(true)
    })
  })

  describe('POST /integration/chat/completions', () => {
    it('requires OpenAI configuration', async () => {
      const res = await subscriberRequest.post('/integration/chat/completions').send({messages: []})
      
      expect(res.status).toBe(500)
      expect(res.body).toHaveProperty('message')
      expect(res.text).toContain('Model name not specified')
    })
  })

  describe('POST /integration/embeddings', () => {
    it('requires OpenAI configuration', async () => {
      const res = await subscriberRequest.post('/integration/embeddings').send({input: 'test'})
      
      expect(res.status).toBe(500)
      expect(res.body).toHaveProperty('message')
      expect(res.text).toContain('Model name not specified')
    })
  })

  describe('POST /integration/images/generations', () => {
    it('generates images with DALL-E', async () => {
      const res = await subscriberRequest.post('/integration/images/generations').send({prompt: 'test', n: 1})
      
      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('data')
      expect(Array.isArray(res.body.data)).toBe(true)
      expect(res.body.data.length).toBe(1)
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

  describe('POST /integration/claude/messages', () => {
    it('requires Claude configuration', async () => {
      const res = await subscriberRequest.post('/integration/claude/messages').send({messages: []})
      
      expect(res.status).toBe(400)
      expect(res.text).toBeTruthy()
    })
  })

  describe('POST /integration/perplexity/chat/completions', () => {
    it('requires Perplexity configuration', async () => {
      const res = await subscriberRequest.post('/integration/perplexity/chat/completions').send({})
      
      expect(res.status).toBe(500)
      expect(res.body).toHaveProperty('message')
      expect(res.text).toContain('Messages are required')
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
  })
})

describe('Integration Router - Administrator Tests', () => {
  beforeEach(async () => {
    await setupDb()
    
    await administratorRequest.delete('/integration')
    await administratorRequest.put('/integration/openai/update').send({apiKey: 'admin-test-key'})
  })

  afterAll(async () => {
    await administratorRequest.delete('/integration')
    await teardownDb()
  })

  describe('Administrator API Access', () => {
    it('should have full access to integration configuration', async () => {
      const res = await administratorRequest.get('/integration')
      
      expect(res.status).toBe(200)
      expect(typeof res.body).toBe('object')
      expect(res.body).toHaveProperty('userId', 'administrator_user')
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
    await setupDb()
    
    await customerRequest.delete('/integration')
    await customerRequest.put('/integration/openai/update').send({apiKey: 'customer-test-key'})
  })

  afterAll(async () => {
    await customerRequest.delete('/integration')
    await teardownDb()
  })

  describe('Customer API Access', () => {
    it('should access integrations with customer privileges', async () => {
      const res = await customerRequest.get('/integration')
      
      expect(res.status).toBe(200)
      expect(typeof res.body).toBe('object')
      expect(res.body).toHaveProperty('userId', 'customer_user')
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
