import Request from 'supertest'
import app from '../../app'
import {API_BASE_PATH} from '../../shared/config/constants'
import {administrator, customer, subscriber, syncuser, subscriberSocket} from './users'
import generateAuth from '../../controllers/utils/generateAuth'

const createUserHandler = user => ({
  get: (obj, prop) => url =>
    obj[prop](`${API_BASE_PATH}${url}`).set('Authorization', `Bearer ${generateAuth(user).access_token}`),
})

const appRequest = new Request(app.callback())

export const subscriberRequest = new Proxy(appRequest, createUserHandler(subscriber))

export const subscriberSocketRequest = new Proxy(appRequest, createUserHandler(subscriberSocket))

export const administratorRequest = new Proxy(appRequest, createUserHandler(administrator))

export const customerRequest = new Proxy(appRequest, createUserHandler(customer))

export const syncRequest = new Proxy(appRequest, createUserHandler(syncuser))

const publicHandler = {
  get: (obj, prop) => url => obj[prop](`${API_BASE_PATH}${url}`),
}

export const publicRequest = new Proxy(appRequest, publicHandler)
