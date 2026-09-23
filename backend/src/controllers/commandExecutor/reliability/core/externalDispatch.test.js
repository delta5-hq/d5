import {MCP_FUSION_QUERY_TYPE} from '../../constants/mcpFusion'
import {isExternalDispatch, isExternalDispatchShape} from './externalDispatch'
import {MCP_PREFIX, RPC_PREFIX} from '../../commands/utils/queryTypeResolver'

describe('isExternalDispatch', () => {
  it.each([
    ['MCP alias', {queryType: 'mcp:tool', mcpAlias: {alias: '/tool'}}, true],
    ['RPC alias', {queryType: 'rpc:ssh', rpcAlias: {alias: '/ssh'}}, true],
    ['MCP fusion command', {queryType: MCP_FUSION_QUERY_TYPE}, true],
    ['native chat command', {queryType: 'chat'}, false],
    ['unknown command without external alias', {queryType: 'unknown'}, false],
    ['empty dispatch', {}, false],
  ])('%s => %s', (_, dispatch, expected) => {
    expect(isExternalDispatch(dispatch)).toBe(expected)
  })

  it('classifies purely on dispatch kind — a read-only alias is external just like a mutating one', () => {
    expect(isExternalDispatch({queryType: 'mcp:atlassian', mcpAlias: {alias: '/atlassian'}})).toBe(true)
    expect(isExternalDispatch({queryType: 'mcp:jira', mcpAlias: {alias: '/jira'}})).toBe(true)
  })
})

describe('isExternalDispatchShape — recognises an external dispatch by its /mcp: or /rpc: prefix alone', () => {
  it.each([
    ['/mcp:jira create issue', true],
    ['/rpc:worker run', true],
    ['  /mcp:atlassian search  ', true],
    ['mcp:jira create issue', true],
    ['/chat write a haiku', false],
    ['/summarize condense', false],
    ['must cite sources', false],
    // Boundary: the prefix requires the colon — the bare /mcp fusion form and near-miss tokens are
    // not shape-external; the fusion form is classified by query type, not by this predicate.
    ['/mcp create issue', false],
    ['/mcpx run', false],
    ['/rpc', false],
    // Boundary: an external prefix only counts at the start of the command, never as a substring.
    ['/chat about mcp: protocols', false],
    ['', false],
    [undefined, false],
  ])('%s => %s', (command, expected) => {
    expect(isExternalDispatchShape(command)).toBe(expected)
  })

  it('does not depend on a configured alias — the shape is enough', () => {
    // The alias-based predicate sees nothing without a resolved alias; the shape predicate still refuses.
    expect(isExternalDispatch({queryType: undefined})).toBe(false)
    expect(isExternalDispatchShape('/mcp:jira create issue')).toBe(true)
  })
})

describe('external-dispatch prefixes — pinned contents the frontend mirror must match', () => {
  it('MCP_PREFIX and RPC_PREFIX equal the shared literals', () => {
    expect([MCP_PREFIX, RPC_PREFIX]).toEqual(['mcp:', 'rpc:'])
  })
})
