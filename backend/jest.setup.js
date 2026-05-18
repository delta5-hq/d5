// Test isolation: unset LLM credentials and other secrets that leak from backend/.env
// via dotenv in src/constants.js. Tests assert behaviour assuming no env-level credentials.
for (const key of [
  'OPENAI_API_KEY',
  'CLAUDE_API_KEY',
  'PERPLEXITY_API_KEY',
  'DEEPSEEK_API_KEY',
  'QWEN_API_KEY',
  'YANDEX_API_KEY',
  'YANDEX_FOLDER_ID',
]) {
  process.env[key] = ''
}

const {ReadableStream, WritableStream, TransformStream} = require('node:stream/web')
if (!global.ReadableStream) global.ReadableStream = ReadableStream
if (!global.WritableStream) global.WritableStream = WritableStream
if (!global.TransformStream) global.TransformStream = TransformStream

const {Blob} = require('node:buffer')
if (!global.Blob) global.Blob = Blob

const {MessageChannel, MessagePort, BroadcastChannel} = require('node:worker_threads')
if (!global.MessageChannel) global.MessageChannel = MessageChannel
if (!global.MessagePort) global.MessagePort = MessagePort
if (!global.BroadcastChannel) global.BroadcastChannel = BroadcastChannel

if (!global.DOMException) {
  global.DOMException = globalThis.DOMException || class DOMException extends Error {
    constructor(message, name) {
      super(message)
      this.name = name || 'Error'
    }
  }
}

jest.mock('sharp', () => {
  return jest.fn(() => ({
    resize: jest.fn().mockReturnThis(),
    toFormat: jest.fn().mockReturnThis(),
    toBuffer: jest.fn().mockResolvedValue(Buffer.from('mock-image-buffer')),
    metadata: jest.fn().mockResolvedValue({width: 100, height: 100, format: 'png'}),
  }))
})

// undici over node-fetch: OpenAI SDK v6 needs Web-API ReadableStream body; stream globals must precede this require.
const {
  fetch: undiciFetch,
  Headers: UndiciHeaders,
  Request: UndiciRequest,
  Response: UndiciResponse,
  FormData: UndiciFormData,
  File: UndiciFile,
} = require('undici')
if (!global.fetch) global.fetch = undiciFetch
if (!global.Headers) global.Headers = UndiciHeaders
if (!global.Request) global.Request = UndiciRequest
if (!global.Response) global.Response = UndiciResponse
if (!global.FormData) global.FormData = UndiciFormData
if (!global.File) global.File = UndiciFile
