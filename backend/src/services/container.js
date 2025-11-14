/**
 * Dependency Injection Container
 *
 * Constructs service instances based on configuration.
 * No direct ENV var access - all config passed via constructor.
 *
 * Pattern: Constructor Injection
 * - Services declare dependencies in constructor
 * - Container resolves and injects dependencies
 * - Future-ready for DI libraries (awilix, inversify, typedi)
 *
 * Usage:
 *   import {container} from './services/container'
 *   const emailService = container.get('emailService')
 */

import {serviceConfig} from '../config/serviceConfig'
import debug from 'debug'

const log = debug('delta5:DI:Container')

/* ========================================
   NOOP IMPLEMENTATIONS (E2E Testing)
   ======================================== */

class NoopEmailService {
  constructor(config) {
    this.config = config
    log('NoopEmailService initialized')
  }

  async notifyUserForSignup(email, username) {
    log('NOOP: notifyUserForSignup', {email, username})
    return {success: true, messageId: 'noop-msg-id'}
  }

  async notifyUserOfApproval(email) {
    log('NOOP: notifyUserOfApproval', {email})
    return {success: true, messageId: 'noop-msg-id'}
  }

  async sendResetEmail(email, username, link) {
    log('NOOP: sendResetEmail', {email, username, link})
    return {success: true, messageId: 'noop-msg-id'}
  }

  async notifyUserOfRejection(email) {
    log('NOOP: notifyUserOfRejection', {email})
    return {success: true, messageId: 'noop-msg-id'}
  }
}

class NoopThumbnailService {
  constructor(config) {
    this.config = config
    log('NoopThumbnailService initialized')
  }

  async generate(filter, url) {
    log('NOOP: generate thumbnail', {filter, url})
    /* Return 1x1 transparent PNG buffer */
    const pngData = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00,
      0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00, 0x0a, 0x49,
      0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,
      0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ])
    return {read: () => pngData}
  }
}

class NoopClaudeService {
  constructor(config) {
    this.config = config
    log('NoopClaudeService initialized')
  }

  async sendMessages(body) {
    log('NOOP: Claude sendMessages', {model: body.model})
    return {
      id: 'msg-noop',
      type: 'message',
      role: 'assistant',
      content: [{type: 'text', text: 'Mock response from Claude'}],
      model: body.model || this.config.defaultModel,
      stop_reason: 'end_turn',
      usage: {input_tokens: 10, output_tokens: 10},
    }
  }
}

class NoopPerplexityService {
  constructor(config) {
    this.config = config
    log('NoopPerplexityService initialized')
  }

  async completions(body) {
    log('NOOP: Perplexity completions', {model: body.model})
    return {
      id: 'pplx-noop',
      model: body.model || this.config.defaultModel,
      choices: [
        {
          index: 0,
          message: {role: 'assistant', content: 'Mock response from Perplexity'},
          finish_reason: 'stop',
        },
      ],
      usage: {prompt_tokens: 10, completion_tokens: 10, total_tokens: 20},
    }
  }
}

class NoopYandexService {
  constructor(config) {
    this.config = config
    log('NoopYandexService initialized')
  }

  async completion(body) {
    log('NOOP: Yandex completion', {model: body.model})
    return {
      result: {
        alternatives: [
          {message: {role: 'assistant', text: 'Mock response from Yandex'}, status: 'ALTERNATIVE_STATUS_FINAL'},
        ],
        usage: {inputTextTokens: '10', completionTokens: '10', totalTokens: '20'},
        modelVersion: body.model || this.config.defaultModel,
      },
    }
  }

  async embeddings(body) {
    log('NOOP: Yandex embeddings', {model: body.model})
    return {
      embedding: Array(256).fill(0),
      numTokens: '10',
      modelVersion: body.model || this.config.defaultModel,
    }
  }
}

class NoopMidjourneyService {
  constructor(config) {
    this.config = config
    log('NoopMidjourneyService initialized')
  }

  async create(prompt, processMode) {
    log('NOOP: Midjourney create', {prompt, processMode})
    return {
      task_id: 'noop-task-id',
      status: 'finished',
      task_result: {
        image_url: 'https://example.com/noop-midjourney.png',
        discord_image_url: 'https://example.com/noop-midjourney.png',
      },
    }
  }

  async upscale(taskId, index) {
    log('NOOP: Midjourney upscale', {taskId, index})
    return {
      task_id: 'noop-upscale-task-id',
      status: 'finished',
      task_result: {
        image_url: 'https://example.com/noop-upscaled.png',
        discord_image_url: 'https://example.com/noop-upscaled.png',
      },
    }
  }

  async imagine(prompt) {
    log('NOOP: Midjourney imagine', {prompt})
    return {taskId: 'noop-task-id', status: 'completed', imageUrl: 'https://example.com/noop-image.png'}
  }
}

class NoopZoomService {
  constructor(config) {
    this.config = config
    log('NoopZoomService initialized')
  }

  async auth(body) {
    log('NOOP: Zoom auth', {body})
    return {access_token: 'noop-zoom-token', token_type: 'bearer', expires_in: 3600}
  }

  async getRecordings(meetingId) {
    log('NOOP: Zoom getRecordings', {meetingId})
    return ['Mock transcript: This is a noop zoom recording transcript.']
  }

  async getAccessToken(code) {
    log('NOOP: Zoom getAccessToken', {code})
    return {access_token: 'noop-zoom-token', expires_in: 3600}
  }

  async getMeetingRecordings(meetingId) {
    log('NOOP: Zoom getMeetingRecordings', {meetingId})
    return {recording_files: []}
  }
}

class NoopFreepikService {
  constructor(config) {
    this.config = config
    log('NoopFreepikService initialized')
  }

  async getIcons(query) {
    log('NOOP: Freepik getIcons', {query})
    return {data: [], total: 0}
  }

  async downloadIcon(id, pngSize) {
    log('NOOP: Freepik downloadIcon', {id, pngSize})
    return {url: 'https://example.com/noop-icon.png'}
  }

  async search(query) {
    log('NOOP: Freepik search', {query})
    return {data: [], total: 0}
  }
}

class NoopWebScraperService {
  constructor(config) {
    this.config = config
    log('NoopWebScraperService initialized')
  }

  async scrape(url) {
    log('NOOP: WebScraper scrape', {url})
    return {content: 'Mock scraped content', title: 'Mock Title'}
  }

  async search(query) {
    log('NOOP: WebScraper search', {query})
    return {results: []}
  }
}

class NoopOpenAIService {
  constructor(config) {
    this.config = config
    log('NoopOpenAIService initialized')
  }

  checkApiKey() {
    log('NOOP: OpenAI checkApiKey')
    return !!this.config.apiKey
  }

  async chatCompletion(messages, model) {
    log('NOOP: OpenAI chatCompletion', {messageCount: messages.length, model})
    return {
      id: 'chatcmpl-noop',
      object: 'chat.completion',
      created: Date.now(),
      model: model || this.config.defaultModel,
      choices: [{message: {role: 'assistant', content: 'Mock OpenAI response'}, finish_reason: 'stop', index: 0}],
      usage: {prompt_tokens: 10, completion_tokens: 10, total_tokens: 20},
    }
  }

  async embeddings(input, model) {
    log('NOOP: OpenAI embeddings', {inputLength: Array.isArray(input) ? input.length : 1, model})
    const inputs = Array.isArray(input) ? input : [input]
    return {
      object: 'list',
      data: inputs.map((_, index) => ({
        object: 'embedding',
        index,
        embedding: Array(1536).fill(0),
      })),
      model: model || 'text-embedding-ada-002',
      usage: {prompt_tokens: 10, total_tokens: 10},
    }
  }

  async dalleGenerations(prompt, n = 1, size = '1024x1024', responseFormat = 'url') {
    log('NOOP: OpenAI dalleGenerations', {prompt, n, size, responseFormat})
    return {
      created: Date.now(),
      data: Array.from({length: n}, () => ({
        url: responseFormat === 'url' ? `https://via.placeholder.com/${size}` : undefined,
        b64_json: responseFormat === 'b64_json' ? Buffer.from('mock-image-data').toString('base64') : undefined,
      })),
    }
  }
}

/* ========================================
   REAL IMPLEMENTATIONS (Production)
   ======================================== */

class RealEmailService {
  constructor(config) {
    this.config = config
    this.transporter = null
    log('RealEmailService initialized', {host: config.host, user: config.user})
  }

  async _initTransporter() {
    if (this.transporter) return
    const nodemailer = (await import('nodemailer')).default
    this.transporter = nodemailer.createTransport({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      auth: {
        user: this.config.user,
        pass: this.config.password,
      },
      tls: {rejectUnauthorized: false},
    })
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
      from: `Delta 5 ${this.config.from}`,
      to,
      subject,
      text,
      html,
    }
    try {
      await this._initTransporter()
      const info = await this.transporter.sendMail(message)
      return info
    } catch (err) {
      log('Email send error:', err)
      throw err
    }
  }
}

class RealThumbnailService {
  constructor(config) {
    this.config = config
    log('RealThumbnailService initialized', {url: config.htmlServiceUrl})
  }

  async generate(filter, url, options) {
    const Thumbnail = (await import('../models/Thumbnail')).default
    let thumbnail = await Thumbnail.findOne(filter)

    if (!thumbnail) {
      const fetch = (await import('node-fetch')).default
      const response = await fetch(url, {
        method: 'post',
        ...options,
      })

      if (response.status !== 200) {
        throw new Error(`Cannot create thumbnail: ${response.status}`)
      }

      const saveThumbnail = new Thumbnail(filter)
      await saveThumbnail.write(response.body)
      thumbnail = await Thumbnail.findOne(filter)
    }

    return thumbnail
  }
}

class RealClaudeService {
  constructor(config) {
    this.config = config
    log('RealClaudeService initialized', {baseUrl: config.baseUrl})
  }

  async sendMessages(body) {
    const fetch = (await import('node-fetch')).default
    const response = await fetch(`${this.config.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': this.config.version,
      },
      body: JSON.stringify(body),
    })

    const result = await response.json()
    if (!response.ok) {
      const errorMessage = result.error?.message || 'Unknown error from Claude API'
      throw new Error(`Claude API error (${response.status}): ${errorMessage}`)
    }
    return result
  }
}

class RealPerplexityService {
  constructor(config) {
    this.config = config
    log('RealPerplexityService initialized', {baseUrl: config.baseUrl})
  }

  async completions(body) {
    const fetch = (await import('node-fetch')).default
    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      throw new Error(`Perplexity API error: ${response.status}`)
    }
    return response.json()
  }
}

class RealYandexService {
  constructor(config) {
    this.config = config
    log('RealYandexService initialized', {baseUrl: config.baseUrl})
  }

  async completion(body) {
    const fetch = (await import('node-fetch')).default
    const response = await fetch(`${this.config.baseUrl}/foundationModels/v1/completion`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
        'x-folder-id': this.config.folderId,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      throw new Error(`Yandex API error: ${response.status}`)
    }
    return response.json()
  }

  async embeddings(body) {
    const fetch = (await import('node-fetch')).default
    const response = await fetch(`${this.config.baseUrl}/foundationModels/v1/textEmbedding`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
        'x-folder-id': this.config.folderId,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      throw new Error(`Yandex API error: ${response.status}`)
    }
    return response.json()
  }
}

class RealMidjourneyService {
  constructor(config) {
    this.config = config
    log('RealMidjourneyService initialized', {apiUrl: config.apiUrl})
  }

  async create(prompt, processMode) {
    const fetch = (await import('node-fetch')).default
    const {delay} = await import('../controllers/utils/delay')

    const imagineResponse = await fetch(`${this.config.apiUrl}/mj/v2/imagine`, {
      method: 'POST',
      headers: {'X-API-KEY': this.config.apiKey},
      body: JSON.stringify({prompt: `${prompt} --v 5.2`, process_mode: processMode}),
    })

    const {task_id, message} = await imagineResponse.json()
    if (!imagineResponse.ok) {
      throw new Error(`Midjourney API error (${imagineResponse.status}): ${message}`)
    }

    let attempts = 200
    while (attempts) {
      const response = await fetch(`${this.config.apiUrl}/mj/v2/fetch`, {
        method: 'POST',
        body: JSON.stringify({task_id}),
      })

      if (!response.ok) {
        throw new Error(`Midjourney fetch error: ${response.status}`)
      }

      attempts -= 1
      const fetchJson = await response.json()
      const {status} = fetchJson

      if (status === 'finished' || status === 'failed' || !attempts) {
        return fetchJson
      }

      await delay(3500)
    }
  }

  async upscale(data) {
    const fetch = (await import('node-fetch')).default
    const {delay} = await import('../controllers/utils/delay')

    const upscaleResponse = await fetch(`${this.config.apiUrl}/mj/v2/upscale`, {
      method: 'POST',
      headers: {'X-API-KEY': this.config.apiKey},
      body: JSON.stringify(data),
    })

    const {task_id, message} = await upscaleResponse.json()
    if (!upscaleResponse.ok) {
      throw new Error(`Midjourney upscale error (${upscaleResponse.status}): ${message}`)
    }

    let attempts = 200
    while (attempts) {
      const response = await fetch(`${this.config.apiUrl}/mj/v2/fetch`, {
        method: 'POST',
        body: JSON.stringify({task_id}),
      })

      if (!response.ok) {
        throw new Error(`Midjourney fetch error: ${response.status}`)
      }

      attempts -= 1
      const fetchJson = await response.json()
      const {status} = fetchJson

      if (status === 'finished' || status === 'failed' || !attempts) {
        return fetchJson
      }

      await delay(3500)
    }
  }

  async imagine(prompt) {
    const fetch = (await import('node-fetch')).default
    const response = await fetch(`${this.config.apiUrl}/imagine`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({prompt}),
    })

    if (!response.ok) {
      throw new Error(`Midjourney API error: ${response.status}`)
    }
    return response.json()
  }
}

class RealZoomService {
  constructor(config) {
    this.config = config
    log('RealZoomService initialized', {baseUrl: config.baseUrl})
  }

  async auth(body, authorization) {
    const fetch = (await import('node-fetch')).default
    const jsonToUrlEncoded = json => {
      const urlSearchParams = new URLSearchParams()
      for (const key in json) {
        urlSearchParams.append(key, json[key])
      }
      return urlSearchParams.toString()
    }

    const authUrl = `https://zoom.us/oauth/token?${jsonToUrlEncoded(body)}`
    const response = await fetch(authUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: authorization,
      },
      body,
    })

    if (!response.ok) {
      throw new Error(`Zoom auth error: ${response.status}`)
    }
    return response.json()
  }

  async getRecordings(meetingId, authorization) {
    const fetch = (await import('node-fetch')).default

    const checkFormat = str => {
      const textRegex = /^[A-Za-z\s]+:\s.+/
      const timecodeRegex = /^[0-9]+:[0-9]+:[0-9]+.[0-9]+ --> [0-9]+:[0-9]+:[0-9]+.[0-9]+$/
      return textRegex.test(str) && !timecodeRegex.test(str)
    }

    const extractTextFromVTT = vttText => {
      const lines = vttText.split('\n')
      const textLines = []
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim()
        if (line && checkFormat(line)) {
          textLines.push(`${line.trim()}\n\n`)
        }
      }
      return textLines.join('')
    }

    const apiUrl = `${this.config.baseUrl}/v2/meetings/${meetingId}/recordings`
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {Authorization: authorization},
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(`Zoom recordings error (${response.status}): ${data.message}`)
    }

    const data = await response.json()
    const {recording_files} = data
    const transcriptFilesData = recording_files.filter(recording => recording.file_type === 'TRANSCRIPT')

    const apiKey = authorization.split(' ')[1]
    const transcriptions = await Promise.all(
      transcriptFilesData.map(async ({download_url}) => {
        const vttResponse = await fetch(download_url, {
          headers: {Authorization: `Bearer ${apiKey}`},
        })
        const vttText = await vttResponse.text()
        return extractTextFromVTT(vttText)
      }),
    )

    return transcriptions
  }

  async getAccessToken(code) {
    const fetch = (await import('node-fetch')).default
    const auth = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64')
    const response = await fetch(`${this.config.baseUrl}/v2/oauth/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `grant_type=authorization_code&code=${code}&redirect_uri=${this.config.redirectUri}`,
    })

    if (!response.ok) {
      throw new Error(`Zoom API error: ${response.status}`)
    }
    return response.json()
  }

  async getMeetingRecordings(meetingId, accessToken) {
    const fetch = (await import('node-fetch')).default
    const response = await fetch(`${this.config.baseUrl}/v2/meetings/${meetingId}/recordings`, {
      method: 'GET',
      headers: {Authorization: `Bearer ${accessToken}`},
    })

    if (!response.ok) {
      throw new Error(`Zoom API error: ${response.status}`)
    }
    return response.json()
  }
}

class RealFreepikService {
  constructor(config) {
    this.config = config
    log('RealFreepikService initialized', {baseUrl: config.baseUrl})
  }

  async getIcons(query) {
    const fetch = (await import('node-fetch')).default
    const querystring = (await import('querystring')).default
    const apiUrl = `${this.config.baseUrl}/icons?${querystring.stringify(query)}`

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {'X-Freepik-API-Key': this.config.apiKey},
      redirect: 'follow',
    })

    if (!response.ok) {
      throw new Error(`Freepik getIcons error: ${response.status}`)
    }
    return response.json()
  }

  async downloadIcon(id, pngSize) {
    const fetch = (await import('node-fetch')).default
    const apiUrl = `${this.config.baseUrl}/icons/${id}/download?png_size=${pngSize}`

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {'X-Freepik-API-Key': this.config.apiKey},
      redirect: 'follow',
    })

    if (!response.ok) {
      throw new Error(`Freepik downloadIcon error: ${response.status}`)
    }
    return response.json()
  }

  async search(query) {
    const fetch = (await import('node-fetch')).default
    const response = await fetch(`${this.config.baseUrl}/resources?term=${encodeURIComponent(query)}`, {
      method: 'GET',
      headers: {
        'x-freepik-api-key': this.config.apiKey,
      },
    })

    if (!response.ok) {
      throw new Error(`Freepik API error: ${response.status}`)
    }
    return response.json()
  }
}

class RealWebScraperService {
  constructor(config) {
    this.config = config
    log('RealWebScraperService initialized')
  }

  async scrape(url) {
    const fetch = (await import('node-fetch')).default
    const response = await fetch(url, {
      headers: {'User-Agent': this.config.userAgent},
    })

    if (!response.ok) {
      throw new Error(`Scrape error: ${response.status}`)
    }
    const content = await response.text()
    return {content, title: 'Scraped Content'}
  }

  async search(query) {
    const fetch = (await import('node-fetch')).default
    const response = await fetch(
      `https://serpapi.com/search?q=${encodeURIComponent(query)}&api_key=${this.config.serpApiKey}`,
    )

    if (!response.ok) {
      throw new Error(`SerpAPI error: ${response.status}`)
    }
    return response.json()
  }
}

class RealOpenAIService {
  constructor(config) {
    this.config = config
    log('RealOpenAIService initialized', {baseUrl: config.baseUrl})
  }

  checkApiKey() {
    log('RealOpenAI: checkApiKey')
    return !!this.config.apiKey
  }

  async chatCompletion(messages, model, params = {}) {
    const {Configuration, OpenAIApi} = await import('openai')
    const configuration = new Configuration({apiKey: this.config.apiKey})
    const openai = new OpenAIApi(configuration)

    const response = await openai.createChatCompletion({
      model: model || this.config.defaultModel,
      messages,
      ...params,
    })

    return response.data
  }

  async embeddings(input, model) {
    const {OpenAIEmbeddings} = await import('langchain/embeddings/openai')
    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: this.config.apiKey,
      modelName: model || 'text-embedding-ada-002',
    })

    const inputs = Array.isArray(input) ? input : [input]
    const embeddingResults = await embeddings.embedDocuments(inputs)

    return {
      object: 'list',
      data: embeddingResults.map((embedding, index) => ({
        object: 'embedding',
        index,
        embedding,
      })),
      model: model || 'text-embedding-ada-002',
      usage: {prompt_tokens: inputs.length * 10, total_tokens: inputs.length * 10},
    }
  }

  async dalleGenerations(prompt, n = 1, size = '1024x1024', responseFormat = 'url') {
    const {Configuration, OpenAIApi} = await import('openai')
    const configuration = new Configuration({apiKey: this.config.apiKey})
    const openai = new OpenAIApi(configuration)

    const response = await openai.createImage({
      prompt,
      n,
      size,
      response_format: responseFormat,
    })

    return response.data
  }
}

/* ========================================
   DEPENDENCY INJECTION CONTAINER
   ======================================== */

class ServiceContainer {
  constructor(config) {
    this.config = config
    this.services = new Map()
    this._registerServices()
  }

  _registerServices() {
    const isE2E = this.config.mode.isE2EMode

    /* Register services based on mode */
    this.register('emailService', isE2E ? NoopEmailService : RealEmailService, this.config.email)

    this.register('thumbnailService', isE2E ? NoopThumbnailService : RealThumbnailService, this.config.thumbnail)

    this.register('claudeService', isE2E ? NoopClaudeService : RealClaudeService, this.config.claude)

    this.register('perplexityService', isE2E ? NoopPerplexityService : RealPerplexityService, this.config.perplexity)

    this.register('yandexService', isE2E ? NoopYandexService : RealYandexService, this.config.yandex)

    this.register('midjourneyService', isE2E ? NoopMidjourneyService : RealMidjourneyService, this.config.midjourney)

    this.register('zoomService', isE2E ? NoopZoomService : RealZoomService, this.config.zoom)

    this.register('freepikService', isE2E ? NoopFreepikService : RealFreepikService, this.config.freepik)

    this.register('webScraperService', isE2E ? NoopWebScraperService : RealWebScraperService, this.config.webScraper)

    this.register('openaiService', isE2E ? NoopOpenAIService : RealOpenAIService, this.config.openai)

    log('Services registered', {mode: isE2E ? 'E2E' : 'Production', count: this.services.size})
  }

  register(name, ServiceClass, config) {
    this.services.set(name, {ServiceClass, config, instance: null})
  }

  get(name) {
    const service = this.services.get(name)
    if (!service) {
      throw new Error(`Service '${name}' not registered in container`)
    }

    /* Lazy instantiation - singleton pattern */
    if (!service.instance) {
      service.instance = new service.ServiceClass(service.config)
    }

    return service.instance
  }

  has(name) {
    return this.services.has(name)
  }

  clear() {
    this.services.clear()
  }
}

/* Export singleton container instance */
export const container = new ServiceContainer(serviceConfig)

/* Export for testing/mocking */
export {ServiceContainer}
