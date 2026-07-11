import {load} from 'cheerio'
import {stripTags, extractTextFromNode} from './html'

const bodyOf = html => load(html)('body')[0]
const elementOf = (html, selector) => load(html)(selector)[0]
const firstTextChildOf = (html, selector) => load(html)(selector).contents()[0]

describe('stripTags', () => {
  describe('basic text extraction', () => {
    it.each([
      ['plain paragraph', '<p>Hello world</p>', 'Hello world '],
      ['nested elements', '<div><p>First</p><p>Second</p></div>', 'First Second '],
      ['direct body text', '<body>Direct text</body>', 'Direct text '],
      ['deeply nested structure', '<div><section><article><p>Deep</p></article></section></div>', 'Deep '],
    ])('extracts text from %s', (_label, html, expected) => {
      expect(stripTags(html)).toBe(expected)
    })

    it('returns empty string for empty body', () => {
      expect(stripTags('<html><body></body></html>')).toBe('')
    })
  })

  describe('element filtering', () => {
    it.each([
      ['top-level script', '<p>Visible</p><script>alert("x")</script>', 'Visible ', 'alert'],
      ['top-level style', '<style>body{color:red}</style><p>Content</p>', 'Content ', 'color'],
      ['top-level iframe', '<p>Text</p><iframe src="x.html">fallback</iframe>', 'Text ', 'fallback'],
      ['script nested inside div', '<div><script>alert("x")</script></div><p>safe</p>', 'safe ', 'alert'],
      ['iframe nested inside div', '<div><iframe>blocked</iframe></div><p>content</p>', 'content ', 'blocked'],
    ])('strips %s and its content', (_label, html, expectedText, excludedText) => {
      const result = stripTags(html)
      expect(result).toBe(expectedText)
      expect(result).not.toContain(excludedText)
    })
  })

  describe('whitespace collapse', () => {
    it.each([
      ['single consecutive-space run', '<p>a  b</p>', 'a b '],
      ['multiple consecutive-space runs in one text node', '<p>a  b  c</p>', 'a b c '],
      ['three or more consecutive spaces', '<p>a   b    c</p>', 'a b c '],
      ['runs across multiple paragraphs independently', '<p>x  y</p><p>a  b  c</p>', 'x y a b c '],
    ])('collapses %s', (_label, html, expected) => {
      expect(stripTags(html)).toBe(expected)
    })
  })
})

describe('extractTextFromNode', () => {
  describe('non-node inputs — guard clause', () => {
    it.each([
      ['null', null],
      ['undefined', undefined],
      ['string primitive', 'text'],
      ['number primitive', 42],
    ])('returns empty string for %s', (_label, input) => {
      expect(extractTextFromNode(input)).toBe('')
    })
  })

  describe('text node (nodeType 3)', () => {
    it.each([
      ['plain text', '<p>hello world</p>', 'p', 'hello world '],
      ['multiple consecutive-space runs collapsed', '<p>a  b  c</p>', 'p', 'a b c '],
      ['whitespace-only spaces — returns empty string', '<p>   </p>', 'p', ''],
      ['whitespace-only newline — returns empty string', '<p>\n</p>', 'p', ''],
      ['single tab between words — tab character preserved', '<p>hello\tworld</p>', 'p', 'hello\tworld '],
      ['consecutive tabs — collapsed to single space', '<p>hello\t\tworld</p>', 'p', 'hello world '],
    ])('%s', (_label, html, selector, expected) => {
      expect(extractTextFromNode(firstTextChildOf(html, selector))).toBe(expected)
    })
  })

  describe('element node traversal (nodeType 1)', () => {
    it.each([
      ['single paragraph', '<p>Hello</p>', 'Hello '],
      ['sibling paragraphs concatenated in DOM order', '<p>first</p><p>second</p>', 'first second '],
      ['nested elements', '<div><p>A</p><p>B</p></div>', 'A B '],
    ])('%s', (_label, html, expected) => {
      expect(extractTextFromNode(bodyOf(html))).toBe(expected)
    })

    it('leaf element with no children produces no text', () => {
      expect(extractTextFromNode(elementOf('<br>', 'br'))).toBe('')
    })

    it('interleaved inline text and child elements concatenated in DOM order', () => {
      expect(extractTextFromNode(elementOf('<p>intro <strong>bold</strong> end</p>', 'p'))).toBe('intro bold end ')
    })
  })

  describe('excluded element types — content never included regardless of nesting depth', () => {
    it.each([
      ['top-level script', '<script>evil()</script><p>safe</p>', 'safe ', 'evil'],
      ['top-level style', '<style>.x{color:red}</style><p>visible</p>', 'visible ', '.x'],
      ['top-level iframe', '<iframe>blocked</iframe><p>content</p>', 'content ', 'blocked'],
      ['script nested inside div', '<div><script>evil()</script><p>safe</p></div>', 'safe ', 'evil'],
      ['style nested inside div', '<div><style>.x{color:red}</style><p>visible</p></div>', 'visible ', '.x'],
      ['iframe nested inside div', '<div><iframe>blocked</iframe><p>content</p></div>', 'content ', 'blocked'],
    ])('%s', (_label, html, expectedText, excludedText) => {
      const result = extractTextFromNode(bodyOf(html))
      expect(result).toBe(expectedText)
      expect(result).not.toContain(excludedText)
    })
  })

  describe('accumulator threading', () => {
    it('appends extracted text to a non-empty initial accumulator', () => {
      expect(extractTextFromNode(firstTextChildOf('<p>world</p>', 'p'), 'hello ')).toBe('hello world ')
    })

    it('explicit empty-string accumulator produces same result as default', () => {
      const node = firstTextChildOf('<p>text</p>', 'p')
      expect(extractTextFromNode(node, '')).toBe(extractTextFromNode(node))
    })
  })
})
