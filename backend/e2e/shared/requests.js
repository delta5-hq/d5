import Request from 'supertest'
import app from '../../src/app'
import {administrator, customer, subscriber, syncuser} from '../../src/utils/test/users'
import generateAuth from '../../src/controllers/utils/generateAuth'

const API_BASE_PATH = process.env.E2E_API_BASE_PATH || '/api/v1'

const createUserHandler = user => ({
  get: (obj, prop) => url =>
    obj[prop](`${API_BASE_PATH}${url}`).set('Authorization', `Bearer ${generateAuth(user).access_token}`),
})

function createAppRequest() {
  return process.env.E2E_SERVER_URL
    ? new Request(process.env.E2E_SERVER_URL)
    : new Request(app.callback())
}

export const subscriberRequest = new Proxy(createAppRequest(), createUserHandler(subscriber))
export const administratorRequest = new Proxy(createAppRequest(), createUserHandler(administrator))
export const customerRequest = new Proxy(createAppRequest(), createUserHandler(customer))
export const syncRequest = new Proxy(createAppRequest(), createUserHandler(syncuser))

const publicHandler = {
  get: (obj, prop) => url => obj[prop](`${API_BASE_PATH}${url}`),
}

export const publicRequest = new Proxy(createAppRequest(), publicHandler)

const rawHandler = {
  get: (obj, prop) => url => {
    if (!url || !url.startsWith('/')) {
      return obj[prop](url)
    }
    const rewrittenUrl = url.startsWith('/api/') 
      ? url.replace(/^\/api\/v1/, API_BASE_PATH)
      : `${API_BASE_PATH}${url}`
    return obj[prop](rewrittenUrl)
  },
}

export const rawRequest = new Proxy(createAppRequest(), rawHandler)