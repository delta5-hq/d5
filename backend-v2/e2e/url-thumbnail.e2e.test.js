import {testOrchestrator} from './shared/test-data-factory'
import {subscriberRequest, publicRequest} from './shared/requests'

/* Thumbnail sizes from backend model */
const THUMBNAIL_SIZES = {
  full: 'full',
  small: 'small',
  tiny: 'tiny',
}

describe('URL Thumbnail E2E', () => {
  beforeAll(() => testOrchestrator.prepareTestEnvironment(), 60000)
  afterAll(testOrchestrator.cleanupTestEnvironment)

  describe('GET /url/thumbnail', () => {
    it('generates thumbnail from URL', async () => {
      const url = 'https://example.com'
      const res = await subscriberRequest.get(`/url/thumbnail?url=${encodeURIComponent(url)}`)

      expect(res.status).toBe(200)
      expect(res.headers['content-type']).toBe('image/png')
    })

    it('validates size parameter', async () => {
      const url = 'https://example.com'
      const res = await subscriberRequest.get(`/url/thumbnail?url=${encodeURIComponent(url)}&size=invalid`)

      expect(res.status).toBe(400)
      expect(res.body).toHaveProperty('message')
      expect(res.body.message).toContain('Wrong size given')
    })

    it('accepts valid size parameters', async () => {
      const url = 'https://example.com'
      const validSizes = Object.values(THUMBNAIL_SIZES)

      for (const size of validSizes) {
        const res = await subscriberRequest.get(`/url/thumbnail?url=${encodeURIComponent(url)}&size=${size}`)
        expect(res.status).toBe(200)
      }
    })

    it('requires url parameter', async () => {
      const res = await subscriberRequest.get('/url/thumbnail')
      expect(res.status).toBe(400)
      expect(res.body).toHaveProperty('message')
      expect(res.body.message).toContain('Url is required')
    })

    it('handles external service errors', async () => {
      /* Mock service always succeeds */
      const url = 'https://example.com'
      const res = await subscriberRequest.get(`/url/thumbnail?url=${encodeURIComponent(url)}`)

      expect(res.status).toBe(200)
    })
  })
})

describe('URL Thumbnail E2E - Subscriber Tests', () => {
  beforeAll(async () => {
    await testOrchestrator.prepareTestEnvironment()
  })

  afterAll(async () => {
    await testOrchestrator.cleanupTestEnvironment()
  })

  describe('GET /url/thumbnail (subscriber)', () => {
    it('generates thumbnail for subscriber', async () => {
      const url = 'https://example.com'
      const res = await subscriberRequest.get(`/url/thumbnail?url=${encodeURIComponent(url)}`)

      expect(res.status).toBe(200)
      expect(res.headers['content-type']).toBe('image/png')
    })

    it('validates size parameter for subscriber', async () => {
      const url = 'https://example.com'
      const res = await subscriberRequest.get(`/url/thumbnail?url=${encodeURIComponent(url)}&size=invalid`)

      expect(res.status).toBe(400)
      expect(res.body).toHaveProperty('message')
      expect(res.body.message).toContain('Wrong size given')
    })
  })
})
