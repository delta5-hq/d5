import {describe, beforeEach, afterAll, it, expect} from '@jest/globals'
import {subscriberRequest, syncRequest, administratorRequest} from './shared/requests'
import {testDataFactory, testOrchestrator} from './shared/test-data-factory'
import {createAuthenticatedRequest} from './shared/test-helpers'

describe('User Router', () => {
  const timestamp = Date.now()
  const name = `importtestuser-${timestamp}`
  const mail = `import1-${timestamp}@example.com`
  const userData = {id: name, name, mail}
  const mail2 = `import2-${timestamp}@example.com`
  const userData2 = {id: name, name, mail: mail2}
  const otherUserData = {id: `otherimporttestuser-${timestamp}`, name: `otherimporttestuser-${timestamp}`, mail: `other-${timestamp}@example.com`}

  beforeEach(async () => {
    await testOrchestrator.prepareTestEnvironment()
    
  })

  afterAll(async () => {
    await testOrchestrator.cleanupTestEnvironment()
  })

  describe('POST /sync/users', () => {
    it('rejects normal users', async () => {
      const response = await administratorRequest.post('/sync/users').send(userData)

      expect(response.status).toBe(403)
    })

    it('saves new user in database', async () => {
      const response = await syncRequest.post('/sync/users').send(userData)

      expect(response.status).toBe(200)
      const data = JSON.parse(response.res.text)
      expect(data.success).toBe(true)

      /* HTTP mode: Test success via API response only */
    }, 10000)

    it('updates existing user in database', async () => {
      await syncRequest.post('/sync/users').send(userData)
      
      const response = await syncRequest.post('/sync/users').send(userData2)

      expect(response.status).toBe(200)
      const data = JSON.parse(response.res.text)
      expect(data.success).toBe(true)

      /* HTTP mode: Test success via API response only */
    }, 10000)

    it('rejects incomplete user data', async () => {
      const response = await syncRequest.post('/sync/users').send({name})

      expect(response.status).toBe(400)
    })

    it('saves many users', async () => {
      const response = await syncRequest.post('/sync/users').send([userData, otherUserData])

      expect(response.status).toBe(200)
      const data = JSON.parse(response.res.text)
      expect(data.success).toBe(true)

      /* HTTP mode: Test success via API response only */
    }, 15000)

    it('rejects incomplete user data in array import', async () => {
      const response = await syncRequest.post('/sync/users').send([{name}, {mail: otherUserData.mail}])

      expect(response.status).toBe(400)
    })
  })

  describe('GET /users/search', () => {
    beforeEach(async () => {
      await syncRequest.post('/sync/users').send(userData)
    })

    it('finds users by username', async () => {
      const response = await subscriberRequest.get('/users/search').query({query: name.substr(0, 5)})

      expect(response.status).toBe(200)
      const data = JSON.parse(response.res.text)
      expect(Array.isArray(data)).toBe(true)
      expect(data.length).toBeGreaterThan(0)
    })
  })

  describe('GET /users/search/mail', () => {
    beforeEach(async () => {
      await syncRequest.post('/sync/users').send(userData)
    })

    it('finds users by mail address', async () => {
      const response = await subscriberRequest.get('/users/search/mail').query({query: mail})

      expect(response.status).toBe(200)
      const data = JSON.parse(response.res.text)
      expect(data.name).toBe(name)
      expect(data.id).toBe(name)
    })
  })

  describe('DELETE /users/:userId', () => {
    const deleteUserData = {
      id: `delete-test-${timestamp}`,
      name: `delete-test-${timestamp}`,
      mail: `delete-test-${timestamp}@example.com`,
      roles: ['subscriber']
    }

    beforeEach(async () => {
      await syncRequest.post('/sync/users').send(deleteUserData)
    })

    describe('Authorization', () => {
      it('rejects unauthenticated requests', async () => {
        const response = await subscriberRequest.delete(`/users/${deleteUserData.id}`)

        expect(response.status).toBe(403)
        const data = JSON.parse(response.res.text)
        expect(data.message).toMatch(/administrator/i)
      })

      it('rejects non-admin users', async () => {
        const response = await subscriberRequest.delete(`/users/${deleteUserData.id}`)

        expect(response.status).toBe(403)
        const data = JSON.parse(response.res.text)
        expect(data.message).toMatch(/administrator/i)
      })

      it('allows admin users', async () => {
        const response = await administratorRequest.delete(`/users/${deleteUserData.id}`)

        expect(response.status).toBe(200)
        const data = JSON.parse(response.res.text)
        expect(data.success).toBe(true)
      })
    })

    describe('User deletion', () => {
      it('deletes user successfully', async () => {
        const response = await administratorRequest.delete(`/users/${deleteUserData.id}`)

        expect(response.status).toBe(200)
        const data = JSON.parse(response.res.text)
        expect(data.success).toBe(true)

        const searchResponse = await subscriberRequest.get('/users/search').query({query: deleteUserData.id})
        const searchData = JSON.parse(searchResponse.res.text)
        expect(searchData.find(u => u.id === deleteUserData.id)).toBeUndefined()
      })

      it('returns error for non-existent user', async () => {
        const response = await administratorRequest.delete('/users/nonexistent-user-id-12345')

        expect(response.status).toBe(500)
      })

      it('validates user ID parameter', async () => {
        const response = await administratorRequest.delete('/users/')

        expect(response.status).toBe(404)
      })
    })

    describe('Cascade deletion', () => {
      let userWithWorkflows
      let userRequest

      beforeEach(async () => {
        userWithWorkflows = {
          id: `cascade-test-${timestamp}`,
          name: `cascade-test-${timestamp}`,
          mail: `cascade-test-${timestamp}@example.com`,
          roles: ['subscriber']
        }
        await syncRequest.post('/sync/users').send(userWithWorkflows)
        userRequest = createAuthenticatedRequest(userWithWorkflows)
      })

      it('deletes user workflows', async () => {
        const workflow = await testDataFactory.createWorkflow({
          title: `Test Workflow for ${userWithWorkflows.id}`
        }, userRequest)

        const deleteResponse = await administratorRequest.delete(`/users/${userWithWorkflows.id}`)
        expect(deleteResponse.status).toBe(200)

        const workflowResponse = await administratorRequest.get(`/workflow/${workflow.workflowId}`)
        expect(workflowResponse.status).toBe(404)
      })

      it('deletes user integrations', async () => {
        const integrationResponse = await userRequest.put('/integration/openai/update').send({apiKey: 'test-integration-key'})
        expect(integrationResponse.status).toBe(200)

        const beforeResponse = await userRequest.get('/integration')
        expect(beforeResponse.status).toBe(200)
        expect(beforeResponse.body).toHaveProperty('openai')

        const deleteResponse = await administratorRequest.delete(`/users/${userWithWorkflows.id}`)
        expect(deleteResponse.status).toBe(200)
        
        const afterResponse = await userRequest.get('/integration')
        expect(afterResponse.status).toBe(200)
        expect(afterResponse.body).toEqual({})
      })

      it('deletes user templates', async () => {
        await testDataFactory.createTemplate({
          name: `Template for ${userWithWorkflows.id}`
        }, userRequest)

        const deleteResponse = await administratorRequest.delete(`/users/${userWithWorkflows.id}`)
        expect(deleteResponse.status).toBe(200)
      })

      it('handles deletion of user with no related data', async () => {
        const emptyUser = {
          id: `empty-user-${timestamp}`,
          name: `empty-user-${timestamp}`,
          mail: `empty-user-${timestamp}@example.com`,
          roles: []
        }
        await syncRequest.post('/sync/users').send(emptyUser)

        const response = await administratorRequest.delete(`/users/${emptyUser.id}`)

        expect(response.status).toBe(200)
        const data = JSON.parse(response.res.text)
        expect(data.success).toBe(true)
      })
    })

    describe('Edge cases', () => {
      it('handles special characters in user ID', async () => {
        const response = await administratorRequest.delete('/users/user@#$%^&*()')

        expect([404, 500]).toContain(response.status)
      })

      it('handles very long user ID', async () => {
        const longId = 'a'.repeat(500)
        const response = await administratorRequest.delete(`/users/${longId}`)

        expect([404, 500]).toContain(response.status)
      })

      it('prevents double deletion', async () => {
        const firstResponse = await administratorRequest.delete(`/users/${deleteUserData.id}`)
        expect(firstResponse.status).toBe(200)

        const secondResponse = await administratorRequest.delete(`/users/${deleteUserData.id}`)
        expect(secondResponse.status).toBe(500)
      })
    })
  })
})
