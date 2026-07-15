import {buildInternalMCPServerUri} from '../mcp/internalMCPServerCatalog'
import {EXT_QUERY_TYPE} from '../../constants/ext'
import {MEMORIZE_QUERY_TYPE} from '../../constants/memorize'
import {OUTLINE_QUERY_TYPE} from '../../constants/outline'
import {SCHOLAR_QUERY_TYPE} from '../../constants/scholar'
import {WEB_QUERY_TYPE} from '../../constants/web'

const RESEARCH_RAG_URI = buildInternalMCPServerUri('research-rag')
const OUTLINER_URI = buildInternalMCPServerUri('outliner')

const stdioAlias = (alias, serverUri, toolName, toolInputField) =>
  Object.freeze({alias, command: 'node', args: [serverUri], transport: 'stdio', toolName, toolInputField})

const ALIAS_MAP = new Map([
  [WEB_QUERY_TYPE, stdioAlias('/web', RESEARCH_RAG_URI, 'web_search_qa', 'query')],
  [SCHOLAR_QUERY_TYPE, stdioAlias('/scholar', RESEARCH_RAG_URI, 'scholar_search_qa', 'query')],
  [EXT_QUERY_TYPE, stdioAlias('/ext', RESEARCH_RAG_URI, 'kb_query', 'query')],
  [OUTLINE_QUERY_TYPE, stdioAlias('/outline', OUTLINER_URI, 'generate_outline', 'query')],
  [MEMORIZE_QUERY_TYPE, stdioAlias('/memorize', RESEARCH_RAG_URI, 'memorize_content', 'text')],
])

export const INTERNAL_RESEARCH_QUERY_TYPES = new Set(ALIAS_MAP.keys())
export const getResearchAlias = queryType => ALIAS_MAP.get(queryType) ?? null
