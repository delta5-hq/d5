import { describe, it, expect } from 'vitest'
import { extractQueryTypeFromCommand } from '../command-querytype-mapper'

describe('extractQueryTypeFromCommand - Command Mapping', () => {
  describe('chat-type commands', () => {
    it('maps /instruct to chat', () => {
      expect(extractQueryTypeFromCommand('/instruct Write a poem')).toBe('chat')
    })

    it('maps /reason to chat', () => {
      expect(extractQueryTypeFromCommand('/reason Analyze this')).toBe('chat')
    })

    it('maps /chatgpt to chat', () => {
      expect(extractQueryTypeFromCommand('/chatgpt Hello')).toBe('chat')
    })

    it('maps /chat to chat', () => {
      expect(extractQueryTypeFromCommand('/chat General query')).toBe('chat')
    })
  })

  describe('specialized query commands', () => {
    it('maps /web to web', () => {
      expect(extractQueryTypeFromCommand('/web Search for docs')).toBe('web')
    })

    it('maps /scholar to scholar', () => {
      expect(extractQueryTypeFromCommand('/scholar Research papers')).toBe('scholar')
    })

    it('maps /refine to refine', () => {
      expect(extractQueryTypeFromCommand('/refine Improve text')).toBe('refine')
    })

    it('maps /foreach to foreach', () => {
      expect(extractQueryTypeFromCommand('/foreach Process items')).toBe('foreach')
    })

    it('maps /steps to steps', () => {
      expect(extractQueryTypeFromCommand('/steps Break down task')).toBe('steps')
    })

    it('maps /outline to outline', () => {
      expect(extractQueryTypeFromCommand('/outline Create structure')).toBe('outline')
    })

    it('maps /summarize to summarize', () => {
      expect(extractQueryTypeFromCommand('/summarize Long document')).toBe('summarize')
    })

    it('maps /switch to switch', () => {
      expect(extractQueryTypeFromCommand('/switch Change context')).toBe('switch')
    })

    it('maps /memorize to memorize', () => {
      expect(extractQueryTypeFromCommand('/memorize Important fact')).toBe('memorize')
    })

    it('maps /ext to ext', () => {
      expect(extractQueryTypeFromCommand('/ext External call')).toBe('ext')
    })
  })

  describe('LLM provider commands', () => {
    it('maps /claude to claude', () => {
      expect(extractQueryTypeFromCommand('/claude Use Anthropic')).toBe('claude')
    })

    it('maps /qwen to qwen', () => {
      expect(extractQueryTypeFromCommand('/qwen Use Qwen model')).toBe('qwen')
    })

    it('maps /perplexity to perplexity', () => {
      expect(extractQueryTypeFromCommand('/perplexity Search and answer')).toBe('perplexity')
    })

    it('maps /deepseek to deepseek', () => {
      expect(extractQueryTypeFromCommand('/deepseek Code analysis')).toBe('deepseek')
    })

    it('maps /custom to custom_llm', () => {
      expect(extractQueryTypeFromCommand('/custom My LLM')).toBe('custom_llm')
    })

    it('maps /yandexgpt to yandex', () => {
      expect(extractQueryTypeFromCommand('/yandexgpt Russian query')).toBe('yandex')
    })
  })

  describe('fallback behavior', () => {
    it('strips slash from unknown commands', () => {
      expect(extractQueryTypeFromCommand('/unknown Do something')).toBe('unknown')
    })

    it('strips slash from unregistered command', () => {
      expect(extractQueryTypeFromCommand('/newfeature Test')).toBe('newfeature')
    })

    it('handles commands without slash prefix', () => {
      expect(extractQueryTypeFromCommand('chat Hello')).toBe('chat')
    })

    it('returns non-slash command as-is', () => {
      expect(extractQueryTypeFromCommand('custom Direct query')).toBe('custom')
    })
  })

  describe('edge cases', () => {
    it('defaults to chat for empty string', () => {
      expect(extractQueryTypeFromCommand('')).toBe('chat')
    })

    it('defaults to chat for undefined', () => {
      expect(extractQueryTypeFromCommand(undefined)).toBe('chat')
    })

    it('extracts first word from multi-word commands', () => {
      expect(extractQueryTypeFromCommand('/web search for documentation')).toBe('web')
    })

    it('handles command with only whitespace after slash', () => {
      expect(extractQueryTypeFromCommand('/   ')).toBe('')
    })

    it('trims leading whitespace', () => {
      expect(extractQueryTypeFromCommand('   /web query')).toBe('web')
    })

    it('trims trailing whitespace', () => {
      expect(extractQueryTypeFromCommand('/web query   ')).toBe('web')
    })

    it('handles multiple spaces between command and text', () => {
      expect(extractQueryTypeFromCommand('/web     search query')).toBe('web')
    })

    it('handles tab characters', () => {
      expect(extractQueryTypeFromCommand('/web\t\tsearch')).toBe('web')
    })

    it('handles newline characters', () => {
      expect(extractQueryTypeFromCommand('/web\nsearch')).toBe('web')
    })

    it('handles command with no text after', () => {
      expect(extractQueryTypeFromCommand('/web')).toBe('web')
    })

    it('handles double slash as unknown command', () => {
      expect(extractQueryTypeFromCommand('//web')).toBe('/web')
    })

    it('handles slash in middle as regular word', () => {
      expect(extractQueryTypeFromCommand('web/search query')).toBe('web/search')
    })

    it('preserves case for unknown commands', () => {
      expect(extractQueryTypeFromCommand('/UnknownCommand')).toBe('UnknownCommand')
    })

    it('handles very long command names', () => {
      const longCommand = '/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
      expect(extractQueryTypeFromCommand(longCommand)).toBe('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
    })

    it('handles special characters in unknown commands', () => {
      expect(extractQueryTypeFromCommand('/@#$%')).toBe('@#$%')
    })

    it('handles unicode characters', () => {
      expect(extractQueryTypeFromCommand('/查询 search')).toBe('查询')
    })

    it('handles emoji in command', () => {
      expect(extractQueryTypeFromCommand('/🔍 search')).toBe('🔍')
    })
  })
})
