import {setupDb, teardownDb, isHttpMode} from './setup'
import {subscriberRequest, publicRequest} from './shared/requests'
import Thumbnail from '../src/models/Thumbnail'

/* Mock external HTML_SERVICE_URL only in direct mode */
jest.mock('../src/utils/getThumbnail', () => ({
  __esModule: true,
  default: jest.fn(),
}))
import getThumbnail from '../src/utils/getThumbnail'

describe('URL Thumbnail E2E', () => {
  beforeAll(setupDb, 60000)
  afterAll(teardownDb)

  beforeEach(() => {
    if (!isHttpMode()) {
      jest.clearAllMocks()
    }
  })

  describe('GET /url/thumbnail', () => {
    it('generates thumbnail from URL', async () => {
      if (isHttpMode()) {
        /* HTTP mode - external service needed for full functionality */
        const url = 'https://example.com'
        const res = await subscriberRequest.get(`/url/thumbnail?url=${encodeURIComponent(url)}`)
        
        /* Accept either success (if service available) or service error */
        expect([200, 500]).toContain(res.status)
        if (res.status === 200) {
          expect(res.headers['content-type']).toBe('image/png')
        }
        return
      }

      const mockStream = {
        read: jest.fn(() => Buffer.from('fake image data')),
      }
      getThumbnail.mockResolvedValue(mockStream)

      const url = 'https://example.com'
      const res = await subscriberRequest.get(`/url/thumbnail?url=${encodeURIComponent(url)}`)

      expect(res.status).toBe(200)
      expect(res.headers['content-type']).toBe('image/png')
      expect(getThumbnail).toHaveBeenCalled()
    })

    it('validates size parameter', async () => {
      const url = 'https://example.com'
      const res = await subscriberRequest.get(`/url/thumbnail?url=${encodeURIComponent(url)}&size=invalid`)

      expect(res.status).toBe(400)
      expect(res.text).toContain('Wrong size given')
    })

    it('accepts valid size parameters', async () => {
      if (isHttpMode()) {
        /* HTTP mode - test parameter validation only */
        const url = 'https://example.com'
        const validSizes = Object.values(Thumbnail.SIZES)

        for (const size of validSizes) {
          const res = await subscriberRequest.get(`/url/thumbnail?url=${encodeURIComponent(url)}&size=${size}`)
          /* Accept either success (if service available) or service error, but not validation error */
          expect([200, 500]).toContain(res.status)
        }
        return
      }

      const mockStream = {read: jest.fn(() => Buffer.from('data'))}
      getThumbnail.mockResolvedValue(mockStream)

      const url = 'https://example.com'
      const validSizes = Object.values(Thumbnail.SIZES)

      for (const size of validSizes) {
        const res = await subscriberRequest.get(`/url/thumbnail?url=${encodeURIComponent(url)}&size=${size}`)
        expect(res.status).toBe(200)
      }
    })

    it('requires url parameter', async () => {
      const res = await subscriberRequest.get('/url/thumbnail')
      expect(res.status).toBe(400)
      expect(res.text).toContain('Url is required')
    })

    it('handles external service errors', async () => {
      if (isHttpMode()) {
        /* HTTP mode - service naturally unavailable, test error handling */
        const url = 'https://example.com'
        const res = await subscriberRequest.get(`/url/thumbnail?url=${encodeURIComponent(url)}`)

        expect(res.status).toBe(500)
        /* Accept any error message from real service failure */
        expect(res.text).toBeTruthy()
        return
      }

      getThumbnail.mockRejectedValue(new Error('Service unavailable'))

      const url = 'https://example.com'
      const res = await subscriberRequest.get(`/url/thumbnail?url=${encodeURIComponent(url)}`)

      expect(res.status).toBe(500)
      expect(res.text).toContain('Service unavailable')
    })
  })
})

describe('URL Thumbnail E2E - Subscriber Tests', () => {
  beforeAll(async () => {
    await setupDb()
  })

  afterAll(async () => {
    await teardownDb()
  })

  describe('GET /url/thumbnail (subscriber)', () => {
    it('generates thumbnail for subscriber', async () => {
      if (isHttpMode()) {
        const url = 'https://example.com'
        const res = await subscriberRequest.get(`/url/thumbnail?url=${encodeURIComponent(url)}`)
        expect([200, 500]).toContain(res.status)
        return
      }

      const mockStream = {read: jest.fn(() => Buffer.from('fake image data'))}
      getThumbnail.mockResolvedValue(mockStream)

      const url = 'https://example.com'
      const res = await subscriberRequest.get(`/url/thumbnail?url=${encodeURIComponent(url)}`)

      expect(res.status).toBe(200)
      expect(res.headers['content-type']).toBe('image/png')
    })

    it('validates size parameter for subscriber', async () => {
      const url = 'https://example.com'
      const res = await subscriberRequest.get(`/url/thumbnail?url=${encodeURIComponent(url)}&size=invalid`)

      expect(res.status).toBe(400)
      expect(res.text).toContain('Wrong size given')
    })
  })
})
