import nodemailer from 'nodemailer'
import debug from 'debug'
import {MAIL_HOST, MAIL_PASSWORD, MAIL_USER} from './constants'

const log = debug('delta5:Email')
const logError = log.extend('ERROR', '::')

const SMTP_CONFIG = {
  host: MAIL_HOST,
  port: 465,
  secure: true,
  auth: {
    user: MAIL_USER,
    pass: MAIL_PASSWORD,
  },
  tls: {
    rejectUnauthorized: false,
  },
}

export class Emailer {
  #transporter
  constructor() {
    this.#transporter = nodemailer.createTransport(SMTP_CONFIG)
  }

  async notifyUserForSignup(email, username) {
    const subject = 'Welcome to Delta 5'
    const text = `Hello ${username}, welcome to Delta 5!`
    const html = `<p>Hello ${username}, welcome to Delta 5!</p>`

    return this._sendMail(email, subject, text, html)
  }

  async notifyUserOfApproval(email) {
    const subject = 'Your account is approved'
    const text = 'Your account has been approved.'
    const html = '<p>Your account has been approved.</p>'

    return this._sendMail(email, subject, text, html)
  }

  async sendResetEmail(email, username, link) {
    const subject = 'Password Recovery'
    const text = `Click on the link to recover your account: ${link}`
    const html = `<!DOCTYPE html><html><body><p>Click on the link to recover your account:</p><br><p>${link}</p></body></html>`

    return this._sendMail(email, subject, text, html)
  }

  async notifyUserOfRejection(email) {
    const subject = 'Your account has been rejected'
    const text = 'We regret to inform you that your account has been rejected.'
    const html = '<p>We regret to inform you that your account has been rejected.</p>'

    return this._sendMail(email, subject, text, html)
  }

  async _sendMail(to, subject, text, html) {
    const message = {
      from: `Delta 5 ${MAIL_USER}`,
      to,
      subject,
      text,
      html,
    }
    try {
      const info = await this.#transporter.sendMail(message)
      return info
    } catch (err) {
      logError(err)
    }
  }
}

/* Noop implementation for E2E testing - returns success without external SMTP calls */
export class NoopEmailer {
  async notifyUserForSignup(email, username) {
    log('NOOP: notifyUserForSignup', email, username)
    return {success: true}
  }

  async notifyUserOfApproval(email) {
    log('NOOP: notifyUserOfApproval', email)
    return {success: true}
  }

  async sendResetEmail(email, username, link) {
    log('NOOP: sendResetEmail', email, username, link)
    return {success: true}
  }

  async notifyUserOfRejection(email) {
    log('NOOP: notifyUserOfRejection', email)
    return {success: true}
  }

  async _sendMail(to, subject) {
    log('NOOP: _sendMail', to, subject)
    return {success: true}
  }
}

/* Module-level decision: Mock external services in test environments */
export const emailer = process.env.MOCK_EXTERNAL_SERVICES === 'true' ? new NoopEmailer() : new Emailer()
