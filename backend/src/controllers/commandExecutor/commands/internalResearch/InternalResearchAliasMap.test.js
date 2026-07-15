import {INTERNAL_RESEARCH_QUERY_TYPES, getResearchAlias} from './InternalResearchAliasMap'
import {WEB_QUERY_TYPE} from '../../constants/web'
import {SCHOLAR_QUERY_TYPE} from '../../constants/scholar'
import {EXT_QUERY_TYPE} from '../../constants/ext'
import {OUTLINE_QUERY_TYPE} from '../../constants/outline'
import {MEMORIZE_QUERY_TYPE} from '../../constants/memorize'

const ALL_RESEARCH_TYPES = [WEB_QUERY_TYPE, SCHOLAR_QUERY_TYPE, EXT_QUERY_TYPE, OUTLINE_QUERY_TYPE, MEMORIZE_QUERY_TYPE]

describe('InternalResearchAliasMap', () => {
  describe('INTERNAL_RESEARCH_QUERY_TYPES', () => {
    it('contains all five research query types', () => {
      expect(INTERNAL_RESEARCH_QUERY_TYPES.size).toBe(5)
      for (const type of ALL_RESEARCH_TYPES) {
        expect(INTERNAL_RESEARCH_QUERY_TYPES.has(type)).toBe(true)
      }
    })

    it('does not contain any non-research types', () => {
      expect(INTERNAL_RESEARCH_QUERY_TYPES.has('chat')).toBe(false)
      expect(INTERNAL_RESEARCH_QUERY_TYPES.has('summarize')).toBe(false)
      expect(INTERNAL_RESEARCH_QUERY_TYPES.has('unknown')).toBe(false)
      expect(INTERNAL_RESEARCH_QUERY_TYPES.has('')).toBe(false)
    })
  })

  describe('getResearchAlias', () => {
    it('returns null for an unknown query type', () => {
      expect(getResearchAlias('unknown')).toBeNull()
      expect(getResearchAlias('')).toBeNull()
      expect(getResearchAlias(undefined)).toBeNull()
    })

    it.each([
      [WEB_QUERY_TYPE, 'web_search_qa', 'query', 'research-rag'],
      [SCHOLAR_QUERY_TYPE, 'scholar_search_qa', 'query', 'research-rag'],
      [EXT_QUERY_TYPE, 'kb_query', 'query', 'research-rag'],
      [OUTLINE_QUERY_TYPE, 'generate_outline', 'query', 'outliner'],
      [MEMORIZE_QUERY_TYPE, 'memorize_content', 'text', 'research-rag'],
    ])('returns correct alias config for %s', (queryType, toolName, toolInputField, serverId) => {
      const alias = getResearchAlias(queryType)

      expect(alias).not.toBeNull()
      expect(alias.toolName).toBe(toolName)
      expect(alias.toolInputField).toBe(toolInputField)
      expect(alias.args[0]).toContain(serverId)
    })

    it('every alias uses stdio transport', () => {
      for (const type of ALL_RESEARCH_TYPES) {
        expect(getResearchAlias(type).transport).toBe('stdio')
      }
    })

    it('every alias command is node', () => {
      for (const type of ALL_RESEARCH_TYPES) {
        expect(getResearchAlias(type).command).toBe('node')
      }
    })
  })

  describe('alias immutability', () => {
    it('alias objects are frozen and cannot be mutated', () => {
      const alias = getResearchAlias(WEB_QUERY_TYPE)

      expect(Object.isFrozen(alias)).toBe(true)
    })

    it('returns the same frozen object on repeated calls', () => {
      const alias1 = getResearchAlias(SCHOLAR_QUERY_TYPE)
      const alias2 = getResearchAlias(SCHOLAR_QUERY_TYPE)

      expect(alias1).toBe(alias2)
    })

    it('mutation attempt does not change alias properties', () => {
      const alias = getResearchAlias(EXT_QUERY_TYPE)
      const originalToolName = alias.toolName

      try {
        alias.toolName = 'mutated'
      } catch {
        // strict mode throws — non-strict mode silently ignores
      }

      expect(alias.toolName).toBe(originalToolName)
    })
  })

  describe('server grouping', () => {
    const researchRagTypes = [WEB_QUERY_TYPE, SCHOLAR_QUERY_TYPE, EXT_QUERY_TYPE, MEMORIZE_QUERY_TYPE]
    const outlinerTypes = [OUTLINE_QUERY_TYPE]

    it('web, scholar, ext, memorize share the same research-rag server URI', () => {
      const uris = researchRagTypes.map(t => getResearchAlias(t).args[0])
      const unique = new Set(uris)

      expect(unique.size).toBe(1)
      expect(uris[0]).toContain('research-rag')
    })

    it('download is handled by DownloadDispatcher and is absent from the alias map', () => {
      const {DOWNLOAD_QUERY_TYPE: DL} = require('../../constants/download')
      expect(INTERNAL_RESEARCH_QUERY_TYPES.has(DL)).toBe(false)
      expect(getResearchAlias(DL)).toBeNull()
    })

    it('outline uses a distinct outliner server URI', () => {
      const outlinerUri = getResearchAlias(outlinerTypes[0]).args[0]
      const ragUri = getResearchAlias(WEB_QUERY_TYPE).args[0]

      expect(outlinerUri).toContain('outliner')
      expect(outlinerUri).not.toBe(ragUri)
    })
  })
})
