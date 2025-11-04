import {describe, beforeEach, afterAll, it, expect} from '@jest/globals'
import {setupDb, teardownDb, isHttpMode} from './setup'
import {subscriberRequest, syncRequest, administratorRequest} from './shared/requests'
import {testHybridFilter} from './shared/test-constants'
import User from '../src/models/User'

describe('User Router', () => {
  const timestamp = Date.now()
  const name = `importtestuser-${timestamp}`
  const mail = `import1-${timestamp}@example.com`
  const userData = {id: name, name, mail}
  const mail2 = `import2-${timestamp}@example.com`
  const userData2 = {id: name, name, mail: mail2}
  const otherUserData = {id: `otherimporttestuser-${timestamp}`, name: `otherimporttestuser-${timestamp}`, mail: `other-${timestamp}@example.com`}

  beforeEach(async () => {
    await setupDb()
    
    /* Only skip database operations in HTTP mode - keep test execution */
    if (!isHttpMode()) {
      await User.deleteMany(testHybridFilter('id', 'name'))
    }
  })

  afterAll(async () => {
    if (!isHttpMode()) {
      await User.deleteMany(testHybridFilter('id', 'name'))
    }
    await teardownDb()
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

      if (!isHttpMode()) {
        /* Only check database in direct mode */
        const user = await User.findOne({name})
        expect(user).toBeTruthy()
        expect(user).toMatchObject(userData)
      }
    }, 10000)

    it('updates existing user in database', async () => {
      await syncRequest.post('/sync/users').send(userData)
      
      const response = await syncRequest.post('/sync/users').send(userData2)

      expect(response.status).toBe(200)
      const data = JSON.parse(response.res.text)
      expect(data.success).toBe(true)

      if (!isHttpMode()) {
        /* Only check database in direct mode */
        const user = await User.findOne({name})
        expect(user).toBeTruthy()
        expect(user).toMatchObject(userData2)
      }
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

      if (!isHttpMode()) {
        /* Only check database in direct mode */
        const user = await User.findOne({name})
        expect(user).toBeTruthy()
        expect(user).toMatchObject(userData)

        const otherUser = await User.findOne({name: otherUserData.name})
        expect(otherUser).toBeTruthy()
        expect(otherUser).toMatchObject(otherUserData)
      }
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
})
