const {ReadableStream, TransformStream} = require('node:stream/web')

global.ReadableStream = ReadableStream
global.TransformStream = TransformStream
global.fetch = global.fetch ?? require('node-fetch')

jest.mock('sharp', () => {
  return jest.fn(() => ({
    resize: jest.fn().mockReturnThis(),
    toFormat: jest.fn().mockReturnThis(),
    toBuffer: jest.fn().mockResolvedValue(Buffer.from('mock-image-buffer')),
    metadata: jest.fn().mockResolvedValue({width: 100, height: 100, format: 'png'}),
  }))
})
