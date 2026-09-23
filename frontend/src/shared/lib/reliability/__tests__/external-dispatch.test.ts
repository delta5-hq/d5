import { describe, it, expect } from 'vitest'
import { isExternalDispatchShape, MCP_PREFIX, RPC_PREFIX } from '../external-dispatch'

// Mirror of backend reliability/core/externalDispatch.test.js. Pins the same shape decision on the
// frontend so the two stacks agree that an /elect or /refine term is an external dispatch — refused
// by its /mcp:/rpc: prefix alone — rather than criterion text, before any alias is resolved.
describe('isExternalDispatchShape — external dispatch recognised by /mcp: or /rpc: prefix alone', () => {
  it.each<[string | undefined, boolean]>([
    ['/mcp:jira create issue', true],
    ['/rpc:worker run', true],
    ['  /mcp:atlassian search  ', true],
    ['mcp:jira create issue', true],
    ['/chat write a haiku', false],
    ['/summarize condense', false],
    ['must cite sources', false],
    // Boundary: the prefix requires the colon — the bare /mcp fusion form and near-miss tokens are
    // not shape-external.
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
})

describe('external-dispatch prefixes — pinned contents the backend queryTypeResolver must match', () => {
  it('MCP_PREFIX and RPC_PREFIX equal the backend literals', () => {
    expect([MCP_PREFIX, RPC_PREFIX]).toEqual(['mcp:', 'rpc:'])
  })
})
