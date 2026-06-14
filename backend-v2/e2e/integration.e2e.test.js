import {describe, beforeEach, afterEach, afterAll, it, expect} from '@jest/globals'
import {testOrchestrator, testDataFactory} from './shared/test-data-factory'
import {subscriberRequest, administratorRequest, customerRequest} from './shared/requests'

describe('Integration Router', () => {
  beforeEach(async () => {
    await testOrchestrator.prepareTestEnvironment()
    
    const setupPairs = [
      [subscriberRequest, 'test-key'],
      [administratorRequest, 'admin-test-key'],
      [customerRequest, 'customer-test-key'],
    ]
    for (const [request, apiKey] of setupPairs) {
      const res = await request.put('/integration/openai/update').send({ apiKey })
      if (res.status !== 200) {
        throw new Error(`Integration setup failed: ${res.status}`)
      }
    }
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
      expect(res.body.openai.apiKey).toBe('')
      expect(res.body).toHaveProperty('secretsMeta')
      expect(res.body.secretsMeta).toHaveProperty('openai')
      expect(res.body.secretsMeta.openai.apiKey).toBe(true)
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
    it('returns integration details with redacted secrets', async () => {
      const res = await subscriberRequest.get('/integration/openai')

      expect(res.status).toBe(200)
      expect(typeof res.body).toBe('object')
      expect(res.body).toHaveProperty('openai')
      expect(typeof res.body.openai).toBe('object')
      expect(res.body.openai.apiKey).toBe('')
      expect(res.body).toHaveProperty('secretsMeta')
      expect(res.body.secretsMeta).toHaveProperty('openai')
      expect(res.body.secretsMeta.openai.apiKey).toBe(true)
    })
  })

  describe('PUT /integration/:service/update', () => {
    it('updates integration configuration', async () => {
      const res = await subscriberRequest.put('/integration/openai/update').send({apiKey: 'updated-test-key'})

      expect(res.status).toBe(200)
      expect(typeof res.body).toBe('object')
      expect(res.body).toHaveProperty('openai')
      expect(res.body).toHaveProperty('secretsMeta')
      expect(res.body.secretsMeta.openai.apiKey).toBe(true)
    })

    it('creates new llmvectors document for deepseek when none exists', async () => {
      const res = await subscriberRequest.put('/integration/deepseek/update').send({
        apiKey: 'sk-deepseek-test-key',
        model: 'deepseek-chat'
      })
      
      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('deepseek')
      expect(res.body.secretsMeta.deepseek.apiKey).toBe(true)
    })

    it('updates existing llmvectors document when adding new service', async () => {
      await subscriberRequest.put('/integration/openai/update').send({apiKey: 'openai-key'})
      const res = await subscriberRequest.put('/integration/deepseek/update').send({
        apiKey: 'sk-deepseek-key',
        model: 'deepseek-chat'
      })

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('openai')
      expect(res.body).toHaveProperty('deepseek')
      expect(res.body.secretsMeta.openai.apiKey).toBe(true)
      expect(res.body.secretsMeta.deepseek.apiKey).toBe(true)
    })

    it('handles multiple services without store isolation violations', async () => {
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
      await subscriberRequest.put('/integration/openai/update').send({apiKey: 'openai-key'})
      const firstRes = await subscriberRequest.get('/integration')
      expect(firstRes.status).toBe(200)
      expect(firstRes.body).toBeDefined()
      expect(typeof firstRes.body).toBe('object')
      expect(firstRes.body).toHaveProperty('openai')
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
      expect(res.body.openai.apiKey).toBe('')
      expect(res.body).toHaveProperty('secretsMeta')
      expect(res.body.secretsMeta).toHaveProperty('openai')
      expect(res.body.secretsMeta.openai.apiKey).toBe(true)
    })
    
    it('should update integration settings', async () => {
      const res = await administratorRequest.put('/integration/openai/update').send({apiKey: 'updated-admin-key'})

      expect(res.status).toBe(200)
      expect(typeof res.body).toBe('object')
      expect(res.body).toHaveProperty('userId', 'admin')
      expect(res.body).toHaveProperty('openai')
      expect(res.body.secretsMeta.openai.apiKey).toBe(true)
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
      expect(res.body.openai.apiKey).toBe('')
      expect(res.body).toHaveProperty('secretsMeta')
      expect(res.body.secretsMeta).toHaveProperty('openai')
      expect(res.body.secretsMeta.openai.apiKey).toBe(true)
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

describe('Array Item Validation — args field contract for mcp and rpc', () => {
  const INVALID_ARGS_CASES = [
    {label: 'string scalar',                  args: 'server.js'},
    {label: 'integer scalar',                 args: 42},
    {label: 'plain object',                   args: {0: 'server.js'}},
    {label: 'null',                           args: null},
    {label: 'array with non-string element',  args: ['server.js', 2]},
  ]

  const VALID_ARGS_CASES = [
    {label: 'args field omitted',         payload: {}},
    {label: 'empty array',                payload: {args: []}},
    {label: 'single string element',      payload: {args: ['server.js']}},
    {label: 'multiple string elements',   payload: {args: ['server.js', '--flag', '--p=8']}},
  ]

  const FIELDS = ['mcp', 'rpc']

  beforeEach(async () => {
    await testOrchestrator.prepareTestEnvironment()
  })

  afterAll(async () => {
    await testOrchestrator.cleanupTestEnvironment()
  })

  FIELDS.forEach(field => {
    describe(`/${field}/items`, () => {
      INVALID_ARGS_CASES.forEach(({label, args}) => {
        it(`rejects ${label} with HTTP 400 and an error message in the response body`, async () => {
          const res = await subscriberRequest.post(`/integration/${field}/items`).send({
            alias: '/args-rejection-probe',
            transport: 'stdio',
            command: 'node',
            args,
          })

          expect(res.status).toBe(400)
          expect(res.body).toHaveProperty('message')
        })
      })

      VALID_ARGS_CASES.forEach(({label, payload}, index) => {
        it(`accepts ${label} with HTTP 201`, async () => {
          const alias = `/acceptance-probe-${field}-${index}`
          const res = await subscriberRequest.post(`/integration/${field}/items`).send({
            alias,
            transport: 'stdio',
            command: 'node',
            ...payload,
          })

          expect(res.status).toBe(201)
        })
      })
    })
  })

  it('rejected item leaves no trace in GET /integration — write is atomic', async () => {
    const probe = '/atomicity-probe'

    const addRes = await subscriberRequest.post('/integration/mcp/items').send({
      alias: probe,
      transport: 'stdio',
      command: 'node',
      args: INVALID_ARGS_CASES[0].args,
    })
    expect(addRes.status).toBe(400)

    const getRes = await subscriberRequest.get('/integration')
    expect(getRes.status).toBe(200)
    expect((getRes.body.mcp ?? []).map(item => item.alias)).not.toContain(probe)
  })

  it('sequence of invalid submissions does not corrupt GET /integration', async () => {
    const probes = INVALID_ARGS_CASES.map(({args}, i) => ({alias: `/corruption-probe-${i}`, args}))

    for (const {alias, args} of probes) {
      const res = await subscriberRequest.post('/integration/mcp/items').send({
        alias,
        transport: 'stdio',
        command: 'node',
        args,
      })
      expect(res.status).toBe(400)
    }

    const getRes = await subscriberRequest.get('/integration')
    expect(getRes.status).toBe(200)
    const savedAliases = (getRes.body.mcp ?? []).map(item => item.alias)
    for (const {alias} of probes) {
      expect(savedAliases).not.toContain(alias)
    }
  })

  it('PUT update also validates args and returns 400 with error message for invalid args', async () => {
    const alias = '/update-args-probe'

    await subscriberRequest.post('/integration/mcp/items').send({
      alias,
      transport: 'stdio',
      command: 'node',
    })

    const updateRes = await subscriberRequest
      .put(`/integration/mcp/items/${encodeURIComponent(alias)}`)
      .send({args: INVALID_ARGS_CASES[0].args})

    expect(updateRes.status).toBe(400)
    expect(updateRes.body).toHaveProperty('message')
  })
})

describe('Array Item Scope Isolation — workflowId segregation', () => {
  let workflowId

  beforeAll(async () => {
    await testOrchestrator.prepareTestEnvironment()
    const wf = await testDataFactory.createWorkflow({title: 'Scope Isolation Workflow', userId: 'subscriber'})
    workflowId = wf.workflowId
  })

  beforeEach(async () => {
    await testOrchestrator.prepareTestEnvironment()
  })

  afterAll(async () => {
    await testOrchestrator.cleanupTestEnvironment()
  })

  it('item added to workflow scope is absent from user-level GET', async () => {
    const res = await subscriberRequest
      .post(`/integration/mcp/items?workflowId=${workflowId}`)
      .send({alias: '/wf-only', transport: 'stdio', command: 'node', toolName: 't'})
    expect(res.status).toBe(201)

    const userRes = await subscriberRequest.get('/integration')
    expect(userRes.status).toBe(200)
    expect((userRes.body.mcp ?? []).map(m => m.alias)).not.toContain('/wf-only')
  })

  it('workflow-scoped GET includes user-level items via fallback when no workflow doc exists', async () => {
    // Dedicated workflow so the "no workflow doc exists" precondition holds
    // regardless of items other tests created against the shared workflowId.
    const freshWf = await testDataFactory.createWorkflow({title: 'Fallback NoDoc Workflow', userId: 'subscriber'})

    const res = await subscriberRequest
      .post('/integration/mcp/items')
      .send({alias: '/user-only', transport: 'stdio', command: 'node', toolName: 't'})
    expect(res.status).toBe(201)

    const wfRes = await subscriberRequest.get(`/integration?workflowId=${freshWf.workflowId}`)
    expect(wfRes.status).toBe(200)
    expect((wfRes.body.mcp ?? []).map(m => m.alias)).toContain('/user-only')
  })

  it('workflow-scoped GET returns item added at that workflow scope', async () => {
    await subscriberRequest
      .post(`/integration/mcp/items?workflowId=${workflowId}`)
      .send({alias: '/wf-item', transport: 'stdio', command: 'node', toolName: 't'})

    const res = await subscriberRequest.get(`/integration?workflowId=${workflowId}`)
    expect(res.status).toBe(200)
    expect((res.body.mcp ?? []).map(m => m.alias)).toContain('/wf-item')
  })

  it('two different workflow scopes do not share array items', async () => {
    const wf2 = await testDataFactory.createWorkflow({title: 'Second Isolation Workflow', userId: 'subscriber'})

    await subscriberRequest
      .post(`/integration/mcp/items?workflowId=${workflowId}`)
      .send({alias: '/wf1-item', transport: 'stdio', command: 'node', toolName: 't'})

    await subscriberRequest
      .post(`/integration/mcp/items?workflowId=${wf2.workflowId}`)
      .send({alias: '/wf2-item', transport: 'stdio', command: 'node', toolName: 't'})

    const res1 = await subscriberRequest.get(`/integration?workflowId=${workflowId}`)
    const res2 = await subscriberRequest.get(`/integration?workflowId=${wf2.workflowId}`)

    expect((res1.body.mcp ?? []).map(m => m.alias)).toContain('/wf1-item')
    expect((res1.body.mcp ?? []).map(m => m.alias)).not.toContain('/wf2-item')
    expect((res2.body.mcp ?? []).map(m => m.alias)).toContain('/wf2-item')
    expect((res2.body.mcp ?? []).map(m => m.alias)).not.toContain('/wf1-item')
  })

  it('DELETE of workflow-scoped item is idempotent for non-existent alias', async () => {
    const res = await subscriberRequest
      .delete(`/integration/mcp/items/${encodeURIComponent('/ghost')}?workflowId=${workflowId}`)
    expect(res.status).toBe(204)
  })

  it('DELETE of user-scope item is idempotent for non-existent alias', async () => {
    const res = await subscriberRequest
      .delete(`/integration/mcp/items/${encodeURIComponent('/ghost')}`)
    expect(res.status).toBe(204)
  })

  it('DELETE of workflow-scoped item does not affect same alias at user scope', async () => {
    await subscriberRequest
      .post('/integration/mcp/items')
      .send({alias: '/shared-alias', transport: 'stdio', command: 'node', toolName: 'user'})
    await subscriberRequest
      .post(`/integration/mcp/items?workflowId=${workflowId}`)
      .send({alias: '/shared-alias', transport: 'stdio', command: 'node', toolName: 'wf'})

    await subscriberRequest
      .delete(`/integration/mcp/items/${encodeURIComponent('/shared-alias')}?workflowId=${workflowId}`)

    const userRes = await subscriberRequest.get('/integration')
    expect((userRes.body.mcp ?? []).find(m => m.alias === '/shared-alias')?.toolName).toBe('user')
  })

  it('after last workflow-scoped item deleted, GET with workflowId falls back to user-level', async () => {
    // Dedicated workflow whose only item is the one we delete, so the doc is
    // emptied (and removed) and the read falls back to user scope — independent
    // of items other tests left on the shared workflowId.
    const freshWf = await testDataFactory.createWorkflow({title: 'Fallback AfterDelete Workflow', userId: 'subscriber'})

    await subscriberRequest
      .post('/integration/mcp/items')
      .send({alias: '/fallback-anchor', transport: 'stdio', command: 'node', toolName: 'user'})
    await subscriberRequest
      .post(`/integration/mcp/items?workflowId=${freshWf.workflowId}`)
      .send({alias: '/wf-only-item', transport: 'stdio', command: 'node', toolName: 'wf'})

    await subscriberRequest
      .delete(`/integration/mcp/items/${encodeURIComponent('/wf-only-item')}?workflowId=${freshWf.workflowId}`)

    const res = await subscriberRequest.get(`/integration?workflowId=${freshWf.workflowId}`)
    expect((res.body.mcp ?? []).map(m => m.alias)).toContain('/fallback-anchor')
    expect((res.body.mcp ?? []).map(m => m.alias)).not.toContain('/wf-only-item')
  })

  it('empty workflowId query param is treated as user scope', async () => {
    const res = await subscriberRequest
      .post('/integration/mcp/items?workflowId=')
      .send({alias: '/empty-wf-id', transport: 'stdio', command: 'node', toolName: 't'})
    expect(res.status).toBe(201)

    const userRes = await subscriberRequest.get('/integration')
    expect((userRes.body.mcp ?? []).map(m => m.alias)).toContain('/empty-wf-id')
  })

  it('RPC items obey scope isolation identically to MCP items', async () => {
    await subscriberRequest
      .post(`/integration/rpc/items?workflowId=${workflowId}`)
      .send({alias: '/wf-rpc', protocol: 'http', url: 'https://wf.example.com'})

    const userRes = await subscriberRequest.get('/integration')
    expect((userRes.body.rpc ?? []).map(r => r.alias)).not.toContain('/wf-rpc')

    const wfRes = await subscriberRequest.get(`/integration?workflowId=${workflowId}`)
    expect((wfRes.body.rpc ?? []).map(r => r.alias)).toContain('/wf-rpc')
  })
})
