import {ScrapeParamsAdapter} from '../../context/ScrapeParamsAdapter'

describe('ScrapeParamsAdapter', () => {
  let adapter

  beforeEach(() => {
    adapter = new ScrapeParamsAdapter()
  })

  describe('adaptParams', () => {
    it('uses defaults when no args provided', () => {
      const params = adapter.adaptParams()

      expect(params).toEqual({
        max_size: '5mb',
        max_pages: '100',
      })
    })

    it('uses defaults when empty args object provided', () => {
      const params = adapter.adaptParams({})

      expect(params).toEqual({
        max_size: '5mb',
        max_pages: '100',
      })
    })

    it('overrides max_size when provided', () => {
      const params = adapter.adaptParams({maxSize: '10mb'})

      expect(params.max_size).toBe('10mb')
    })

    it('overrides max_pages when provided', () => {
      const params = adapter.adaptParams({maxPages: '50'})

      expect(params.max_pages).toBe('50')
    })

    it('overrides both parameters when provided', () => {
      const params = adapter.adaptParams({maxSize: '20mb', maxPages: '200'})

      expect(params).toEqual({
        max_size: '20mb',
        max_pages: '200',
      })
    })

    it('ignores extra fields not part of schema', () => {
      const params = adapter.adaptParams({maxSize: '5mb', extraField: 'ignored'})

      expect(params).toEqual({
        max_size: '5mb',
        max_pages: '100',
      })
      expect(params.extraField).toBeUndefined()
    })

    it('handles null values by using defaults', () => {
      const params = adapter.adaptParams({maxSize: null, maxPages: null})

      expect(params).toEqual({
        max_size: '5mb',
        max_pages: '100',
      })
    })

    it('handles undefined values by using defaults', () => {
      const params = adapter.adaptParams({maxSize: undefined, maxPages: undefined})

      expect(params).toEqual({
        max_size: '5mb',
        max_pages: '100',
      })
    })

    it('preserves string format for size units', () => {
      const params = adapter.adaptParams({maxSize: '1gb'})

      expect(params.max_size).toBe('1gb')
      expect(typeof params.max_size).toBe('string')
    })

    it('preserves string format for page count', () => {
      const params = adapter.adaptParams({maxPages: '500'})

      expect(params.max_pages).toBe('500')
      expect(typeof params.max_pages).toBe('string')
    })
  })
})
