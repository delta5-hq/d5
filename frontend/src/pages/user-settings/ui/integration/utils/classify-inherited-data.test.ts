import { describe, it, expect } from 'vitest'
import { classifyInheritedData } from './classify-inherited-data'
import type { IntegrationSettings, MCPIntegration, RPCIntegration } from '@shared/base-types'

describe('classifyInheritedData', () => {
  describe('null/undefined input handling', () => {
    it('returns empty inherited when appWideScope is undefined', () => {
      const currentScope: IntegrationSettings = { openai: { apiKey: 'key', model: 'gpt-4' } }
      const result = classifyInheritedData(currentScope, undefined)

      expect(result.editable).toBe(currentScope)
      expect(result.inherited).toEqual({})
    })

    it('returns empty editable when currentScope is undefined', () => {
      const appWideScope: IntegrationSettings = { openai: { apiKey: 'key', model: 'gpt-4' } }
      const result = classifyInheritedData(undefined, appWideScope)

      expect(result.editable).toEqual({})
      expect(result.inherited).toBe(appWideScope)
    })

    it('returns empty for both when both scopes are undefined', () => {
      const result = classifyInheritedData(undefined, undefined)

      expect(result.editable).toEqual({})
      expect(result.inherited).toEqual({})
    })

    it('handles null currentScope same as undefined', () => {
      const appWideScope: IntegrationSettings = { openai: { apiKey: 'key', model: 'gpt-4' } }
      const result = classifyInheritedData(undefined, appWideScope)

      expect(result.editable).toEqual({})
      expect(result.inherited).toBe(appWideScope)
    })
  })

  describe('workflowId field detection', () => {
    it('treats as app-wide when workflowId field absent', () => {
      const currentScope: IntegrationSettings = { openai: { apiKey: 'key', model: 'gpt-4' } }
      const appWideScope: IntegrationSettings = { claude: { apiKey: 'key2', model: 'claude-3' } }
      const result = classifyInheritedData(currentScope, appWideScope)

      expect(result.editable).toBe(currentScope)
      expect(result.inherited).toEqual({})
    })

    it('treats as app-wide when workflowId is null', () => {
      const currentScope: IntegrationSettings = { workflowId: null as any, openai: { apiKey: 'key', model: 'gpt-4' } }
      const appWideScope: IntegrationSettings = { claude: { apiKey: 'key2', model: 'claude-3' } }
      const result = classifyInheritedData(currentScope, appWideScope)

      expect(result.editable).toBe(currentScope)
      expect(result.inherited).toEqual({})
    })

    it('treats as workflow-scoped when workflowId field present with value', () => {
      const currentScope: IntegrationSettings = { workflowId: 'wf-123', openai: { apiKey: 'key', model: 'gpt-4' } }
      const appWideScope: IntegrationSettings = { claude: { apiKey: 'key2', model: 'claude-3' } }
      const result = classifyInheritedData(currentScope, appWideScope)

      expect(result.editable).toBe(currentScope)
      expect(result.inherited).toEqual({ mcp: [], rpc: [], claude: appWideScope.claude })
    })

    it('detects workflowId field even when empty string', () => {
      const currentScope: IntegrationSettings = { workflowId: '', openai: { apiKey: 'key', model: 'gpt-4' } }
      const appWideScope: IntegrationSettings = { claude: { apiKey: 'key2', model: 'claude-3' } }
      const result = classifyInheritedData(currentScope, appWideScope)

      expect(result.editable).toBe(currentScope)
      expect(result.inherited).toEqual({ mcp: [], rpc: [], claude: appWideScope.claude })
    })
  })

  describe('LLM provider inheritance', () => {
    it('inherits LLM provider when not present in workflow scope', () => {
      const currentScope: IntegrationSettings = { workflowId: 'wf-123', openai: { apiKey: 'key', model: 'gpt-4' } }
      const appWideScope: IntegrationSettings = { claude: { apiKey: 'key2', model: 'claude-3' } }
      const result = classifyInheritedData(currentScope, appWideScope)

      expect(result.inherited.claude).toEqual(appWideScope.claude)
      expect(result.inherited.openai).toBeUndefined()
    })

    it('does not inherit LLM provider when overridden in workflow scope', () => {
      const currentScope: IntegrationSettings = {
        workflowId: 'wf-123',
        openai: { apiKey: 'workflow-key', model: 'gpt-4' },
      }
      const appWideScope: IntegrationSettings = { openai: { apiKey: 'app-key', model: 'gpt-3.5' } }
      const result = classifyInheritedData(currentScope, appWideScope)

      expect(result.inherited.openai).toBeUndefined()
      expect(result.editable.openai).toEqual(currentScope.openai)
    })

    it('inherits all supported LLM providers when none in workflow', () => {
      const currentScope: IntegrationSettings = { workflowId: 'wf-123' }
      const appWideScope: IntegrationSettings = {
        openai: { apiKey: 'key1', model: 'gpt-4' },
        claude: { apiKey: 'key2', model: 'claude-3' },
        yandex: { apiKey: 'key3', folder_id: 'folder', model: 'yandex' },
        qwen: { apiKey: 'key4', model: 'qwen' },
        deepseek: { apiKey: 'key5', model: 'deepseek' },
        perplexity: { apiKey: 'key6', model: 'perplexity' },
        custom_llm: { apiRootUrl: 'url', maxTokens: 100, apiType: 'openai', embeddingsChunkSize: 500 },
        google: { drive: true },
      }
      const result = classifyInheritedData(currentScope, appWideScope)

      expect(result.inherited.openai).toEqual(appWideScope.openai)
      expect(result.inherited.claude).toEqual(appWideScope.claude)
      expect(result.inherited.yandex).toEqual(appWideScope.yandex)
      expect(result.inherited.qwen).toEqual(appWideScope.qwen)
      expect(result.inherited.deepseek).toEqual(appWideScope.deepseek)
      expect(result.inherited.perplexity).toEqual(appWideScope.perplexity)
      expect(result.inherited.custom_llm).toEqual(appWideScope.custom_llm)
      expect(result.inherited.google).toEqual(appWideScope.google)
    })

    it('handles partial LLM provider inheritance', () => {
      const currentScope: IntegrationSettings = {
        workflowId: 'wf-123',
        openai: { apiKey: 'workflow', model: 'gpt-4' },
        qwen: { apiKey: 'workflow', model: 'qwen' },
      }
      const appWideScope: IntegrationSettings = {
        openai: { apiKey: 'app', model: 'gpt-3.5' },
        claude: { apiKey: 'app', model: 'claude-3' },
        qwen: { apiKey: 'app', model: 'qwen-old' },
      }
      const result = classifyInheritedData(currentScope, appWideScope)

      expect(result.inherited.openai).toBeUndefined()
      expect(result.inherited.qwen).toBeUndefined()
      expect(result.inherited.claude).toEqual(appWideScope.claude)
    })
  })

  describe('MCP array inheritance', () => {
    it('inherits MCP items with aliases not in workflow', () => {
      const workflowMCP: MCPIntegration[] = [{ alias: '/qa', transport: 'stdio', toolName: 'test' }]
      const appWideMCP: MCPIntegration[] = [
        { alias: '/qa', transport: 'sse', toolName: 'qa-old' },
        { alias: '/research', transport: 'stdio', toolName: 'research' },
      ]
      const currentScope: IntegrationSettings = { workflowId: 'wf-123', mcp: workflowMCP }
      const appWideScope: IntegrationSettings = { mcp: appWideMCP }
      const result = classifyInheritedData(currentScope, appWideScope)

      expect(result.inherited.mcp).toEqual([{ alias: '/research', transport: 'stdio', toolName: 'research' }])
    })

    it('returns empty MCP array when all app-wide MCPs overridden', () => {
      const workflowMCP: MCPIntegration[] = [
        { alias: '/qa', transport: 'stdio', toolName: 'test' },
        { alias: '/research', transport: 'stdio', toolName: 'test' },
      ]
      const appWideMCP: MCPIntegration[] = [
        { alias: '/qa', transport: 'sse', toolName: 'qa-old' },
        { alias: '/research', transport: 'stdio', toolName: 'research-old' },
      ]
      const currentScope: IntegrationSettings = { workflowId: 'wf-123', mcp: workflowMCP }
      const appWideScope: IntegrationSettings = { mcp: appWideMCP }
      const result = classifyInheritedData(currentScope, appWideScope)

      expect(result.inherited.mcp).toEqual([])
    })

    it('handles empty workflow MCP array', () => {
      const appWideMCP: MCPIntegration[] = [{ alias: '/research', transport: 'stdio', toolName: 'research' }]
      const currentScope: IntegrationSettings = { workflowId: 'wf-123', mcp: [] }
      const appWideScope: IntegrationSettings = { mcp: appWideMCP }
      const result = classifyInheritedData(currentScope, appWideScope)

      expect(result.inherited.mcp).toEqual(appWideMCP)
    })

    it('handles undefined workflow MCP array', () => {
      const appWideMCP: MCPIntegration[] = [{ alias: '/research', transport: 'stdio', toolName: 'research' }]
      const currentScope: IntegrationSettings = { workflowId: 'wf-123' }
      const appWideScope: IntegrationSettings = { mcp: appWideMCP }
      const result = classifyInheritedData(currentScope, appWideScope)

      expect(result.inherited.mcp).toEqual(appWideMCP)
    })

    it('handles undefined app-wide MCP array', () => {
      const workflowMCP: MCPIntegration[] = [{ alias: '/qa', transport: 'stdio', toolName: 'test' }]
      const currentScope: IntegrationSettings = { workflowId: 'wf-123', mcp: workflowMCP }
      const appWideScope: IntegrationSettings = {}
      const result = classifyInheritedData(currentScope, appWideScope)

      expect(result.inherited.mcp).toEqual([])
    })
  })

  describe('RPC array inheritance', () => {
    it('inherits RPC items with aliases not in workflow', () => {
      const workflowRPC: RPCIntegration[] = [{ alias: '/deploy', protocol: 'ssh', host: 'localhost' }]
      const appWideRPC: RPCIntegration[] = [
        { alias: '/deploy', protocol: 'http', url: 'http://old' },
        { alias: '/test', protocol: 'ssh', host: 'test-server' },
      ]
      const currentScope: IntegrationSettings = { workflowId: 'wf-123', rpc: workflowRPC }
      const appWideScope: IntegrationSettings = { rpc: appWideRPC }
      const result = classifyInheritedData(currentScope, appWideScope)

      expect(result.inherited.rpc).toEqual([{ alias: '/test', protocol: 'ssh', host: 'test-server' }])
    })

    it('returns empty RPC array when all app-wide RPCs overridden', () => {
      const workflowRPC: RPCIntegration[] = [{ alias: '/deploy', protocol: 'ssh', host: 'localhost' }]
      const appWideRPC: RPCIntegration[] = [{ alias: '/deploy', protocol: 'http', url: 'http://old' }]
      const currentScope: IntegrationSettings = { workflowId: 'wf-123', rpc: workflowRPC }
      const appWideScope: IntegrationSettings = { rpc: appWideRPC }
      const result = classifyInheritedData(currentScope, appWideScope)

      expect(result.inherited.rpc).toEqual([])
    })

    it('handles empty workflow RPC array', () => {
      const appWideRPC: RPCIntegration[] = [{ alias: '/test', protocol: 'ssh', host: 'test-server' }]
      const currentScope: IntegrationSettings = { workflowId: 'wf-123', rpc: [] }
      const appWideScope: IntegrationSettings = { rpc: appWideRPC }
      const result = classifyInheritedData(currentScope, appWideScope)

      expect(result.inherited.rpc).toEqual(appWideRPC)
    })

    it('handles undefined workflow RPC array', () => {
      const appWideRPC: RPCIntegration[] = [{ alias: '/test', protocol: 'ssh', host: 'test-server' }]
      const currentScope: IntegrationSettings = { workflowId: 'wf-123' }
      const appWideScope: IntegrationSettings = { rpc: appWideRPC }
      const result = classifyInheritedData(currentScope, appWideScope)

      expect(result.inherited.rpc).toEqual(appWideRPC)
    })

    it('handles undefined app-wide RPC array', () => {
      const workflowRPC: RPCIntegration[] = [{ alias: '/deploy', protocol: 'ssh', host: 'localhost' }]
      const currentScope: IntegrationSettings = { workflowId: 'wf-123', rpc: workflowRPC }
      const appWideScope: IntegrationSettings = {}
      const result = classifyInheritedData(currentScope, appWideScope)

      expect(result.inherited.rpc).toEqual([])
    })
  })

  describe('cross-type alias shadowing', () => {
    it('hides app-wide MCP when workflow has RPC with same alias', () => {
      const workflowRPC: RPCIntegration[] = [{ alias: '/qa', protocol: 'ssh', host: 'localhost' }]
      const appWideMCP: MCPIntegration[] = [{ alias: '/qa', transport: 'stdio', toolName: 'qa-mcp' }]
      const currentScope: IntegrationSettings = { workflowId: 'wf-123', rpc: workflowRPC }
      const appWideScope: IntegrationSettings = { mcp: appWideMCP }
      const result = classifyInheritedData(currentScope, appWideScope)

      expect(result.inherited.mcp).toEqual([])
    })

    it('hides app-wide RPC when workflow has MCP with same alias', () => {
      const workflowMCP: MCPIntegration[] = [{ alias: '/qa', transport: 'stdio', toolName: 'qa-mcp' }]
      const appWideRPC: RPCIntegration[] = [{ alias: '/qa', protocol: 'ssh', host: 'localhost' }]
      const currentScope: IntegrationSettings = { workflowId: 'wf-123', mcp: workflowMCP }
      const appWideScope: IntegrationSettings = { rpc: appWideRPC }
      const result = classifyInheritedData(currentScope, appWideScope)

      expect(result.inherited.rpc).toEqual([])
    })

    it('handles multiple cross-type shadows correctly', () => {
      const workflowMCP: MCPIntegration[] = [{ alias: '/qa', transport: 'stdio', toolName: 'qa' }]
      const workflowRPC: RPCIntegration[] = [{ alias: '/deploy', protocol: 'ssh', host: 'localhost' }]
      const appWideMCP: MCPIntegration[] = [
        { alias: '/qa', transport: 'sse', toolName: 'qa-old' },
        { alias: '/research', transport: 'stdio', toolName: 'research' },
      ]
      const appWideRPC: RPCIntegration[] = [
        { alias: '/deploy', protocol: 'http', url: 'http://old' },
        { alias: '/test', protocol: 'ssh', host: 'test' },
      ]
      const currentScope: IntegrationSettings = { workflowId: 'wf-123', mcp: workflowMCP, rpc: workflowRPC }
      const appWideScope: IntegrationSettings = { mcp: appWideMCP, rpc: appWideRPC }
      const result = classifyInheritedData(currentScope, appWideScope)

      expect(result.inherited.mcp).toEqual([{ alias: '/research', transport: 'stdio', toolName: 'research' }])
      expect(result.inherited.rpc).toEqual([{ alias: '/test', protocol: 'ssh', host: 'test' }])
    })

    it('applies cross-type shadow even when arrays are mixed', () => {
      const workflowMCP: MCPIntegration[] = [{ alias: '/common', transport: 'stdio', toolName: 'mcp' }]
      const appWideRPC: RPCIntegration[] = [{ alias: '/common', protocol: 'ssh', host: 'localhost' }]
      const currentScope: IntegrationSettings = { workflowId: 'wf-123', mcp: workflowMCP }
      const appWideScope: IntegrationSettings = { rpc: appWideRPC }
      const result = classifyInheritedData(currentScope, appWideScope)

      expect(result.inherited.rpc).toEqual([])
      expect(result.inherited.mcp).toEqual([])
    })
  })

  describe('edge cases and complex scenarios', () => {
    it('handles large numbers of integrations efficiently', () => {
      const largeMCP: MCPIntegration[] = Array.from({ length: 100 }, (_, i) => ({
        alias: `/mcp${i}`,
        transport: 'stdio' as const,
        toolName: `tool${i}`,
      }))
      const largeRPC: RPCIntegration[] = Array.from({ length: 100 }, (_, i) => ({
        alias: `/rpc${i}`,
        protocol: 'ssh' as const,
        host: `host${i}`,
      }))
      const workflowMCP = largeMCP.slice(0, 50)
      const currentScope: IntegrationSettings = { workflowId: 'wf-123', mcp: workflowMCP }
      const appWideScope: IntegrationSettings = { mcp: largeMCP, rpc: largeRPC }
      const result = classifyInheritedData(currentScope, appWideScope)

      expect(result.inherited.mcp).toHaveLength(50)
      expect(result.inherited.rpc).toEqual(largeRPC)
    })

    it('preserves exact object references for editable data', () => {
      const currentScope: IntegrationSettings = { workflowId: 'wf-123', openai: { apiKey: 'key', model: 'gpt-4' } }
      const appWideScope: IntegrationSettings = {}
      const result = classifyInheritedData(currentScope, appWideScope)

      expect(result.editable).toBe(currentScope)
    })

    it('handles workflow with all integration types populated', () => {
      const currentScope: IntegrationSettings = {
        workflowId: 'wf-123',
        openai: { apiKey: 'key', model: 'gpt-4' },
        mcp: [{ alias: '/mcp1', transport: 'stdio', toolName: 'tool' }],
        rpc: [{ alias: '/rpc1', protocol: 'ssh', host: 'localhost' }],
      }
      const appWideScope: IntegrationSettings = {
        claude: { apiKey: 'key2', model: 'claude-3' },
        mcp: [{ alias: '/mcp2', transport: 'sse', toolName: 'tool2' }],
        rpc: [{ alias: '/rpc2', protocol: 'http', url: 'http://test' }],
      }
      const result = classifyInheritedData(currentScope, appWideScope)

      expect(result.editable).toBe(currentScope)
      expect(result.inherited.claude).toEqual(appWideScope.claude)
      expect(result.inherited.mcp).toEqual([{ alias: '/mcp2', transport: 'sse', toolName: 'tool2' }])
      expect(result.inherited.rpc).toEqual([{ alias: '/rpc2', protocol: 'http', url: 'http://test' }])
    })

    it('handles special characters in aliases correctly', () => {
      const workflowMCP: MCPIntegration[] = [{ alias: '/test-alias_123', transport: 'stdio', toolName: 'tool' }]
      const appWideMCP: MCPIntegration[] = [
        { alias: '/test-alias_123', transport: 'sse', toolName: 'old' },
        { alias: '/other@alias#', transport: 'stdio', toolName: 'other' },
      ]
      const currentScope: IntegrationSettings = { workflowId: 'wf-123', mcp: workflowMCP }
      const appWideScope: IntegrationSettings = { mcp: appWideMCP }
      const result = classifyInheritedData(currentScope, appWideScope)

      expect(result.inherited.mcp).toEqual([{ alias: '/other@alias#', transport: 'stdio', toolName: 'other' }])
    })

    it('maintains array order from app-wide scope', () => {
      const appWideMCP: MCPIntegration[] = [
        { alias: '/z', transport: 'stdio', toolName: 'z' },
        { alias: '/a', transport: 'stdio', toolName: 'a' },
        { alias: '/m', transport: 'stdio', toolName: 'm' },
      ]
      const currentScope: IntegrationSettings = { workflowId: 'wf-123', mcp: [] }
      const appWideScope: IntegrationSettings = { mcp: appWideMCP }
      const result = classifyInheritedData(currentScope, appWideScope)

      expect(result.inherited.mcp![0].alias).toBe('/z')
      expect(result.inherited.mcp![1].alias).toBe('/a')
      expect(result.inherited.mcp![2].alias).toBe('/m')
    })

    it('handles empty strings as valid workflowId', () => {
      const currentScope: IntegrationSettings = { workflowId: '', openai: { apiKey: 'key', model: 'gpt-4' } }
      const appWideScope: IntegrationSettings = { claude: { apiKey: 'key2', model: 'claude-3' } }
      const result = classifyInheritedData(currentScope, appWideScope)

      expect(result.editable).toBe(currentScope)
      expect(result.inherited.claude).toEqual(appWideScope.claude)
    })
  })

  describe('immutability guarantees', () => {
    it('does not mutate currentScope input', () => {
      const currentScope: IntegrationSettings = {
        workflowId: 'wf-123',
        mcp: [{ alias: '/qa', transport: 'stdio', toolName: 'test' }],
      }
      const appWideScope: IntegrationSettings = {
        mcp: [{ alias: '/research', transport: 'stdio', toolName: 'research' }],
      }
      const originalMCP = currentScope.mcp

      classifyInheritedData(currentScope, appWideScope)

      expect(currentScope.mcp).toBe(originalMCP)
    })

    it('does not mutate appWideScope input', () => {
      const currentScope: IntegrationSettings = {
        workflowId: 'wf-123',
        mcp: [{ alias: '/qa', transport: 'stdio', toolName: 'test' }],
      }
      const appWideScope: IntegrationSettings = {
        mcp: [{ alias: '/research', transport: 'stdio', toolName: 'research' }],
      }
      const originalMCP = appWideScope.mcp

      classifyInheritedData(currentScope, appWideScope)

      expect(appWideScope.mcp).toBe(originalMCP)
    })
  })
})
