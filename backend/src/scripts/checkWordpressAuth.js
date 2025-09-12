import jwt from 'jsonwebtoken'
import fetch from 'node-fetch'

import {JWT_SECRET, USER_AUTH_URL, USER_REFRESH_URL} from '../constants'

const {USERNAME: username, PASSWORD: password} = process.env

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

async function run() {
  const response = await fetch(USER_AUTH_URL, {
    method: 'POST',
    body: JSON.stringify({username, password}),
    headers: {
      'Content-Type': 'application/json',
    },
  })

  const json = await response.json()

  const {access_token, refresh_token: token} = json

  const payload = jwt.verify(access_token, JWT_SECRET)

  console.log(json, payload, access_token)

  for (const i of Array(10000).keys()) {
    await sleep(30000)

    const refreshResponse = await fetch(USER_REFRESH_URL, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({token}),
    })
    const refreshJson = await refreshResponse.json()

    const {access_token: refreshAccessToken} = refreshJson

    const refresh = jwt.verify(refreshAccessToken, JWT_SECRET)

    console.log(i, refresh, refreshJson)
  }
}

run()
