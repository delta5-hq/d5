import zlib from 'zlib'
import path from 'path'
import fs from 'fs'

// Use current working directory for fixtures
const fixturesDir = path.join(process.cwd(), 'e2e', 'shared', 'fixtures')

// Ensure fixtures directory exists
if (!fs.existsSync(fixturesDir)) {
  fs.mkdirSync(fixturesDir, {recursive: true})
}

// Legacy image data for backward compatibility
export const JPG_GZIP_BASE64 =
  'H4sICAZZ6l0AA3Rlc3Qtdy0xLmpwZwClzbkNgDAQRNEZNiEg8EqU4R5AQrIETdEaAUVwJHSyrEOO' +
  'zD98wYztdiFMaUygFxkBOzHASvMRFo8s0BoEhYpKKUpb0ro8k6yhrcjKX9WvHmiEfiKKDv1s+w3f' +
  'ONr/GwEAAA=='

export const FILENAME = 'myFileName.jpg'

export const workflowData = {
  nodes: {
    rootId: {id: 'rootId', prompts: [], title: 'test root node', children: ['childId'], tags: [], autoshrink: false},
    childId: {
      id: 'childId',
      prompts: [],
      title: 'test child node',
      children: [],
      parent: 'rootId',
      tags: [],
      autoshrink: false,
    },
  },
  edges: {rootId_childId: {id: 'rootId_childId', start: 'rootId', end: 'childId', title: 'relation'}},
  share: {public: {enabled: false, hidden: false, writeable: false}, access: []},
  title: 'test title',
  root: 'rootId',
}

export const getImageData = () =>
  new Promise((resolve, reject) =>
    zlib.unzip(Buffer.from(JPG_GZIP_BASE64, 'base64'), (err, buffer) => {
      if (err) {
        reject(err)
      } else {
        resolve(buffer)
      }
    }),
  )

// File creation utilities
export const createTestFile = (filename, content = 'test content', size = null) => {
  const filePath = path.join(fixturesDir, filename)
  
  if (size) {
    const buffer = Buffer.alloc(size, content)
    fs.writeFileSync(filePath, buffer)
  } else {
    fs.writeFileSync(filePath, content)
  }
  
  return filePath
}

export const createMaliciousFile = (type) => {
  const payloads = {
    exe: {
      filename: 'malicious.exe',
      content: Buffer.from([0x4D, 0x5A, 0x90, 0x00])
    },
    script: {
      filename: 'malicious.js', 
      content: 'eval(atob("Y29uc29sZS5sb2coImhhY2tlZCIp"))'
    },
    svg: {
      filename: 'malicious.svg',
      content: `<svg xmlns="http://www.w3.org/2000/svg"><script>alert('XSS')</script></svg>`
    },
    zip: {
      filename: 'malicious.zip',
      content: Buffer.from([0x50, 0x4B, 0x03, 0x04])
    }
  }
  
  const payload = payloads[type]
  if (!payload) throw new Error(`Unknown malicious file type: ${type}`)
  
  const filePath = path.join(fixturesDir, payload.filename)
  fs.writeFileSync(filePath, payload.content)
  
  return filePath
}

export const createTestImage = (format, width = 100, height = 100) => {
  const images = {
    png: {
      filename: `test-${width}x${height}.png`,
      content: Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
    },
    jpg: {
      filename: `test-${width}x${height}.jpg`, 
      content: Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46])
    },
    gif: {
      filename: `test-${width}x${height}.gif`,
      content: Buffer.from('GIF89a')
    }
  }
  
  const image = images[format]
  if (!image) throw new Error(`Unknown image format: ${format}`)
  
  const filePath = path.join(fixturesDir, image.filename)
  fs.writeFileSync(filePath, image.content)
  
  return filePath
}

export const cleanupFixtures = () => {
  if (fs.existsSync(fixturesDir)) {
    fs.rmSync(fixturesDir, {recursive: true, force: true})
  }
}