import jwt from 'jsonwebtoken'

import * as constants from '../constants'
import User from '../models/User'
import generateAuth from './utils/generateAuth'
import Waitlist from '../models/Waitlist'

import {createHash} from 'crypto'
import {emailer} from '../email'
import {sanitizeUsernameOrEmail} from './utils/sanitizeUsernameOrEmail'
import {isInvalidUsernameOrEmail, isValidEmail} from './utils/validateUsernameOrEmail'
import {generateRandomString} from './utils/generateRandomString'
import bcryptjs from 'bcryptjs'

const shaHash = str => {
  const shasum = createHash('sha1')
  shasum.update(str)
  return shasum.digest('hex')
}

const getDomain = ctx => ctx.header.host.split(':')[0]

const AuthController = {
  auth: async ctx => {
    const {usernameOrEmail, password} = await ctx.request.json()

    let auth

    if (!usernameOrEmail || !password) {
      ctx.throw(400, 'Username and password required.')
    }

    const serializedLogin = sanitizeUsernameOrEmail(usernameOrEmail)

    if (isInvalidUsernameOrEmail(serializedLogin)) {
      ctx.throw(401, 'Invalid login')
    }

    const filter = {$or: [{name: serializedLogin}, {mail: serializedLogin}]}
    const user = await User.findOne(filter, {password: 1, confirmed: 1})

    if (!user) {
      ctx.throw(401, 'User not found.')
    } else if (!(await user.comparePassword(password))) {
      ctx.throw(401, 'Wrong password.')
    } else if (!user.confirmed) {
      ctx.throw(403, 'Error: Account pending activation')
    }

    auth = generateAuth(await User.findOne(filter))

    const {refresh_token, access_token, ...restAuth} = auth || {}

    if (refresh_token)
      ctx.cookies.set('refresh_token', refresh_token, {maxAge: auth.expires_in * 1000, domain: getDomain(ctx)})

    ctx.body = {tokenHash: shaHash(access_token), ...restAuth}
  },
  externalAuth: async ctx => {
    const {usernameOrEmail, password} = await ctx.request.json()

    let auth

    if (!usernameOrEmail || !password) {
      ctx.throw(400, 'Username and password required.')
    }

    const serializedLogin = sanitizeUsernameOrEmail(usernameOrEmail)

    if (isInvalidUsernameOrEmail(serializedLogin)) {
      ctx.throw(401, 'Invalid login')
    }

    const filter = {$or: [{name: serializedLogin}, {mail: serializedLogin}]}
    const user = await User.findOne(filter, {password: 1, confirmed: 1})

    if (!user) {
      ctx.throw(401, 'User not found.')
    } else if (!(await user.comparePassword(password))) {
      ctx.throw(401, 'Wrong password.')
    } else if (!user.confirmed) {
      ctx.throw(403, 'Error: Account pending activation')
    }

    auth = generateAuth(await User.findOne(filter))

    ctx.body = {...auth}
  },
  refresh: async ctx => {
    const refreshToken = ctx.cookies.get('refresh_token')

    if (!refreshToken) {
      ctx.throw(401, 'No refresh token found.')
    }

    let auth

    if (!refreshToken) {
      ctx.throw(400, 'No token received.')
    }

    try {
      const {sub: name} = jwt.verify(refreshToken, constants.JWT_SECRET)

      const user = await User.findOne({name})

      auth = generateAuth(user)
    } catch (e) {
      ctx.throw(401, 'Refresh JWT invalid.')
    }

    const {refresh_token, access_token, ...authRest} = auth

    if (access_token) ctx.cookies.set('auth', access_token, {maxAge: auth.expires_in * 1000, domain: getDomain(ctx)})

    // enrich the auth object with the payload from the access token:
    const payload = jwt.decode(access_token)

    ctx.body = {
      ...authRest,
      tokenHash: shaHash(access_token),
      payload,
      expiresAt: payload.exp * 1000, // set value in ms as most stuff is based on ms
      userId: payload.sub,
      roles: payload.roles,
      limitWorkflows: payload.limitWorkflows,
      limitNodes: payload.limitNodes,
      name: auth?.wp_user?.data?.display_name,
    }
  },
  externalRefresh: async ctx => {
    const refreshToken = ctx.cookies.get('refresh_token')

    if (!refreshToken) {
      ctx.throw(401, 'No refresh token found.')
    }

    let auth

    if (!refreshToken) {
      ctx.throw(400, 'No token received.')
    }

    try {
      const {sub: name} = jwt.verify(refreshToken, constants.JWT_SECRET)

      const user = await User.findOne({name})

      auth = generateAuth(user)
    } catch (e) {
      ctx.throw(401, 'Refresh JWT invalid.')
    }

    // enrich the auth object with the payload from the access token:
    const payload = jwt.decode(auth.access_token)

    ctx.body = {
      ...auth,
      payload,
      expiresAt: payload.exp * 1000, // set value in ms as most stuff is based on ms
      userId: payload.sub,
      roles: payload.roles,
      limitWorkflows: payload.limitWorkflows,
      limitNodes: payload.limitNodes,
      name: auth?.wp_user?.data?.display_name,
    }
  },
  login: ctx => {
    ctx.body = {redirect: false}
  },

  signup: async ctx => {
    const {username, mail, password} = await ctx.request.json()
    const serializedUsername = sanitizeUsernameOrEmail(username)
    const serializedMail = sanitizeUsernameOrEmail(mail)

    if (!serializedUsername || !serializedMail || !password || password.length < 7) {
      ctx.throw(400, 'Username, email and password required.')
    }

    if (isInvalidUsernameOrEmail(serializedUsername) || !isValidEmail(serializedMail)) {
      ctx.throw(401, 'Invalid username or email')
    }

    const existingUser = (
      await User.find({
        $or: [{mail: serializedMail}, {name: serializedUsername}, {mail: serializedUsername}],
      })
        .limit(1)
        .exec()
    )[0]

    if (existingUser) {
      if (existingUser.name === serializedUsername || existingUser.mail === serializedUsername) {
        ctx.throw(400, 'Username already exists.')
      } else if (existingUser.mail === serializedMail) {
        ctx.throw(400, 'Email already exists.')
      }
    }

    const existingWaitlist = (
      await Waitlist.find({
        $or: [{mail: serializedMail}, {name: serializedUsername}, {mail: serializedUsername}],
      })
        .limit(1)
        .exec()
    )[0]

    if (existingWaitlist) {
      if (existingWaitlist.name === serializedUsername || existingWaitlist.mail === serializedUsername) {
        ctx.throw(400, 'Username already in waitlist.')
      } else if (existingWaitlist.mail === serializedMail) {
        ctx.throw(400, 'Email already in waitlist.')
      }
    }

    const SALT_COMPUTE_EFFORT = 10
    const salt = await bcryptjs.genSaltSync(SALT_COMPUTE_EFFORT)
    const hashedPassword = await bcryptjs.hashSync(password, salt)

    const waitlistRecord = new Waitlist({
      id: serializedUsername,
      name: serializedUsername,
      mail: serializedMail,
      password: hashedPassword,
      meta: {},
    })

    await waitlistRecord.save()

    emailer.notifyUserForSignup(serializedMail, serializedUsername)

    ctx.status = 200
    ctx.body = {success: true}
  },

  logout: ctx => {
    const body = {success: true}

    ctx.cookies.set('refresh_token', '', {maxAge: 1, domain: getDomain(ctx)})
    ctx.cookies.set('auth', '', {maxAge: 1, domain: getDomain(ctx)})

    ctx.body = body
  },
  forgotPassword: async ctx => {
    const {usernameOrEmail} = await ctx.request.json()
    const serializedLogin = sanitizeUsernameOrEmail(usernameOrEmail)

    if (!serializedLogin) {
      ctx.throw(400, 'Username or Email required.')
    }

    if (isInvalidUsernameOrEmail(serializedLogin)) {
      ctx.throw(401, 'Invalid username')
    }

    const filter = {$or: [{name: serializedLogin}, {mail: serializedLogin}]}
    const user = await User.findOne(filter)

    if (!user) {
      ctx.throw(404, 'User not found')
    }

    let resetToken
    let tokenExists = false
    do {
      resetToken = generateRandomString(100)
      tokenExists = await User.exists({pwdResetToken: resetToken})
    } while (tokenExists)

    user.pwdResetToken = resetToken
    await user.save()

    // send recovery link
    const protocol = ctx.request.protocol
    const host = ctx.headers.host
    const origin = `${protocol}://${host}/reset-password/${resetToken}`

    emailer.sendResetEmail(user.mail, user.name, origin)

    ctx.body = {success: true}
  },
  checkResetToken: async ctx => {
    const {pwdResetToken} = ctx.params

    if (!pwdResetToken) {
      ctx.throw(400, 'Token required.')
    }

    const exists = await User.exists({pwdResetToken})

    if (!exists) {
      ctx.throw(404, 'User not found')
    }

    ctx.body = {success: exists}
  },
  resetPassword: async ctx => {
    const {password: newPassword} = await ctx.request.json()
    const {pwdResetToken} = ctx.params

    if (!pwdResetToken) {
      ctx.throw(400, 'Token required.')
    }

    if (!newPassword) {
      ctx.throw(400, 'Password required.')
    }

    const user = await User.findOne({pwdResetToken})

    if (!user) {
      ctx.throw(404, 'User not found')
    }

    delete user.pwdResetToken
    user.password = newPassword
    await user.save()

    ctx.body = {success: true}
  },
}

export default AuthController
