import {MCP_FUSION_QUERY_TYPE} from '../../constants/mcpFusion'

export const isSideEffectingDispatch = ({queryType, mcpAlias, rpcAlias}) =>
  Boolean(mcpAlias) || Boolean(rpcAlias) || queryType === MCP_FUSION_QUERY_TYPE
