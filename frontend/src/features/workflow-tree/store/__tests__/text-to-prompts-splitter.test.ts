import { describe, it, expect } from 'vitest'
import { parseTextIntoBlocks, createPromptNodesFromText } from '../text-to-prompts-splitter'

describe('text-to-prompts-splitter', () => {
  describe('parseTextIntoBlocks', () => {
    describe('paragraph splitting', () => {
      it('splits text by double newlines', () => {
        const text = 'First paragraph\n\nSecond paragraph\n\nThird paragraph'
        const blocks = parseTextIntoBlocks(text)
        expect(blocks).toHaveLength(3)
        expect(blocks[0].content).toBe('First paragraph')
        expect(blocks[1].content).toBe('Second paragraph')
        expect(blocks[2].content).toBe('Third paragraph')
      })

      it('treats single paragraph as single block', () => {
        const text = 'Single paragraph'
        const blocks = parseTextIntoBlocks(text)
        expect(blocks).toHaveLength(1)
        expect(blocks[0].content).toBe('Single paragraph')
      })

      it('handles many paragraphs', () => {
        const text = Array(10)
          .fill(0)
          .map((_, i) => `Para ${i}`)
          .join('\n\n')
        const blocks = parseTextIntoBlocks(text)
        expect(blocks).toHaveLength(10)
      })
    })

    describe('whitespace trimming', () => {
      it('trims whitespace from each block', () => {
        const text = '  First  \n\n  Second  '
        const blocks = parseTextIntoBlocks(text)
        expect(blocks[0].content).toBe('First')
        expect(blocks[1].content).toBe('Second')
      })

      it('trims leading and trailing newlines', () => {
        const text = '\n\nFirst\n\nSecond\n\n'
        const blocks = parseTextIntoBlocks(text)
        expect(blocks).toHaveLength(2)
        expect(blocks[0].content).toBe('First')
        expect(blocks[1].content).toBe('Second')
      })

      it('removes paragraphs that are only whitespace', () => {
        const text = 'First\n\n   \n\n\t\n\nSecond'
        const blocks = parseTextIntoBlocks(text)
        expect(blocks).toHaveLength(2)
        expect(blocks[0].content).toBe('First')
        expect(blocks[1].content).toBe('Second')
      })
    })

    describe('empty paragraph filtering', () => {
      it('filters empty paragraphs between double newlines', () => {
        const text = 'First\n\n\n\nSecond'
        const blocks = parseTextIntoBlocks(text)
        expect(blocks).toHaveLength(2)
        expect(blocks[0].content).toBe('First')
        expect(blocks[1].content).toBe('Second')
      })

      it('filters multiple consecutive empty paragraphs', () => {
        const text = 'First\n\n\n\n\n\n\n\nSecond'
        const blocks = parseTextIntoBlocks(text)
        expect(blocks).toHaveLength(2)
      })
    })

    describe('single newline preservation', () => {
      it('preserves single newlines within paragraphs', () => {
        const text = 'Line 1\nLine 2\n\nParagraph 2'
        const blocks = parseTextIntoBlocks(text)
        expect(blocks).toHaveLength(2)
        expect(blocks[0].content).toBe('Line 1\nLine 2')
        expect(blocks[1].content).toBe('Paragraph 2')
      })

      it('preserves multiple single newlines within paragraph', () => {
        const text = 'L1\nL2\nL3\nL4\n\nParagraph 2'
        const blocks = parseTextIntoBlocks(text)
        expect(blocks[0].content).toBe('L1\nL2\nL3\nL4')
      })
    })

    describe('edge cases', () => {
      it('handles empty input', () => {
        expect(parseTextIntoBlocks('')).toEqual([])
      })

      it('handles whitespace-only input', () => {
        expect(parseTextIntoBlocks('   \n\n   ')).toEqual([])
        expect(parseTextIntoBlocks('\t\t\t')).toEqual([])
        expect(parseTextIntoBlocks('\n\n\n\n')).toEqual([])
      })

      it('handles single character paragraphs', () => {
        const text = 'a\n\nb\n\nc'
        const blocks = parseTextIntoBlocks(text)
        expect(blocks).toHaveLength(3)
        expect(blocks[0].content).toBe('a')
        expect(blocks[1].content).toBe('b')
        expect(blocks[2].content).toBe('c')
      })

      it('handles very long paragraphs', () => {
        const longText = 'A'.repeat(10000)
        const text = `${longText}\n\n${longText}`
        const blocks = parseTextIntoBlocks(text)
        expect(blocks).toHaveLength(2)
        expect(blocks[0].content).toBe(longText)
      })

      it('handles special characters', () => {
        const text = '!@#$%^&*()\n\n<html>\n\n{json}'
        const blocks = parseTextIntoBlocks(text)
        expect(blocks).toHaveLength(3)
        expect(blocks[0].content).toBe('!@#$%^&*()')
        expect(blocks[1].content).toBe('<html>')
        expect(blocks[2].content).toBe('{json}')
      })

      it('handles unicode characters', () => {
        const text = '你好\n\n🎉\n\nΩ'
        const blocks = parseTextIntoBlocks(text)
        expect(blocks).toHaveLength(3)
        expect(blocks[0].content).toBe('你好')
        expect(blocks[1].content).toBe('🎉')
        expect(blocks[2].content).toBe('Ω')
      })
    })

    describe('isEmpty flag', () => {
      it('marks non-empty blocks correctly', () => {
        const text = 'Content\n\nMore content'
        const blocks = parseTextIntoBlocks(text)
        expect(blocks[0].isEmpty).toBe(false)
        expect(blocks[1].isEmpty).toBe(false)
      })

      it('does not include empty blocks in result', () => {
        const text = 'Content\n\n\n\nMore content'
        const blocks = parseTextIntoBlocks(text)
        blocks.forEach(block => expect(block.isEmpty).toBe(false))
      })
    })
  })

  describe('createPromptNodesFromText', () => {
    describe('node creation', () => {
      it('creates node data for each non-empty paragraph', () => {
        const text = 'First\n\nSecond\n\nThird'
        const nodes = createPromptNodesFromText('parent-123', text)
        expect(nodes).toHaveLength(3)
        expect(nodes[0]).toEqual({ title: 'First', parent: 'parent-123' })
        expect(nodes[1]).toEqual({ title: 'Second', parent: 'parent-123' })
        expect(nodes[2]).toEqual({ title: 'Third', parent: 'parent-123' })
      })

      it('creates single node for single paragraph', () => {
        const text = 'Single paragraph'
        const nodes = createPromptNodesFromText('parent-123', text)
        expect(nodes).toHaveLength(1)
        expect(nodes[0]).toEqual({ title: 'Single paragraph', parent: 'parent-123' })
      })

      it('assigns correct parent to all nodes', () => {
        const text = 'A\n\nB\n\nC'
        const nodes = createPromptNodesFromText('custom-parent', text)
        nodes.forEach(node => expect(node.parent).toBe('custom-parent'))
      })
    })

    describe('empty block filtering', () => {
      it('filters empty blocks', () => {
        const text = 'First\n\n\n\nSecond'
        const nodes = createPromptNodesFromText('parent-123', text)
        expect(nodes).toHaveLength(2)
      })

      it('filters whitespace-only blocks', () => {
        const text = 'First\n\n   \n\nSecond'
        const nodes = createPromptNodesFromText('parent-123', text)
        expect(nodes).toHaveLength(2)
      })
    })

    describe('empty input handling', () => {
      it('returns empty array for empty input', () => {
        expect(createPromptNodesFromText('parent-123', '')).toEqual([])
      })

      it('returns empty array for whitespace-only input', () => {
        expect(createPromptNodesFromText('parent-123', '   \n\n   ')).toEqual([])
        expect(createPromptNodesFromText('parent-123', '\n\n\n\n')).toEqual([])
      })
    })

    describe('multiline content preservation', () => {
      it('preserves multiline content within paragraphs', () => {
        const text = 'Line 1\nLine 2\nLine 3\n\nParagraph 2'
        const nodes = createPromptNodesFromText('parent-123', text)
        expect(nodes[0].title).toBe('Line 1\nLine 2\nLine 3')
        expect(nodes[1].title).toBe('Paragraph 2')
      })

      it('preserves code blocks', () => {
        const code = '```js\nconst x = 1;\n```'
        const text = `${code}\n\nExplanation`
        const nodes = createPromptNodesFromText('parent-123', text)
        expect(nodes[0].title).toBe(code)
        expect(nodes[1].title).toBe('Explanation')
      })
    })

    describe('special content handling', () => {
      it('handles markdown formatting', () => {
        const text = '# Heading\n\n**Bold** and *italic*\n\n- List item'
        const nodes = createPromptNodesFromText('parent-123', text)
        expect(nodes).toHaveLength(3)
        expect(nodes[0].title).toBe('# Heading')
        expect(nodes[1].title).toBe('**Bold** and *italic*')
        expect(nodes[2].title).toBe('- List item')
      })

      it('handles HTML content', () => {
        const text = '<div>Content</div>\n\n<span>More</span>'
        const nodes = createPromptNodesFromText('parent-123', text)
        expect(nodes).toHaveLength(2)
        expect(nodes[0].title).toBe('<div>Content</div>')
        expect(nodes[1].title).toBe('<span>More</span>')
      })

      it('handles JSON content', () => {
        const json1 = '{"key": "value1"}'
        const json2 = '{"key": "value2"}'
        const text = `${json1}\n\n${json2}`
        const nodes = createPromptNodesFromText('parent-123', text)
        expect(nodes[0].title).toBe(json1)
        expect(nodes[1].title).toBe(json2)
      })
    })

    describe('parent ID variations', () => {
      it('handles different parent ID formats', () => {
        const text = 'Content'
        expect(createPromptNodesFromText('simple', text)[0].parent).toBe('simple')
        expect(createPromptNodesFromText('parent-with-dashes', text)[0].parent).toBe('parent-with-dashes')
        expect(createPromptNodesFromText('parent_with_underscores', text)[0].parent).toBe('parent_with_underscores')
        expect(createPromptNodesFromText('UUID-1234-5678', text)[0].parent).toBe('UUID-1234-5678')
      })
    })

    describe('node structure integrity', () => {
      it('creates nodes with only title and parent fields', () => {
        const text = 'Content'
        const nodes = createPromptNodesFromText('parent-123', text)
        const node = nodes[0]
        expect(Object.keys(node)).toHaveLength(2)
        expect(node).toHaveProperty('title')
        expect(node).toHaveProperty('parent')
      })

      it('does not include children or other fields', () => {
        const text = 'Content'
        const nodes = createPromptNodesFromText('parent-123', text)
        const node = nodes[0]
        expect(node).not.toHaveProperty('children')
        expect(node).not.toHaveProperty('id')
        expect(node).not.toHaveProperty('command')
      })
    })

    describe('large input handling', () => {
      it('handles many paragraphs efficiently', () => {
        const paragraphs = Array(100)
          .fill(0)
          .map((_, i) => `Paragraph ${i}`)
        const text = paragraphs.join('\n\n')
        const nodes = createPromptNodesFromText('parent-123', text)
        expect(nodes).toHaveLength(100)
        expect(nodes[50].title).toBe('Paragraph 50')
      })

      it('handles very long paragraph content', () => {
        const longContent = 'A'.repeat(50000)
        const text = `${longContent}\n\nShort`
        const nodes = createPromptNodesFromText('parent-123', text)
        expect(nodes).toHaveLength(2)
        expect(nodes[0].title).toBe(longContent)
      })
    })
  })
})
