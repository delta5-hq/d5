import { describe, it, expect } from 'vitest'
import { getCommandRole, QUERY_TYPE_ROLES, type CommandRole } from '../command-roles'

describe('command-roles', () => {
  describe('QUERY_TYPE_ROLES mapping', () => {
    it('should map LLM query types to llm role', () => {
      const llmTypes = ['chat', 'claude', 'qwen', 'deepseek', 'perplexity', 'yandex', 'custom_llm', 'completion']

      llmTypes.forEach(type => {
        expect(QUERY_TYPE_ROLES[type]).toBe('llm')
      })
    })

    it('should map search query types to search role', () => {
      const searchTypes = ['web', 'scholar']

      searchTypes.forEach(type => {
        expect(QUERY_TYPE_ROLES[type]).toBe('search')
      })
    })

    it('should map transform query types to transform role', () => {
      const transformTypes = ['summarize', 'refine']

      transformTypes.forEach(type => {
        expect(QUERY_TYPE_ROLES[type]).toBe('transform')
      })
    })

    it('should map control flow query types to control role', () => {
      const controlTypes = ['foreach', 'switch', 'steps', 'outline']

      controlTypes.forEach(type => {
        expect(QUERY_TYPE_ROLES[type]).toBe('control')
      })
    })

    it('should map utility query types to utility role', () => {
      const utilityTypes = ['memorize', 'ext', 'download']

      utilityTypes.forEach(type => {
        expect(QUERY_TYPE_ROLES[type]).toBe('utility')
      })
    })

    it('should map frontend command formats to correct roles', () => {
      expect(QUERY_TYPE_ROLES['/instruct']).toBe('llm')
      expect(QUERY_TYPE_ROLES['/reason']).toBe('llm')
      expect(QUERY_TYPE_ROLES['/web']).toBe('search')
      expect(QUERY_TYPE_ROLES['/scholar']).toBe('search')
      expect(QUERY_TYPE_ROLES['/refine']).toBe('transform')
      expect(QUERY_TYPE_ROLES['/foreach']).toBe('control')
    })
  })

  describe('getCommandRole', () => {
    it('should return correct role for valid query type', () => {
      expect(getCommandRole('chat')).toBe('llm')
      expect(getCommandRole('web')).toBe('search')
      expect(getCommandRole('summarize')).toBe('transform')
      expect(getCommandRole('foreach')).toBe('control')
      expect(getCommandRole('memorize')).toBe('utility')
    })

    it('should return correct role for frontend command format', () => {
      expect(getCommandRole('/instruct')).toBe('llm')
      expect(getCommandRole('/web')).toBe('search')
      expect(getCommandRole('/refine')).toBe('transform')
      expect(getCommandRole('/foreach')).toBe('control')
    })

    it('should return undefined for undefined input', () => {
      expect(getCommandRole(undefined)).toBeUndefined()
    })

    it('should return undefined for unknown query type', () => {
      expect(getCommandRole('unknown')).toBeUndefined()
      expect(getCommandRole('invalid-command')).toBeUndefined()
      expect(getCommandRole('')).toBeUndefined()
    })

    it('should handle null gracefully', () => {
      expect(getCommandRole(null as unknown as string)).toBeUndefined()
    })

    it('should be case-sensitive', () => {
      expect(getCommandRole('CHAT')).toBeUndefined()
      expect(getCommandRole('Chat')).toBeUndefined()
      expect(getCommandRole('chat')).toBe('llm')
    })
  })

  describe('CommandRole type coverage', () => {
    it('should have all roles represented in mappings', () => {
      const roles: CommandRole[] = ['llm', 'search', 'transform', 'control', 'utility']
      const mappedRoles = new Set(Object.values(QUERY_TYPE_ROLES))

      roles.forEach(role => {
        expect(mappedRoles.has(role)).toBe(true)
      })
    })

    it('should only contain valid CommandRole values', () => {
      const validRoles = new Set(['llm', 'search', 'transform', 'control', 'utility'])

      Object.values(QUERY_TYPE_ROLES).forEach(role => {
        expect(validRoles.has(role)).toBe(true)
      })
    })
  })

  describe('mapping completeness', () => {
    it('should have at least one query type for each role', () => {
      const roleOccurrences = {
        llm: 0,
        search: 0,
        transform: 0,
        control: 0,
        utility: 0,
      }

      Object.values(QUERY_TYPE_ROLES).forEach(role => {
        roleOccurrences[role]++
      })

      Object.entries(roleOccurrences).forEach(([, count]) => {
        expect(count).toBeGreaterThan(0)
      })
    })

    it('should have both backend and frontend formats for common commands', () => {
      const commonCommands = [
        { backend: 'web', frontend: '/web' },
        { backend: 'scholar', frontend: '/scholar' },
        { backend: 'refine', frontend: '/refine' },
        { backend: 'foreach', frontend: '/foreach' },
      ]

      commonCommands.forEach(({ backend, frontend }) => {
        expect(QUERY_TYPE_ROLES[backend]).toBeDefined()
        expect(QUERY_TYPE_ROLES[frontend]).toBeDefined()
        expect(QUERY_TYPE_ROLES[backend]).toBe(QUERY_TYPE_ROLES[frontend])
      })
    })
  })

  describe('edge cases', () => {
    it('should handle whitespace in query type', () => {
      expect(getCommandRole(' chat ')).toBeUndefined()
      expect(getCommandRole('chat ')).toBeUndefined()
      expect(getCommandRole(' chat')).toBeUndefined()
    })

    it('should handle special characters', () => {
      expect(getCommandRole('chat!')).toBeUndefined()
      expect(getCommandRole('chat?')).toBeUndefined()
      expect(getCommandRole('/instruct/')).toBeUndefined()
    })

    it('should handle numbers', () => {
      expect(getCommandRole('123')).toBeUndefined()
      expect(getCommandRole('chat123')).toBeUndefined()
    })

    it('should return same result for repeated calls', () => {
      const result1 = getCommandRole('chat')
      const result2 = getCommandRole('chat')
      const result3 = getCommandRole('chat')

      expect(result1).toBe(result2)
      expect(result2).toBe(result3)
    })
  })

  describe('integration scenarios', () => {
    it('should support workflow execution flow', () => {
      const workflowCommands = ['chat', 'web', 'summarize', 'foreach', 'memorize']

      workflowCommands.forEach(cmd => {
        const role = getCommandRole(cmd)
        expect(role).toBeDefined()
      })
    })

    it('should support tree node rendering', () => {
      const treeNodeCommands = ['/instruct', '/reason', '/web', '/scholar', '/refine', '/foreach']

      treeNodeCommands.forEach(cmd => {
        const role = getCommandRole(cmd)
        expect(role).toBeDefined()
      })
    })

    it('should handle mixed backend and frontend formats', () => {
      expect(getCommandRole('chat')).toBe('llm')
      expect(getCommandRole('/instruct')).toBe('llm')
      expect(getCommandRole('web')).toBe('search')
      expect(getCommandRole('/web')).toBe('search')
    })
  })
})
