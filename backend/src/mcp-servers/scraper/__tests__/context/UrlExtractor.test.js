import {UrlExtractor} from '../../context/UrlExtractor'

describe('UrlExtractor', () => {
  let extractor

  beforeEach(() => {
    extractor = new UrlExtractor()
  })

  describe('extractUniqueUrls', () => {
    it('extracts single URL from text', () => {
      const input = 'Check out https://example.com for more info'
      const urls = extractor.extractUniqueUrls(input)

      expect(urls).toEqual(['https://example.com'])
    })

    it('extracts multiple URLs from text', () => {
      const input = 'See https://example.com and http://test.org for details'
      const urls = extractor.extractUniqueUrls(input)

      expect(urls).toHaveLength(2)
      expect(urls).toContain('https://example.com')
      expect(urls).toContain('http://test.org')
    })

    it('removes trailing punctuation from URLs', () => {
      const input = 'Visit https://example.com. and https://test.org, for info'
      const urls = extractor.extractUniqueUrls(input)

      expect(urls).toEqual(['https://example.com', 'https://test.org'])
    })

    it('removes trailing slashes from URLs', () => {
      const input = 'https://example.com/ and https://test.org/'
      const urls = extractor.extractUniqueUrls(input)

      expect(urls).toEqual(['https://example.com', 'https://test.org'])
    })

    it('deduplicates identical URLs', () => {
      const input = 'https://example.com and https://example.com again'
      const urls = extractor.extractUniqueUrls(input)

      expect(urls).toEqual(['https://example.com'])
    })

    it('treats URLs with and without trailing slash as same', () => {
      const input = 'https://example.com and https://example.com/'
      const urls = extractor.extractUniqueUrls(input)

      expect(urls).toEqual(['https://example.com'])
    })

    it('returns empty array when no URLs found', () => {
      const input = 'This text contains no URLs'
      const urls = extractor.extractUniqueUrls(input)

      expect(urls).toEqual([])
    })

    it('filters out invalid URLs', () => {
      const input = 'Valid: https://example.com Invalid: not-a-url'
      const urls = extractor.extractUniqueUrls(input)

      expect(urls).toEqual(['https://example.com'])
    })

    it('handles URLs with query parameters', () => {
      const input = 'https://example.com?foo=bar&baz=qux'
      const urls = extractor.extractUniqueUrls(input)

      expect(urls).toEqual(['https://example.com/?foo=bar&baz=qux'])
    })

    it('handles URLs with fragments', () => {
      const input = 'https://example.com#section'
      const urls = extractor.extractUniqueUrls(input)

      expect(urls).toEqual(['https://example.com/#section'])
    })

    it('handles URLs in parentheses', () => {
      const input = 'See the docs (https://example.com) for details'
      const urls = extractor.extractUniqueUrls(input)

      expect(urls).toEqual(['https://example.com'])
    })

    it('handles URLs with paths', () => {
      const input = 'https://example.com/path/to/resource'
      const urls = extractor.extractUniqueUrls(input)

      expect(urls).toEqual(['https://example.com/path/to/resource'])
    })

    it('handles empty input', () => {
      const urls = extractor.extractUniqueUrls('')

      expect(urls).toEqual([])
    })

    it('handles http and https protocols', () => {
      const input = 'http://example.com https://example.org'
      const urls = extractor.extractUniqueUrls(input)

      expect(urls).toEqual(['http://example.com', 'https://example.org'])
    })

    it('handles URLs with encoded characters', () => {
      const input = 'https://example.com/path?q=hello%20world'
      const urls = extractor.extractUniqueUrls(input)

      expect(urls).toEqual(['https://example.com/path?q=hello%20world'])
    })

    it('filters out malformed URLs with invalid characters', () => {
      const input = 'https://example.com and https://invalid<>url.com'
      const urls = extractor.extractUniqueUrls(input)

      expect(urls).toEqual(['https://example.com'])
    })

    it('handles URLs with port numbers', () => {
      const input = 'https://example.com:8080/path'
      const urls = extractor.extractUniqueUrls(input)

      expect(urls).toEqual(['https://example.com:8080/path'])
    })

    it('handles URLs with authentication', () => {
      const input = 'https://user:pass@example.com/path'
      const urls = extractor.extractUniqueUrls(input)

      expect(urls).toEqual(['https://user:pass@example.com/path'])
    })

    it('handles URLs in markdown link format', () => {
      const input = 'Check [this link](https://example.com) for details'
      const urls = extractor.extractUniqueUrls(input)

      expect(urls).toEqual(['https://example.com'])
    })

    it('handles multiple occurrences of same URL with different fragments', () => {
      const input = 'https://example.com#section1 and https://example.com#section2'
      const urls = extractor.extractUniqueUrls(input)

      expect(urls).toHaveLength(2)
      expect(urls).toContain('https://example.com/#section1')
      expect(urls).toContain('https://example.com/#section2')
    })

    it('handles URL followed by punctuation and whitespace', () => {
      const input = 'See https://example.com.   Next sentence.'
      const urls = extractor.extractUniqueUrls(input)

      expect(urls).toEqual(['https://example.com'])
    })

    it('handles very long URLs', () => {
      const longPath = 'a'.repeat(500)
      const input = `https://example.com/${longPath}`
      const urls = extractor.extractUniqueUrls(input)

      expect(urls).toHaveLength(1)
      expect(urls[0]).toContain(longPath)
    })

    it('handles international domain names with punycode encoding', () => {
      const input = 'https://例え.jp/path'
      const urls = extractor.extractUniqueUrls(input)

      expect(urls).toHaveLength(1)
      expect(urls[0]).toMatch(/xn--.*\.jp\/path/)
    })
  })
})
