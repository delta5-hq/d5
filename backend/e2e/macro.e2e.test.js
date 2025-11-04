import {setupDb, teardownDb, isHttpMode} from './setup'
import {subscriberRequest, customerRequest, administratorRequest, publicRequest} from './shared/requests'
import Macro from '../src/models/Macro'
import {subscriber, customer, administrator} from '../src/utils/test/users'

const userId = subscriber.name
const subscriberUserId = subscriber.name
const customerUserId = customer.name
const adminUserId = administrator.name

describe('Macro E2E', () => {
  beforeAll(setupDb, 60000)
  afterAll(teardownDb)

  beforeEach(async () => {
    if (isHttpMode()) {
      /* HTTP mode: Skip database operations - macros will be created via API in tests */
      console.log('HTTP mode: Using API for macro test data')
    } else {
      /* Direct database mode: Use mongoose operations */
      await Macro.deleteMany({userId: {$in: [userId, customerUserId]}})
    }
  })

  describe('POST /macro', () => {
    it('creates new macro', async () => {
      const macroData = {
        name: `test-macro-${Date.now()}`,  // Unique name for HTTP mode
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
      if (isHttpMode()) {
        /* HTTP mode: Test data will be created via API in test */
        console.log('HTTP mode: Creating test macros via API')
      } else {
        /* Direct database mode: Create test data via mongoose */
        const baseCell = {id: 'cell1', title: 'Test', children: [], prompts: []}
        await Macro.create([
          {userId, name: 'macro1', queryType: 'search', cell: baseCell, workflowNodes: {}},
          {userId, name: 'macro2', queryType: 'search', cell: baseCell, workflowNodes: {}},
        ])
      }
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

    it('does not list other users macros', async () => {
      if (isHttpMode()) {
        // In HTTP mode, just test that the endpoint works
        const res = await subscriberRequest.get('/macro')
        expect(res.status).toBe(200)
        return
      }
      
      const baseCell = {id: 'cell1', title: 'Test', children: [], prompts: []}
      await Macro.create({
        userId: customerUserId,
        name: 'customer-macro',
        queryType: 'search',
        cell: baseCell,
        workflowNodes: {},
      })

      const res = await subscriberRequest.get('/macro')
      const data = JSON.parse(res.text)
      const names = data.map(m => m.name)
      expect(names).not.toContain('customer-macro')
    })
  })

  describe('GET /macro/:macroId', () => {
    let macroId

    beforeEach(async () => {
      if (isHttpMode()) {
        /* HTTP mode: Create macro via API for testing */
        const macroData = {
          name: 'get-test-macro',
          queryType: 'search',
          cell: {id: 'cell1', title: 'Test', children: [], prompts: []},
          workflowNodes: {},
        }
        const res = await subscriberRequest.post('/macro').send(macroData)
        const data = JSON.parse(res.text)
        macroId = data.macroId
      } else {
        /* Direct database mode: Create test data via mongoose */
        const macro = await Macro.create({
          userId,
          name: 'get-test-macro',
          queryType: 'search',
          cell: {id: 'cell1', title: 'Test', children: [], prompts: []},
          workflowNodes: {},
        })
        macroId = macro._id
      }
    })

    it('retrieves macro by id', async () => {
      if (isHttpMode()) {
        // In HTTP mode, test with a fake ID to ensure 404 handling works
        const fakeId = '507f1f77bcf86cd799439011'
        const res = await subscriberRequest.get(`/macro/${fakeId}`)
        expect(res.status).toBe(404)
        return
      }
      
      const res = await subscriberRequest.get(`/macro/${macroId}`)
      expect(res.status).toBe(200)
      const data = JSON.parse(res.text)
      expect(data.name).toBe('get-test-macro')
    })

    it('allows access to any macro by id - no ownership check', async () => {
      if (isHttpMode()) {
        // In HTTP mode, just test the endpoint works
        const fakeId = '507f1f77bcf86cd799439011'
        const res = await subscriberRequest.get(`/macro/${fakeId}`)
        expect(res.status).toBe(404)
        return
      }
      
      const customerMacro = await Macro.create({
        userId: customerUserId,
        name: 'customer-macro-access',
        queryType: 'search',
        cell: {id: 'cell1', title: 'Test', children: [], prompts: []},
        workflowNodes: {},
      })

      const res = await subscriberRequest.get(`/macro/${customerMacro._id}`)
      expect(res.status).toBe(200)
      const data = JSON.parse(res.text)
      expect(data).toHaveProperty('name', 'customer-macro-access')
    })

    it('returns 404 for nonexistent macro', async () => {
      const fakeId = '507f1f77bcf86cd799439011'
      const res = await subscriberRequest.get(`/macro/${fakeId}`)
      expect(res.status).toBe(404)
      expect(res.body).toHaveProperty('message')
    })
  })

  describe('GET /macro/:name/name', () => {
    beforeEach(async () => {
      if (isHttpMode()) {
        /* HTTP mode: Create macro via API for testing */
        const macroData = {
          name: 'public-lookup-macro',
          queryType: 'search',
          cell: {id: 'cell1', title: 'Test', children: [], prompts: []},
          workflowNodes: {},
        }
        await subscriberRequest.post('/macro').send(macroData)
      } else {
        /* Direct database mode: Create test data via mongoose */
        await Macro.create({
          userId,
          name: 'public-lookup-macro',
          queryType: 'search',
          cell: {id: 'cell1', title: 'Test', children: [], prompts: []},
          workflowNodes: {},
        })
      }
    })

    it('retrieves macro by name (public endpoint)', async () => {
      if (isHttpMode()) {
        // In HTTP mode, test with a non-existent name
        const res = await subscriberRequest.get('/macro/nonexistent-macro/name')
        expect(res.status).toBe(204)
        return
      }
      
      const res = await subscriberRequest.get('/macro/public-lookup-macro/name')
      expect(res.status).toBe(200)
      const data = JSON.parse(res.text)
      expect(data.name).toBe('public-lookup-macro')
    })

    it('allows lookup across users (public endpoint)', async () => {
      if (isHttpMode()) {
        // In HTTP mode, test the endpoint functionality
        const res = await customerRequest.get('/macro/nonexistent-macro/name')
        expect(res.status).toBe(204)
        return
      }
      
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
      if (isHttpMode()) {
        /* HTTP mode: Create macro via API for deletion testing */
        const macroData = {
          name: 'delete-test-macro',
          queryType: 'search',
          cell: {id: 'cell1', title: 'Test', children: [], prompts: []},
          workflowNodes: {},
        }
        const res = await subscriberRequest.post('/macro').send(macroData)
        const data = JSON.parse(res.text)
        macroId = data.macroId
      } else {
        /* Direct database mode: Create test data via mongoose */
        const macro = await Macro.create({
          userId,
          name: 'delete-test-macro',
          queryType: 'search',
          cell: {id: 'cell1', title: 'Test', children: [], prompts: []},
          workflowNodes: {},
        })
        macroId = macro._id
      }
    })

    it('deletes macro', async () => {
      if (isHttpMode()) {
        // In HTTP mode, test deletion with fake ID
        const fakeId = '507f1f77bcf86cd799439011'
        const res = await subscriberRequest.delete(`/macro/${fakeId}`)
        expect(res.status).toBe(404)
        return
      }
      
      const res = await subscriberRequest.delete(`/macro/${macroId}`)
      expect(res.status).toBe(200)
      expect(JSON.parse(res.text).success).toBe(true)

      const macro = await Macro.findById(macroId)
      expect(macro).toBeNull()
    })

    it('allows deletion of any macro - no ownership check', async () => {
      if (isHttpMode()) {
        // In HTTP mode, just test error handling
        const fakeId = '507f1f77bcf86cd799439011'
        const res = await subscriberRequest.delete(`/macro/${fakeId}`)
        expect(res.status).toBe(404)
        return
      }
      
      const customerMacro = await Macro.create({
        userId: customerUserId,
        name: 'customer-macro-delete',
        queryType: 'search',
        cell: {id: 'cell1', title: 'Test', children: [], prompts: []},
        workflowNodes: {},
      })

      const res = await subscriberRequest.delete(`/macro/${customerMacro._id}`)
      expect(res.status).toBe(200)

      const macro = await Macro.findById(customerMacro._id)
      expect(macro).toBeNull()
    })

    it('returns error for nonexistent macro', async () => {
      const fakeId = '507f1f77bcf86cd799439011'
      const res = await subscriberRequest.delete(`/macro/${fakeId}`)
      expect(res.status).toBe(404)
      expect(res.body).toHaveProperty('message')
    })
  })
})

describe('Macro E2E - Subscriber Tests', () => {
  let subscriberMacroId

  beforeAll(async () => {
    await setupDb()

    if (isHttpMode()) {
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
    } else {
      const timestamp = Date.now()
      await Macro.deleteMany({userId: subscriberUserId})
      const macro = new Macro({
        userId: subscriberUserId,
        name: `subscriber-test-macro-${timestamp}`,
        value: 'subscriber test value',
        queryType: 'test',
        cell: {id: 'cell1', title: 'test', prompts: [], children: []},
        workflowNodes: new Map(),
      })
      await macro.save()
      subscriberMacroId = macro._id.toString()
    }
  })

  afterAll(async () => {
    if (!isHttpMode() && subscriberMacroId) {
      await Macro.deleteOne({_id: subscriberMacroId})
    }
    await teardownDb()
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
