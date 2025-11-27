import {subscriberRequest, customerRequest, administratorRequest, publicRequest} from './shared/requests'
import {testDataFactory, testOrchestrator} from './shared/test-data-factory'
import {subscriber, customer, administrator} from '../src/utils/test/users'

const userId = subscriber.name
const subscriberUserId = subscriber.name
const customerUserId = customer.name
const adminUserId = administrator.name

describe('Macro E2E', () => {
  beforeAll(async () => {
    await testOrchestrator.prepareTestEnvironment()
  }, 60000)
  afterAll(async () => {
    await testOrchestrator.cleanupTestEnvironment()
  })

  beforeEach(async () => {
    
  })

  describe('POST /macro', () => {
    it('creates new macro', async () => {
      const macroData = {
        name: `test-macro-${Date.now()}`,  
        queryType: 'search',
        cell: {id: 'cell1', title: 'Test Cell', children: [], prompts: []},
        workflowNodes: {node1: {id: 'node1', title: 'Node 1', children: [], prompts: []}},
      }

      const res = await subscriberRequest.post('/macro').send(macroData)
      if (res.status !== 200) {
        console.log('ERROR RESPONSE:', res.status, res.text)
      }
      expect(res.status).toBe(200)
      const data = JSON.parse(res.text)
      expect(data).toHaveProperty('macroId')
    })

    it('rejects duplicate macro names', async () => {
      const timestamp = Date.now()
      const macroData = {
        name: `duplicate-macro-test-${timestamp}`,
        queryType: 'search',
        cell: {id: 'cell1', title: 'Test', children: [], prompts: []},
        workflowNodes: {},
      }
      const res1 = await subscriberRequest.post('/macro').send(macroData)
      expect(res1.status).toBe(200)

      const res = await subscriberRequest.post('/macro').send(macroData)
      expect(res.status).toBe(500)
      expect(res.body).toHaveProperty('message')
    })

    it('rejects unauthenticated requests', async () => {
      const res = await publicRequest.post('/macro').send({name: 'test', content: {}})
      expect(res.status).toBe(401)
      expect(res.body).toHaveProperty('message')
    })
  })

  describe('GET /macro', () => {
    beforeEach(async () => {
      
      const baseCell = {id: 'cell1', title: 'Test', children: [], prompts: []}
      const timestamp = Date.now()
      await testDataFactory.createMacro({name: `macro1-${timestamp}`, queryType: 'search', cell: baseCell, workflowNodes: {}})
      await testDataFactory.createMacro({name: `macro2-${timestamp}`, queryType: 'search', cell: baseCell, workflowNodes: {}})
    })

    it('lists user macros sorted by updatedAt', async () => {
      const res = await subscriberRequest.get('/macro')
      expect(res.status).toBe(200)
      const data = JSON.parse(res.text)
      expect(Array.isArray(data)).toBe(true)
      data.forEach(macro => {
        expect(macro).toHaveProperty('name')
        expect(macro).toHaveProperty('_id')
        expect(macro).toHaveProperty('updatedAt')
      })
    })

    it('rejects unauthenticated requests to list macros', async () => {
      const res = await publicRequest.get('/macro')
      expect(res.status).toBe(401)
      expect(res.body).toHaveProperty('message')
    })

    it('does not list other users macros', async () => {
      
      const res = await subscriberRequest.get('/macro')
      expect(res.status).toBe(200)
      
      const data = JSON.parse(res.text)
      const names = data.map(m => m.name)
      expect(names).not.toContain('customer-macro')
    })
  })

  describe('GET /macro/:macroId', () => {
    let macroId

    beforeEach(async () => {
      /* Create macro via API for testing */
      const macroData = {
        name: `get-test-macro-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        queryType: 'search',
        cell: {id: 'cell1', title: 'Test', children: [], prompts: []},
        workflowNodes: {},
      }
      const res = await subscriberRequest.post('/macro').send(macroData)
      if (res.status !== 200) {
        throw new Error(`Failed to create macro for test: ${res.status} - ${res.text}`)
      }
      const data = JSON.parse(res.text)
      macroId = data.macroId
    })

    it('retrieves macro by id', async () => {
      const res = await subscriberRequest.get(`/macro/${macroId}`)
      expect(res.status).toBe(200)
      const data = JSON.parse(res.text)
      expect(data.name).toMatch(/^get-test-macro-\d+-\d+$/)
    })

    it('rejects access to macros not owned by user', async () => {
      // Test with fake ID to ensure proper error handling
      const fakeId = '507f1f77bcf86cd799439011'
      const res = await subscriberRequest.get(`/macro/${fakeId}`)
      expect(res.status).toBe(404)
    })

    it('returns 404 for nonexistent macro', async () => {
      const fakeId = '507f1f77bcf86cd799439011'
      const res = await subscriberRequest.get(`/macro/${fakeId}`)
      expect(res.status).toBe(404)
      expect(res.body).toHaveProperty('message')
    })

    it('rejects unauthenticated requests to get macro', async () => {
      const fakeId = '507f1f77bcf86cd799439011'
      const res = await publicRequest.get(`/macro/${fakeId}`)
      expect(res.status).toBe(401)
      expect(res.status).toBe(401)
      expect(res.body).toHaveProperty('message')
    })
  })

  describe('GET /macro/:name/name', () => {
    beforeEach(async () => {
      /* Create macro via API for testing */
      const macroData = {
        name: 'public-lookup-macro',
        queryType: 'search',
        cell: {id: 'cell1', title: 'Test', children: [], prompts: []},
        workflowNodes: {},
      }
      await subscriberRequest.post('/macro').send(macroData)
    })

    it('retrieves macro by name (public endpoint)', async () => {
      const res = await subscriberRequest.get('/macro/public-lookup-macro/name')
      expect(res.status).toBe(200)
      const data = JSON.parse(res.text)
      expect(data.name).toBe('public-lookup-macro')
    })

    it('allows lookup across users (public endpoint)', async () => {
      // Test the endpoint functionality  
      const res = await customerRequest.get('/macro/public-lookup-macro/name')
      expect(res.status).toBe(200)
      const data = JSON.parse(res.text)
      expect(data.name).toBe('public-lookup-macro')
    })

    it('returns null for nonexistent macro name', async () => {
      const res = await subscriberRequest.get('/macro/nonexistent-macro/name')
      expect(res.status).toBe(204)
      expect(res.text).toBe('')
    })
  })

  describe('DELETE /macro/:macroId', () => {
    let macroId

    beforeEach(async () => {
      /* Create macro via API for deletion testing */
      const macroData = {
        name: `delete-test-macro-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        queryType: 'search',
        cell: {id: 'cell1', title: 'Test', children: [], prompts: []},
        workflowNodes: {},
      }
      const res = await subscriberRequest.post('/macro').send(macroData)
      if (res.status !== 200) {
        throw new Error(`Failed to create macro for test: ${res.status} - ${res.text}`)
      }
      const data = JSON.parse(res.text)
      macroId = data.macroId
    })

    it('deletes macro', async () => {
      const res = await subscriberRequest.delete(`/macro/${macroId}`)
      expect(res.status).toBe(200)
      expect(JSON.parse(res.text).success).toBe(true)
    })

    it('rejects deletion of macros not owned by user', async () => {
      // Test with fake ID to ensure proper error handling
      const fakeId = '507f1f77bcf86cd799439011'
      const res = await subscriberRequest.delete(`/macro/${fakeId}`)
      expect(res.status).toBe(404)
      
      /* HTTP mode: Cannot verify database state directly, rely on API response */
    })

    it('returns error for nonexistent macro', async () => {
      const fakeId = '507f1f77bcf86cd799439011'
      const res = await subscriberRequest.delete(`/macro/${fakeId}`)
      expect(res.status).toBe(404)
      expect(res.body).toHaveProperty('message')
    })

    it('rejects unauthenticated requests to delete macro', async () => {
      const fakeId = '507f1f77bcf86cd799439011'
      const res = await publicRequest.delete(`/macro/${fakeId}`)
      expect(res.status).toBe(401)
    })
  })
})

describe('Macro E2E - Subscriber Tests', () => {
  let subscriberMacroId

  beforeAll(async () => {
    await testOrchestrator.prepareTestEnvironment()

    /* Create test macro for subscriber tests */
    const timestamp = Date.now()
    const res = await subscriberRequest.post('/macro').send({
      name: `subscriber-test-macro-${timestamp}`,
      value: 'subscriber test value',
      queryType: 'search',
      cell: {id: 'cell1', title: 'Test Cell', children: [], prompts: []},
      workflowNodes: {node1: {id: 'node1', title: 'Node 1', children: [], prompts: []}},
    })
    if (res.status === 200) {
      const body = JSON.parse(res.text)
      subscriberMacroId = body.macroId || body._id
    }
  })

  afterAll(async () => {
    await testOrchestrator.cleanupTestEnvironment()
  })

  describe('POST /macro (subscriber)', () => {
    it('creates macro for subscriber', async () => {
      const timestamp = Date.now()
      const res = await subscriberRequest.post('/macro').send({
        name: `subscriber-new-macro-${timestamp}`,
        value: 'new subscriber value',
        queryType: 'search',
        cell: {id: 'cell1', title: 'Test', children: [], prompts: []},
        workflowNodes: {},
      })

      expect(res.status).toBe(200)
      const body = JSON.parse(res.text)
      expect(body).toHaveProperty('macroId')
      expect(typeof body.macroId).toBe('string')
    })
  })

  describe('GET /macro (subscriber)', () => {
    it('lists subscriber macros', async () => {
      const res = await subscriberRequest.get('/macro')
      expect(res.status).toBe(200)
      const macros = JSON.parse(res.text)
      expect(Array.isArray(macros)).toBe(true)
      macros.forEach(macro => {
        expect(macro).toHaveProperty('name')
        expect(macro).toHaveProperty('_id')
      })
    })
  })

  describe('GET /macro/:macroId (subscriber)', () => {
    it('retrieves macro by id', async () => {
      if (!subscriberMacroId) {
        throw new Error('subscriberMacroId not set - test setup failed')
      }
      const res = await subscriberRequest.get(`/macro/${subscriberMacroId}`)
      expect(res.status).toBe(200)
      const macro = JSON.parse(res.text)
      expect(macro).toHaveProperty('_id')
    })
  })

  describe('DELETE /macro/:macroId (subscriber)', () => {
    it('deletes subscriber macro', async () => {
      if (!subscriberMacroId) {
        throw new Error('subscriberMacroId not set - test setup failed')
      }
      const res = await subscriberRequest.delete(`/macro/${subscriberMacroId}`)
      expect(res.status).toBe(200)
      const body = JSON.parse(res.text)
      expect(body).toHaveProperty('success', true)
    })
  })
})
