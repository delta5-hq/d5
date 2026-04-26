import {OutlineParamsAdapter} from '../../context/OutlineParamsAdapter'

describe('OutlineParamsAdapter', () => {
  let adapter

  beforeEach(() => {
    adapter = new OutlineParamsAdapter()
  })

  describe('adaptParams', () => {
    it('returns defaults when no args provided', () => {
      const params = adapter.adaptParams()

      expect(params).toEqual({
        lang: null,
        citations: false,
        maxChunks: undefined,
        serpApiParams: undefined,
        disableSearchScrape: false,
        context: null,
        from: [],
      })
    })

    it('sets lang when provided', () => {
      const params = adapter.adaptParams({lang: 'ru'})

      expect(params.lang).toBe('ru')
    })

    it('sets citations when provided', () => {
      const params = adapter.adaptParams({citations: true})

      expect(params.citations).toBe(true)
    })

    it('calculates maxChunks from web size label', () => {
      const params = adapter.adaptParams({web: 's'})

      expect(params.maxChunks).toBeDefined()
      expect(typeof params.maxChunks).toBe('number')
    })

    it('calculates maxChunks from scholar size label', () => {
      const params = adapter.adaptParams({scholar: 'm'})

      expect(params.maxChunks).toBeDefined()
      expect(typeof params.maxChunks).toBe('number')
      expect(params.serpApiParams).toBeDefined()
    })

    it('scholar takes precedence over web for maxChunks', () => {
      const params = adapter.adaptParams({web: 's', scholar: 'l'})

      expect(params.serpApiParams).toBeDefined()
    })

    it('sets disableSearchScrape when ext is true', () => {
      const params = adapter.adaptParams({ext: true})

      expect(params.disableSearchScrape).toBe(true)
    })

    it('keeps disableSearchScrape false for web mode', () => {
      const params = adapter.adaptParams({web: 's'})

      expect(params.disableSearchScrape).toBe(false)
    })

    it('keeps disableSearchScrape false for scholar mode', () => {
      const params = adapter.adaptParams({scholar: 'm'})

      expect(params.disableSearchScrape).toBe(false)
    })

    it('sets context when provided', () => {
      const params = adapter.adaptParams({ext: true, context: 'my-context'})

      expect(params.context).toBe('my-context')
    })

    it('sets from array when href provided', () => {
      const params = adapter.adaptParams({href: 'https://example.com'})

      expect(params.from).toEqual(['https://example.com'])
    })

    it('keeps from empty when href not provided', () => {
      const params = adapter.adaptParams({web: 's'})

      expect(params.from).toEqual([])
    })

    it('includes minYear in serpApiParams for scholar mode', () => {
      const params = adapter.adaptParams({scholar: 'm', minYear: 2020})

      expect(params.serpApiParams.as_ylo).toBe(2020)
    })

    it('handles direct maxChunks override', () => {
      const params = adapter.adaptParams({maxChunks: 'xl'})

      expect(params.maxChunks).toBeDefined()
    })

    it('scholar maxChunks takes precedence over direct maxChunks', () => {
      const scholarParams = adapter.adaptParams({scholar: 's', maxChunks: 'xl'})
      const directParams = adapter.adaptParams({maxChunks: 'xl'})

      expect(scholarParams.serpApiParams).toBeDefined()
      expect(directParams.serpApiParams).toBeUndefined()
    })

    it('handles all flags together', () => {
      const params = adapter.adaptParams({
        query: 'test',
        scholar: 'm',
        minYear: 2021,
        lang: 'en',
        citations: true,
        context: 'test-context',
        href: 'https://test.com',
      })

      expect(params.lang).toBe('en')
      expect(params.citations).toBe(true)
      expect(params.maxChunks).toBeDefined()
      expect(params.serpApiParams.as_ylo).toBe(2021)
      expect(params.context).toBe('test-context')
      expect(params.from).toEqual(['https://test.com'])
    })

    it('ignores context when ext is false', () => {
      const params = adapter.adaptParams({web: 's', context: 'ignored-context'})

      expect(params.context).toBe('ignored-context')
      expect(params.disableSearchScrape).toBe(false)
    })

    it('handles minYear boundary value of 0 as falsy', () => {
      const params = adapter.adaptParams({scholar: 'm', minYear: 0})

      expect(params.serpApiParams.as_ylo).toBeUndefined()
    })

    it('handles negative minYear', () => {
      const params = adapter.adaptParams({scholar: 'm', minYear: -100})

      expect(params.serpApiParams.as_ylo).toBe(-100)
    })

    it('handles minYear as undefined explicitly', () => {
      const params = adapter.adaptParams({scholar: 'm', minYear: undefined})

      expect(params.serpApiParams.as_ylo).toBeUndefined()
    })

    it('handles all size labels for web mode', () => {
      const sizes = ['xxs', 'xs', 's', 'm', 'l', 'xl', 'xxl']

      sizes.forEach(size => {
        const params = adapter.adaptParams({web: size})
        expect(params.maxChunks).toBeDefined()
        expect(typeof params.maxChunks).toBe('number')
      })
    })

    it('handles all size labels for scholar mode', () => {
      const sizes = ['xxs', 'xs', 's', 'm', 'l', 'xl', 'xxl']

      sizes.forEach(size => {
        const params = adapter.adaptParams({scholar: size})
        expect(params.maxChunks).toBeDefined()
        expect(params.serpApiParams).toBeDefined()
      })
    })

    it('handles conflicting web and ext modes', () => {
      const params = adapter.adaptParams({web: 's', ext: true})

      expect(params.disableSearchScrape).toBe(true)
      expect(params.maxChunks).toBeDefined()
    })

    it('handles conflicting scholar and ext modes', () => {
      const params = adapter.adaptParams({scholar: 'm', ext: true})

      expect(params.disableSearchScrape).toBe(true)
      expect(params.maxChunks).toBeDefined()
      expect(params.serpApiParams).toBeDefined()
    })

    it('handles all three modes specified together', () => {
      const params = adapter.adaptParams({web: 's', scholar: 'l', ext: true})

      expect(params.disableSearchScrape).toBe(true)
      expect(params.maxChunks).toBeDefined()
      expect(params.serpApiParams).toBeDefined()
    })

    it('handles empty string values as falsy', () => {
      const params = adapter.adaptParams({lang: '', context: '', href: ''})

      expect(params.lang).toBeNull()
      expect(params.context).toBeNull()
      expect(params.from).toEqual([])
    })

    it('handles null values for all fields', () => {
      const params = adapter.adaptParams({
        lang: null,
        citations: null,
        context: null,
        href: null,
      })

      expect(params.lang).toBeNull()
      expect(params.citations).toBe(false)
      expect(params.context).toBeNull()
      expect(params.from).toEqual([])
    })

    it('preserves undefined maxChunks when no mode specified', () => {
      const params = adapter.adaptParams({lang: 'en'})

      expect(params.maxChunks).toBeUndefined()
    })

    it('handles truthy non-boolean citations values', () => {
      const params = adapter.adaptParams({citations: 'yes'})

      expect(params.citations).toBe('yes')
    })

    it('handles falsy citations values', () => {
      const params1 = adapter.adaptParams({citations: false})
      const params2 = adapter.adaptParams({citations: 0})
      const params3 = adapter.adaptParams({citations: ''})

      expect(params1.citations).toBe(false)
      expect(params2.citations).toBe(false)
      expect(params3.citations).toBe(false)
    })
  })
})
