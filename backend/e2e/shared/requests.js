import Request from 'supertest'
import app from '../../src/app'
import {administrator, customer, subscriber, syncuser} from '../../src/utils/test/users'
import generateAuth from '../../src/controllers/utils/generateAuth'

const API_BASE_PATH = process.env.E2E_API_BASE_PATH || '/api/v1'

const createUserHandler = user => ({
  get: (obj, prop) => url =>
    obj[prop](`${API_BASE_PATH}${url}`).set('Authorization', `Bearer ${generateAuth(user).access_token}`),
})

const appRequest = process.env.E2E_SERVER_URL
  ? new Request(process.env.E2E_SERVER_URL)
  : new Request(app.callback())

export const subscriberRequest = new Proxy(appRequest, createUserHandler(subscriber))
export const administratorRequest = new Proxy(appRequest, createUserHandler(administrator))
export const customerRequest = new Proxy(appRequest, createUserHandler(customer))
export const syncRequest = new Proxy(appRequest, createUserHandler(syncuser))

const publicHandler = {
  get: (obj, prop) => url => obj[prop](`${API_BASE_PATH}${url}`),
}

export const publicRequest = new Proxy(appRequest, publicHandler)

const rawHandler = {
  get: (obj, prop) => url => obj[prop](url),
}

export const rawRequest = new Proxy(appRequest, rawHandler)