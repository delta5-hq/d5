import nodemailer from 'nodemailer'
import debug from 'debug'
import {MAIL_HOST, MAIL_PASSWORD, MAIL_USER} from './constants'
console.log(MAIL_HOST, MAIL_PASSWORD, MAIL_USER)
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

export const emailer = new Emailer()
