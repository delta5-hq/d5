import debug from 'debug'
import {MCPCommand} from '../MCPCommand'
import {NodeTextExtractor} from '../utils/NodeTextExtractor'
import {buildInternalServerEnv, resolveInternalServerScript} from '../mcp/internalServerEnv'
import {getIntegrationSettings} from '../utils/langchain/getLLM'
import {runWithErrorNode} from '../shared/runWithErrorNode'
import {getNodeCommand} from '../utils/isCommand'
import {readExtContextParam, DEFAULT_CONTEXT_NAME} from '../../constants/ext'
import {readMaxChunksParam} from '../../constants'
import {
  MEMORIZE_QUERY_TYPE,
  MEMORIZE_PARAM_KEEP_REGEX,
  readRechunkParam,
  readSplitParam,
} from '../../constants/memorize'
import {FOREACH_QUERY_TYPE} from '../../constants/foreach'
import {getResearchAlias} from './InternalResearchAliasMap'

const log = debug('delta5:app:Command:internalResearch:MemorizeDispatcher')

const SIZE_MAP = {xxl: Infinity, xl: 20000, l: 10000, m: 5000, s: 2000, xs: 1000, xxs: 500}
const resolveTextSize = maxChunks => SIZE_MAP[maxChunks?.toLowerCase()] ?? 5000

const isSpecialNode = ({title = ''}) => title.startsWith(FOREACH_QUERY_TYPE) || title.startsWith(MEMORIZE_QUERY_TYPE)

const parseParams = command => {
  const context = readExtContextParam(command) || DEFAULT_CONTEXT_NAME
  const rechunk = readRechunkParam(command)
  const maxChunks = readMaxChunksParam(command)
  const split = readSplitParam(command)

  let keep = false
  const keepMatch = command?.match(new RegExp(MEMORIZE_PARAM_KEEP_REGEX))
  if (keepMatch) {
    keep = keepMatch[2] === 'true'
  } else if (context === DEFAULT_CONTEXT_NAME) {
    keep = true
  }

  return {context, rechunk, maxChunks, keep, split}
}

const extractText = async (store, parentNode, params) => {
  const textSize = resolveTextSize(params.maxChunks)
  const extractor = new NodeTextExtractor(textSize, isSpecialNode, store, params.split)
  return extractor.extractFullContent(parentNode)
}

export const dispatchMemorize = async (cell, store, signal) => {
  const logError = log.extend('ERROR*', '::')
  await runWithErrorNode(store, cell, logError, async () => {
    const nodeCommand = getNodeCommand(cell)
    const params = parseParams(nodeCommand)

    const parentNode = store.getNode(cell.parent)
    if (!parentNode) throw new Error('/memorize requires a parent node containing content to store')

    const text = await extractText(store, parentNode, params)
    if (!text?.trim()) throw new Error('No content to memorize')

    const baseAlias = getResearchAlias(MEMORIZE_QUERY_TYPE)
    const aliasConfig = {
      ...baseAlias,
      toolStaticArgs: {
        context: params.context,
        keep: params.keep,
        ...(params.split && {split: params.split}),
      },
    }

    const mcpCommand = new MCPCommand(store._userId, store._workflowId, store, aliasConfig)
    const settings = await getIntegrationSettings(store._userId, store._workflowId, store)
    const extraEnv = buildInternalServerEnv(store._userId, store._workflowId, settings)
    const [serverUri, ...restArgs] = aliasConfig.args
    const normalizedArgs = [resolveInternalServerScript(serverUri), ...restArgs]

    const result = await mcpCommand.runDirectMode(text, signal, extraEnv, normalizedArgs)
    if (result.isError) throw new Error(result.content || 'MCP tool returned an error')

    store.importer.createNodes(result.content || '(empty MCP response)', cell.id)
  })
}
