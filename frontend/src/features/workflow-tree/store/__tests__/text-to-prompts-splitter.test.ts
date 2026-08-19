import { describe, it, expect } from 'vitest'
import { parseTextToPromptSeeds, type PromptSeed } from '../text-to-prompts-splitter'

const titles = (seeds: readonly PromptSeed[]): string[] => seeds.map(seed => seed.title)

describe('parseTextToPromptSeeds', () => {
  describe('block separation', () => {
    it('makes one root per blank-line-delimited block', () => {
      const seeds = parseTextToPromptSeeds('First\n\nSecond\n\nThird')
      expect(titles(seeds)).toEqual(['First', 'Second', 'Third'])
      seeds.forEach(seed => expect(seed.children).toEqual([]))
    })

    it('collapses runs of blank lines between blocks', () => {
      expect(titles(parseTextToPromptSeeds('First\n\n\n\nSecond'))).toEqual(['First', 'Second'])
    })

    it('treats every non-indented line as its own root', () => {
      expect(titles(parseTextToPromptSeeds('A\nB\nC'))).toEqual(['A', 'B', 'C'])
    })
  })

  describe('indentation hierarchy', () => {
    it('nests an indented line under the line above it', () => {
      const [root] = parseTextToPromptSeeds('Parent\n  Child')
      expect(root.title).toBe('Parent')
      expect(titles(root.children)).toEqual(['Child'])
    })

    it('builds multiple levels and returns to shallower parents', () => {
      const [root] = parseTextToPromptSeeds('Parent\n  Child\n    Grandchild\n  Child2')
      expect(root.title).toBe('Parent')
      expect(titles(root.children)).toEqual(['Child', 'Child2'])
      expect(titles(root.children[0].children)).toEqual(['Grandchild'])
      expect(root.children[1].children).toEqual([])
    })

    it('starts a fresh root when an indented line opens a new block', () => {
      const seeds = parseTextToPromptSeeds('A\n\n  B')
      expect(titles(seeds)).toEqual(['A', 'B'])
      expect(seeds[1].children).toEqual([])
    })

    it('normalizes a tab to four spaces of indentation', () => {
      const [root] = parseTextToPromptSeeds('Parent\n\tChild')
      expect(titles(root.children)).toEqual(['Child'])
    })
  })

  describe('sanitation', () => {
    it('drops blank and whitespace-only lines', () => {
      const [root] = parseTextToPromptSeeds('Parent\n   \n  Child')
      expect(root.title).toBe('Parent')
      expect(titles(root.children)).toEqual(['Child'])
    })

    it('a tab-only line within a block is dropped without disrupting surrounding hierarchy', () => {
      const [root] = parseTextToPromptSeeds('Parent\n\t\n  Child')
      expect(root.title).toBe('Parent')
      expect(titles(root.children)).toEqual(['Child'])
    })

    it.each([
      ['CRLF (\\r\\n\\r\\n)', 'First\r\n\r\nSecond'],
      ['bare CR (\\r\\r)', 'First\r\rSecond'],
    ])('CR-family paragraph break (%s) produces the same two distinct roots as a bare LF break', (_encoding, input) => {
      expect(titles(parseTextToPromptSeeds(input))).toEqual(['First', 'Second'])
    })

    it('a blank line composed of CR-family endings does not create a paragraph boundary — indented content nests under the preceding root', () => {
      for (const blank of ['\r\n\r\n', '\r\r']) {
        const [root] = parseTextToPromptSeeds('Root' + blank + '  Child')
        expect(root.title).toBe('Root')
        expect(titles(root.children)).toEqual(['Child'])
      }
    })

    it('CRLF single-line ending within a block preserves nesting hierarchy identically to LF', () => {
      const [root] = parseTextToPromptSeeds('Root\r\n  Child')
      expect(root.title).toBe('Root')
      expect(titles(root.children)).toEqual(['Child'])
    })

    it('returns an empty list for empty or whitespace-only input', () => {
      expect(parseTextToPromptSeeds('')).toEqual([])
      expect(parseTextToPromptSeeds('   \n\n\t')).toEqual([])
    })
  })

  describe('parity with an execution result shape', () => {
    it('splits every line of an outline into its own node instead of one multiline node', () => {
      const [root] = parseTextToPromptSeeds('Heading\n  point one\n  point two')
      expect(root.title).toBe('Heading')
      expect(titles(root.children)).toEqual(['point one', 'point two'])
    })

    it('preserves inline content of a single unindented block as one node', () => {
      expect(titles(parseTextToPromptSeeds('```js const x = 1 ```'))).toEqual(['```js const x = 1 ```'])
    })

    it('mirrors linesToNodes on deep-jump/dedent outlines (shrinking dedent bound)', () => {
      // Indents 0,2,3,4,1,1: the canonical linesToNodes dedent bound shrinks as
      // levels pop, so both trailing indent-1 lines land on the root rather than
      // the second nesting under the first. render-text-to-map must match this.
      const [root] = parseTextToPromptSeeds('root\n  a\n   b\n    c\n d1\n d2')
      expect(root.title).toBe('root')
      expect(titles(root.children)).toEqual(['a', 'd1', 'd2'])
      const a = root.children.find(child => child.title === 'a')!
      expect(titles(a.children)).toEqual(['b'])
      expect(titles(a.children[0].children)).toEqual(['c'])
    })
  })

  describe('unicode whitespace parity with executor', () => {
    it('nbsp counts as ASCII space for indentation — nesting depth equals the equivalent space count', () => {
      const [root] = parseTextToPromptSeeds('parent\n\u00a0\u00a0child')
      expect(root.title).toBe('parent')
      expect(titles(root.children)).toEqual(['child'])
    })

    it('nbsp and ASCII space combine uniformly when determining indentation depth', () => {
      const [root] = parseTextToPromptSeeds('parent\n\u00a0 child')
      expect(root.title).toBe('parent')
      expect(titles(root.children)).toEqual(['child'])
    })

    it('nbsp mid-title is normalized to an ASCII space', () => {
      const [node] = parseTextToPromptSeeds('word\u00a0word')
      expect(node.title).toBe('word word')
      expect(node.children).toEqual([])
    })

    it('U+2424 within a block acts as a newline, enabling indentation hierarchy', () => {
      const [root] = parseTextToPromptSeeds('parent\u2424  child')
      expect(root.title).toBe('parent')
      expect(titles(root.children)).toEqual(['child'])
    })

    it('U+2424 line breaks compose with multi-level indentation hierarchy', () => {
      const [root] = parseTextToPromptSeeds('root\u2424  child\u2424    grandchild')
      expect(root.title).toBe('root')
      expect(titles(root.children)).toEqual(['child'])
      expect(titles(root.children[0].children)).toEqual(['grandchild'])
    })

    it('consecutive U+2424 in a block produce filtered blank lines, not block separators', () => {
      const seeds = parseTextToPromptSeeds('parent\u2424\u2424child')
      expect(seeds).toHaveLength(2)
      expect(titles(seeds)).toEqual(['parent', 'child'])
      seeds.forEach(seed => expect(seed.children).toEqual([]))
    })

    it('U+2028 and U+2029 mid-title are preserved verbatim — not normalized', () => {
      const [ls] = parseTextToPromptSeeds('hello\u2028world')
      expect(ls.title).toBe('hello\u2028world')
      expect(ls.children).toEqual([])
      const [ps] = parseTextToPromptSeeds('hello\u2029world')
      expect(ps.title).toBe('hello\u2029world')
      expect(ps.children).toEqual([])
    })

    it('ASCII spaces before U+2028/U+2029 on an otherwise-blank line are stripped — separator becomes a root, not a child', () => {
      const lsSeeds = parseTextToPromptSeeds('root\n  \u2028child')
      expect(lsSeeds).toHaveLength(2)
      expect(lsSeeds[0].title).toBe('root')
      expect(lsSeeds[1].title).toBe('\u2028child')
      expect(lsSeeds[0].children).toEqual([])
      expect(lsSeeds[1].children).toEqual([])
      const psSeeds = parseTextToPromptSeeds('root\n  \u2029child')
      expect(psSeeds).toHaveLength(2)
      expect(psSeeds[0].title).toBe('root')
      expect(psSeeds[1].title).toBe('\u2029child')
      expect(psSeeds[0].children).toEqual([])
      expect(psSeeds[1].children).toEqual([])
    })

    it('U+2028 and U+2029 leading a line are not counted as indentation — each becomes its own root', () => {
      for (const sep of ['\u2028', '\u2029']) {
        const seeds = parseTextToPromptSeeds('parent\n' + sep + 'child')
        expect(seeds).toHaveLength(2)
        expect(seeds[0].title).toBe('parent')
        expect(seeds[1].title).toBe(sep + 'child')
        expect(seeds[0].children).toEqual([])
        expect(seeds[1].children).toEqual([])
      }
    })
  })
})
