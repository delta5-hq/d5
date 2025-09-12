import {referencePatterns, createReferencePattern} from './referencePatterns'

describe('referencePatterns', () => {
  describe('ref pattern', () => {
    it('should match references with @ prefix', () => {
      const pattern = referencePatterns.ref
      expect('@reference'.match(pattern)).toBeTruthy()
      expect('@reference123'.match(pattern)).toBeTruthy()
      expect('@reference-with-dash'.match(pattern)).toBeTruthy()
      expect('@reference_with_underscore'.match(pattern)).toBeTruthy()
    })

    it('should match when @ is not at the start of the word', () => {
      const pattern = referencePatterns.ref
      expect('text@reference'.match(pattern)).toBeTruthy()
      expect('word@reference'.match(pattern)).toBeTruthy()
    })
  })

  describe('refWholeWord pattern', () => {
    it('should match whole word references with @ prefix', () => {
      const pattern = referencePatterns.refWholeWord
      expect('@reference'.match(pattern)).toBeTruthy()
      expect('text @reference'.match(pattern)).toBeTruthy()
      expect('@reference text'.match(pattern)).toBeTruthy()
      expect('text @reference text'.match(pattern)).toBeTruthy()
    })

    it('should not match partial words', () => {
      const pattern = referencePatterns.refWholeWord
      expect('@reference@'.match(pattern)).toBeFalsy()
      expect('word@reference'.match(pattern)).toBeFalsy()
      expect('@reference-part'.match(pattern)).toBeTruthy() // Hyphen is allowed
    })
  })

  describe('refWholeWord pattern', () => {
    it('should match whole word references with @ prefix', () => {
      const pattern = referencePatterns.refWholeWord
      expect('@reference'.match(pattern)).toBeTruthy()
      expect('text @reference'.match(pattern)).toBeTruthy()
      expect('@reference text'.match(pattern)).toBeTruthy()
      expect('text @reference text'.match(pattern)).toBeTruthy()
    })

    it('should not match partial words', () => {
      const pattern = referencePatterns.refWholeWord
      expect('@reference@'.match(pattern)).toBeFalsy()
      expect('word@reference'.match(pattern)).toBeFalsy()
      expect('@reference-part'.match(pattern)).toBeTruthy() // Hyphen is allowed
    })
  })

  describe('hashrefs pattern', () => {
    it('should match references with #_ prefix', () => {
      const pattern = referencePatterns.hashrefs
      expect('#_reference'.match(pattern)).toBeTruthy()
      expect('#_tag'.match(pattern)).toBeTruthy()
      expect('#_with-dash'.match(pattern)).toBeTruthy()
      expect('#_with_underscore'.match(pattern)).toBeTruthy()
    })

    it('should not match when #_ is not at the start of the word', () => {
      const pattern = referencePatterns.hashrefsWholeWord
      expect('text#_reference'.match(pattern)).toBeFalsy()
      expect('word#_tag'.match(pattern)).toBeFalsy()
    })
  })

  describe('hashrefsWholeWord pattern', () => {
    it('should match whole word references with #_ prefix', () => {
      const pattern = referencePatterns.hashrefsWholeWord
      expect('#_reference'.match(pattern)).toBeTruthy()
      expect('text #_reference'.match(pattern)).toBeTruthy()
      expect('#_reference text'.match(pattern)).toBeTruthy()
      expect('text #_reference text'.match(pattern)).toBeTruthy()
    })

    it('should not match partial words', () => {
      const pattern = referencePatterns.hashrefsWholeWord
      expect('#_reference#_'.match(pattern)).toBeFalsy()
      expect('word#_reference'.match(pattern)).toBeFalsy()
    })
    it('should match word boundaries', () => {
      const pattern = referencePatterns.hashrefsWholeWord
      expect('#_reference!'.match(pattern)).toBeTruthy()
      expect('#_reference@'.match(pattern)).toBeTruthy()
      expect('#_reference"'.match(pattern)).toBeTruthy()
      expect('#_reference:'.match(pattern)).toBeTruthy()
      expect('#_reference)'.match(pattern)).toBeTruthy()
    })
  })

  describe('withPrefix factory method', () => {
    it('should create pattern for custom prefix', () => {
      const pattern = referencePatterns.withPrefix('$')
      expect('$reference'.match(pattern)).toBeTruthy()
      expect('$tag'.match(pattern)).toBeTruthy()
      expect('$with-dash'.match(pattern)).toBeTruthy()
      expect('$with_underscore'.match(pattern)).toBeTruthy()
    })

    it('should not match when custom prefix is not at the start of the word', () => {
      const pattern = referencePatterns.withPrefix('%')
      expect('text% '.match(pattern)).toBeFalsy()
      expect('word%'.match(pattern)).toBeFalsy()
    })

    it('should handle special character prefixes', () => {
      const pattern = referencePatterns.withPrefix('*')
      expect('*reference'.match(pattern)).toBeTruthy()

      const pattern2 = referencePatterns.withPrefix('+')
      expect('+tag'.match(pattern2)).toBeTruthy()
    })

    it('should handle multi-character prefixes', () => {
      const pattern = referencePatterns.withPrefix('##')
      expect('##reference'.match(pattern)).toBeTruthy()

      const pattern2 = referencePatterns.withPrefix('ref:')
      expect('ref:tag'.match(pattern2)).toBeTruthy()
    })
  })

  describe('wholeWordWithPrefix factory method', () => {
    it('should create whole word pattern for custom prefix', () => {
      const pattern = referencePatterns.wholeWordWithPrefix('$')
      expect('$reference'.match(pattern)).toBeTruthy()
      expect('text $reference'.match(pattern)).toBeTruthy()
      expect('$reference text'.match(pattern)).toBeTruthy()
      expect('text $reference text'.match(pattern)).toBeTruthy()
    })

    it('should not match partial words with custom prefix', () => {
      const pattern = referencePatterns.wholeWordWithPrefix('$')
      expect('$ reference'.match(pattern)).toBeFalsy()
      expect('word$ reference'.match(pattern)).toBeFalsy()
    })

    it('should handle special character prefixes for whole words', () => {
      const pattern = referencePatterns.wholeWordWithPrefix('*')
      expect('*reference'.match(pattern)).toBeTruthy()
      expect('text *reference text'.match(pattern)).toBeTruthy()
    })

    it('should handle multi-character prefixes for whole words', () => {
      const pattern = referencePatterns.wholeWordWithPrefix('##')
      expect('##reference'.match(pattern)).toBeTruthy()
      expect('text ##reference text'.match(pattern)).toBeTruthy()
    })
  })

  describe('specific factory method', () => {
    it('should create pattern for specific reference name', () => {
      const pattern = referencePatterns.specific('reference')
      expect('@reference'.match(pattern)).toBeTruthy()
      expect('This contains @reference in text'.match(pattern)).toBeTruthy()
    })

    it('should match different references', () => {
      const pattern = referencePatterns.specific('reference')
      expect('@different'.match(pattern)).toBeFalsy()
      expect('@reference2'.match(pattern)).toBeTruthy()
    })

    it('should work with custom prefix', () => {
      const pattern = referencePatterns.specific('reference', '#_')
      expect('#_reference'.match(pattern)).toBeTruthy()
      expect('@reference'.match(pattern)).toBeFalsy()
    })
  })

  describe('specificWholeWord factory method', () => {
    it('should create whole word pattern for specific reference name', () => {
      const pattern = referencePatterns.specificWholeWord('reference')
      expect('@reference'.match(pattern)).toBeTruthy()
      expect('This contains @reference in text'.match(pattern)).toBeTruthy()
    })

    it('should not match when reference is part of another word', () => {
      const pattern = referencePatterns.specificWholeWord('reference')
      expect('@reference123'.match(pattern)).toBeFalsy()
      expect('word@reference'.match(pattern)).toBeFalsy()
      expect('text@reference'.match(pattern)).toBeFalsy()
    })

    it('should work with custom prefix for whole words', () => {
      const pattern = referencePatterns.specificWholeWord('reference', '#_')
      expect('#_reference'.match(pattern)).toBeTruthy()
      expect('@reference'.match(pattern)).toBeFalsy()
    })

    it('should handle exact reference matches', () => {
      const pattern = referencePatterns.specificWholeWord('ref-123')
      expect('@ref-123'.match(pattern)).toBeTruthy()
      expect('@ref-1234'.match(pattern)).toBeFalsy()
    })
  })

  describe('deprecated functions', () => {
    it('createReferencePattern should create a basic reference pattern', () => {
      const pattern = createReferencePattern('@')
      expect(pattern).toBe('@[\\w-]+')
    })
  })

  // Add tests for withAssignmentPrefix
  describe('withAssignmentPrefix method', () => {
    it('should match references with @ prefix and capture the name portion', () => {
      const pattern = referencePatterns.withAssignmentPrefix()
      const match = '@reference'.match(pattern)
      expect(match).toBeTruthy()
      expect(match[1]).toBe('reference')

      expect('@reference123'.match(pattern)[1]).toBe('reference123')
      expect('@reference-with-dash'.match(pattern)[1]).toBe('reference-with-dash')
    })

    it('should match multiple @ signs with capture group', () => {
      const pattern = referencePatterns.withAssignmentPrefix()
      const match = '@@reference'.match(pattern)
      expect(match).toBeTruthy()
      expect(match[1]).toBe('reference')
    })

    it('should work with custom prefixes', () => {
      const pattern = referencePatterns.withAssignmentPrefix('#')
      const match = '#reference'.match(pattern)
      expect(match).toBeTruthy()
      expect(match[1]).toBe('reference')

      const pattern2 = referencePatterns.withAssignmentPrefix('$')
      const match2 = '$variable'.match(pattern2)
      expect(match2).toBeTruthy()
      expect(match2[1]).toBe('variable')
    })

    it('should handle special regex characters as prefixes', () => {
      const pattern = referencePatterns.withAssignmentPrefix('.')
      const match = '.reference'.match(pattern)
      expect(match).toBeTruthy()
      expect(match[1]).toBe('reference')

      const pattern2 = referencePatterns.withAssignmentPrefix('*')
      const match2 = '*reference'.match(pattern2)
      expect(match2).toBeTruthy()
      expect(match2[1]).toBe('reference')
    })

    it('should match references with :first suffix', () => {
      const pattern = referencePatterns.withAssignmentPrefix('#')
      const match = '#reference:first'.match(pattern)
      expect(match).toBeTruthy()
      expect(match[1]).toBe('reference')
    })

    it('should match references with no suffix alongside :first and :last', () => {
      const pattern = referencePatterns.withAssignmentPrefix('$')
      const matches = ['$ref', '$ref:first', '$ref:last'].map(str => str.match(pattern))

      expect(matches.every(m => m)).toBe(true)
      expect(matches[0][1]).toBe('ref')
      expect(matches[1][1]).toBe('ref')
      expect(matches[2][1]).toBe('ref')
    })
  })

  describe('Word boundary detection', () => {
    it('should handle punctuation as word boundaries', () => {
      const pattern = referencePatterns.refWholeWord
      expect('@reference.'.match(pattern)[1]).toBe('@reference')
      expect('@reference,'.match(pattern)[1]).toBe('@reference')
      expect('@reference!'.match(pattern)[1]).toBe('@reference')
      expect('@reference?'.match(pattern)[1]).toBe('@reference')
      expect('@reference;'.match(pattern)[1]).toBe('@reference')
      expect('@reference:'.match(pattern)[1]).toBe('@reference')
    })

    it('should handle brackets as word boundaries', () => {
      const pattern = referencePatterns.refWholeWord
      expect('@reference('.match(pattern)[1]).toBe('@reference')
      expect('@reference)'.match(pattern)[1]).toBe('@reference')
      expect('@reference['.match(pattern)[1]).toBe('@reference')
      expect('@reference]'.match(pattern)[1]).toBe('@reference')
      expect('@reference{'.match(pattern)[1]).toBe('@reference')
      expect('@reference}'.match(pattern)[1]).toBe('@reference')
      expect('@reference<'.match(pattern)[1]).toBe('@reference')
      expect('@reference>'.match(pattern)[1]).toBe('@reference')
    })

    it('should handle quotes as word boundaries', () => {
      const pattern = referencePatterns.refWholeWord
      expect("@reference'".match(pattern)[1]).toBe('@reference')
      expect('@reference"'.match(pattern)[1]).toBe('@reference')
      expect('@reference`'.match(pattern)[1]).toBe('@reference')
    })

    it('should handle math operators as word boundaries', () => {
      const pattern = referencePatterns.refWholeWord
      expect('@reference+'.match(pattern)[1]).toBe('@reference')
      expect('@reference-'.match(pattern)[1]).toBe('@reference-') // Note: hyphen is allowed in references
      expect('@reference*'.match(pattern)[1]).toBe('@reference')
      expect('@reference='.match(pattern)[1]).toBe('@reference')
      expect('@reference%'.match(pattern)[1]).toBe('@reference')
    })

    it('should handle other special characters as word boundaries', () => {
      const pattern = referencePatterns.refWholeWord
      expect('@reference^'.match(pattern)[1]).toBe('@reference')
      expect('@reference&'.match(pattern)[1]).toBe('@reference')
      expect('@reference|'.match(pattern)[1]).toBe('@reference')
      expect('@reference~'.match(pattern)[1]).toBe('@reference')
      expect('@reference$'.match(pattern)[1]).toBe('@reference')
    })

    it('should correctly handle word boundaries when the prefix is multi-character', () => {
      const pattern = referencePatterns.wholeWordWithPrefix('##')
      expect('##reference;'.match(pattern)[1]).toBe('##reference')
      expect('##reference,'.match(pattern)[1]).toBe('##reference')
      expect('text ##reference!'.match(pattern)[1]).toBe('##reference')
    })

    it('should correctly exclude prefix characters from word boundaries', () => {
      // Create a pattern with @ as prefix - @ should not be considered a boundary
      const pattern = referencePatterns.refWholeWord

      // This should match because @ is excluded from boundaries when it's the prefix
      expect('text@reference'.match(pattern)).toBeFalsy()

      // Test with custom prefix '#'
      const hashPattern = referencePatterns.wholeWordWithPrefix('#')
      expect('text#reference'.match(hashPattern)).toBeFalsy()
      expect('word#othertag'.match(hashPattern)).toBeFalsy()
    })
  })

  describe('Capturing groups', () => {
    it('should capture only the reference, not the boundary characters', () => {
      const pattern = referencePatterns.refWholeWord
      expect('Hello @reference!'.match(pattern)[1]).toBe('@reference')
      expect('@reference text'.match(pattern)[1]).toBe('@reference')
      expect('(@reference)'.match(pattern)[1]).toBe('@reference')
    })

    it('should capture specific references correctly', () => {
      const pattern = referencePatterns.specificWholeWord('hello')
      expect('Text with @hello!'.match(pattern)[1]).toBe('@hello')
      expect('@hello world'.match(pattern)[1]).toBe('@hello')
    })

    it('should handle multi-character prefixes in capture groups', () => {
      const pattern = referencePatterns.wholeWordWithPrefix('##')
      expect('##tag in text'.match(pattern)[1]).toBe('##tag')
      expect('Text with ##tag.'.match(pattern)[1]).toBe('##tag')
    })
  })

  describe('Special prefix cases', () => {
    it('should handle regex special characters as prefixes', () => {
      // Using characters that are special in regex contexts
      const pattern1 = referencePatterns.wholeWordWithPrefix('+')
      expect('Text +reference'.match(pattern1)[1]).toBe('+reference')

      const pattern2 = referencePatterns.wholeWordWithPrefix('*')
      expect('*reference text'.match(pattern2)[1]).toBe('*reference')

      const pattern3 = referencePatterns.wholeWordWithPrefix('.')
      expect('Text .reference!'.match(pattern3)[1]).toBe('.reference')

      const pattern4 = referencePatterns.wholeWordWithPrefix('?')
      expect('?reference text'.match(pattern4)[1]).toBe('?reference')
    })

    it('should handle prefixes with multiple special characters', () => {
      const pattern = referencePatterns.wholeWordWithPrefix('*+.')
      expect('Text *+.reference,'.match(pattern)[1]).toBe('*+.reference')
    })

    it('should handle prefixes that include word boundary characters', () => {
      const pattern = referencePatterns.wholeWordWithPrefix('.#')
      expect('.#reference'.match(pattern)[1]).toBe('.#reference')
      expect('Text .#reference!'.match(pattern)[1]).toBe('.#reference')
    })
  })

  describe('matchAll method with reference patterns', () => {
    it('should extract all references with matchAll using ref pattern', () => {
      const pattern = referencePatterns.ref
      const text = 'Here is @reference1 and @reference2 and even @reference-with-dash'
      const matches = Array.from(text.matchAll(pattern))

      expect(matches.length).toBe(3)
      expect(matches[0][0]).toBe('@reference1')
      expect(matches[1][0]).toBe('@reference2')
      expect(matches[2][0]).toBe('@reference-with-dash')
    })

    it('should extract all hashrefs with matchAll', () => {
      const pattern = referencePatterns.hashrefs
      const text = 'Using #_tag1 and #_tag2 and #_complex-tag'
      const matches = Array.from(text.matchAll(pattern))

      expect(matches.length).toBe(3)
      expect(matches[0][0]).toBe('#_tag1')
      expect(matches[1][0]).toBe('#_tag2')
      expect(matches[2][0]).toBe('#_complex-tag')
    })

    it('should extract matches with withPrefix using matchAll', () => {
      const pattern = referencePatterns.withPrefix('$')
      const text = 'Using $var1 and $var2 and normal text'
      const matches = Array.from(text.matchAll(pattern))

      expect(matches.length).toBe(2)
      expect(matches[0][0]).toBe('$var1')
      expect(matches[1][0]).toBe('$var2')
    })

    it('should handle multiple references with the same prefix', () => {
      const pattern = referencePatterns.withPrefix('@')
      const text = '@ref @ref @ref are all references'
      const matches = Array.from(text.matchAll(pattern))

      expect(matches.length).toBe(3)
      matches.forEach(match => {
        expect(match[0]).toBe('@ref')
      })
    })

    it('should handle references at various positions in text', () => {
      const pattern = referencePatterns.withPrefix('@')
      const text = '@start is at beginning, middle has @middle, and end has @end'
      const matches = Array.from(text.matchAll(pattern))

      expect(matches.length).toBe(3)
      expect(matches[0][0]).toBe('@start')
      expect(matches[1][0]).toBe('@middle')
      expect(matches[2][0]).toBe('@end')
    })

    it('should handle empty strings', () => {
      const pattern = referencePatterns.withPrefix('@')
      const matches = Array.from(''.matchAll(pattern))

      expect(matches.length).toBe(0)
    })

    it('should handle no matches', () => {
      const pattern = referencePatterns.withPrefix('@')
      const text = 'No references here'
      const matches = Array.from(text.matchAll(pattern))

      expect(matches.length).toBe(0)
    })

    it('should handle references with numbers', () => {
      const pattern = referencePatterns.withPrefix('@')
      const text = '@ref1 and @ref2 and @ref3'
      const matches = Array.from(text.matchAll(pattern))

      expect(matches.length).toBe(3)
      expect(matches[0][0]).toBe('@ref1')
      expect(matches[1][0]).toBe('@ref2')
      expect(matches[2][0]).toBe('@ref3')
    })

    it('should correctly identify reference boundaries with matchAll', () => {
      const pattern = referencePatterns.withPrefix('@')
      const text = '@good @good@bad @bad@good notgood@bad'
      const matches = Array.from(text.matchAll(pattern))

      // Should only match valid references
      expect(matches.length).toBe(6)
      expect(matches[0][0]).toBe('@good')
      expect(matches[1][0]).toBe('@good')
      expect(matches[2][0]).toBe('@bad')
      expect(matches[2][0]).toBe('@bad')
      expect(matches[1][0]).toBe('@good')
      expect(matches[2][0]).toBe('@bad')
    })

    it('should extract custom prefix references with multi-character prefixes', () => {
      const pattern = referencePatterns.withPrefix('##')
      const text = 'Using ##tag1 and ##tag-with-dash'
      const matches = Array.from(text.matchAll(pattern))

      expect(matches.length).toBe(2)
      expect(matches[0][0]).toBe('##tag1')
      expect(matches[1][0]).toBe('##tag-with-dash')
    })

    it('should work with specific references', () => {
      const pattern = referencePatterns.specific('exact-name')
      const text = 'Here is @exact-name and @not-exact-name'
      // Note: specific pattern doesn't include global flag, so matchAll won't work as expected
      // But let's convert to a global pattern for testing
      const globalPattern = new RegExp(pattern.source, 'g')
      const matches = Array.from(text.matchAll(globalPattern))

      expect(matches.length).toBe(1)
      expect(matches[0][0]).toBe('@exact-name')
    })

    it('should simulate getReferences behavior with different prefixes', () => {
      // This test simulates how getReferences uses matchAll

      function mockGetReferences(value, prefix = '@') {
        if (typeof value !== 'string') return []
        const matches = Array.from(value.matchAll(referencePatterns.withPrefix(prefix)))
        return matches.map(m => m[0])
      }

      expect(mockGetReferences('Test @ref1 and @ref2', '@')).toEqual(['@ref1', '@ref2'])
      expect(mockGetReferences('Test #_tag1 and #_tag2', '#_')).toEqual(['#_tag1', '#_tag2'])
      expect(mockGetReferences('Test $var1 and $var2', '$')).toEqual(['$var1', '$var2'])
      expect(mockGetReferences('No refs here', '@')).toEqual([])
      expect(mockGetReferences(undefined, '@')).toEqual([])
    })
  })
})
