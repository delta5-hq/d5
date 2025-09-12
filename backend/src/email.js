import {
  ApiClient,
  ContactsApi,
  CreateContact,
  AddContactToList,
  SendSmtpEmail,
  TransactionalEmailsApi,
} from '@getbrevo/brevo'
import debug from 'debug'
import {BREVO_API_KEY} from './constants'

const log = debug('delta5:Brevo:email')
const logError = log.extend('ERROR', '::')

const USER_NEW_SIGNUP_LIST_NUMBER = 5
const ADMIN_SIGNUP_APPROVAL_LIST_NUMBER = 6

export class Emailer {
  #brevoContactsApi
  #transactionalEmailsApi
  constructor() {
    let defaultClient = ApiClient.instance
    let apiKey = defaultClient.authentications['api-key']

    apiKey.apiKey = BREVO_API_KEY
    this.#brevoContactsApi = new ContactsApi()
    this.#transactionalEmailsApi = new TransactionalEmailsApi()
  }

  async notifyUserForSignup(email, username) {
    const createContact = new CreateContact()
    createContact.email = email
    createContact.updateEnabled = true
    createContact.listIds = [USER_NEW_SIGNUP_LIST_NUMBER]
    createContact.attributes = {FIRSTNAME: username}

    await this.#brevoContactsApi.createContact(createContact).catch(e => logError(e))
  }

  async notifyUserOfApproval(email) {
    let contactEmails = new AddContactToList()

    contactEmails.emails = [email]

    this.#brevoContactsApi
      .addContactToList(ADMIN_SIGNUP_APPROVAL_LIST_NUMBER, contactEmails)
      .catch(e => logError(e.message))
  }

  async sendResetEmail(email, username, link) {
    const sendSmtpEmail = new SendSmtpEmail()

    sendSmtpEmail.subject = 'Password Recovery'
    sendSmtpEmail.sender = {
      name: 'Delta 5',
      email: 'delta5-admins@googlegroups.com',
    }
    sendSmtpEmail.to = [
      {
        name: username,
        email,
      },
    ]
    sendSmtpEmail.htmlContent = `<!DOCTYPE html> <html> <body> <p>Click on the link to recover your account:</p> <br></br> <p>${link}</p> </body> </html>`
    sendSmtpEmail.textContent = 'Click on the link to recover your account'

    this.#transactionalEmailsApi.sendTransacEmail(sendSmtpEmail).catch(e => logError(e))
  }
}

export const emailer = new Emailer()
