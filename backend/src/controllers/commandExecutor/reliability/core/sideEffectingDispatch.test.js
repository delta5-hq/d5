import {MCP_FUSION_QUERY_TYPE} from '../../constants/mcpFusion'
import {isSideEffectingDispatch} from './sideEffectingDispatch'

describe('isSideEffectingDispatch', () => {
  it.each([
    ['MCP alias', {queryType: 'mcp:tool', mcpAlias: {alias: '/tool'}}, true],
    ['RPC alias', {queryType: 'rpc:ssh', rpcAlias: {alias: '/ssh'}}, true],
    ['MCP fusion command', {queryType: MCP_FUSION_QUERY_TYPE}, true],
    ['native chat command', {queryType: 'chat'}, false],
    ['unknown command without external alias', {queryType: 'unknown'}, false],
    ['empty dispatch', {}, false],
  ])('%s => %s', (_, dispatch, expected) => {
    expect(isSideEffectingDispatch(dispatch)).toBe(expected)
  })
})
