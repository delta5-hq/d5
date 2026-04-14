import type { PresetDefinition } from './types'

interface MCPFormFlat {
  alias: string
  transport: 'stdio' | 'streamable-http' | 'sse'
  toolName: string
  toolInputField: string
  description?: string
  timeoutMs?: number
  command?: string
  args?: string
  serverUrl?: string
}

export const MCP_PRESETS: PresetDefinition<MCPFormFlat>[] = [
  {
    id: 'claude-code-oneshot',
    label: 'Claude Code (one-shot)',
    icon: '🤖',
    fill: setValue => {
      setValue('alias', '/code')
      setValue('description', 'Claude Code one-shot coding agent')
      setValue('transport', 'stdio')
      setValue('command', 'npx')
      setValue('args', '-y @steipete/claude-code-mcp@latest')
      setValue('toolName', 'claude_code')
      setValue('toolInputField', 'prompt')
      setValue('timeoutMs', 600000)
    },
  },
  {
    id: 'claude-code-multi',
    label: 'Claude Code (multi-tool)',
    icon: '🧠',
    fill: setValue => {
      setValue('alias', '/agent')
      setValue('description', 'Claude Code multi-tool agent with full MCP capabilities')
      setValue('transport', 'stdio')
      setValue('command', 'claude')
      setValue('args', 'mcp serve')
      setValue('toolName', 'auto')
      setValue('toolInputField', 'prompt')
      setValue('timeoutMs', 600000)
    },
  },
  {
    id: 'qa-testing-mcp',
    label: 'QA Testing (MCP)',
    icon: '🧪',
    fill: setValue => {
      setValue('alias', '/qa')
      setValue('description', 'Playwright-powered QA testing with browser automation')
      setValue('transport', 'stdio')
      setValue('command', 'npx')
      setValue('args', '@playwright/mcp@latest')
      setValue('toolName', 'auto')
      setValue('toolInputField', 'prompt')
      setValue('timeoutMs', 300000)
    },
  },
  {
    id: 'research-rag-mcp',
    label: 'Research & RAG',
    icon: '🔬',
    fill: setValue => {
      setValue('alias', '/research')
      setValue('description', 'Deep research with web and academic paper search')
      setValue('transport', 'stdio')
      setValue('command', 'babel-node')
      setValue('args', '--presets @babel/preset-env src/mcp-servers/research-rag/server.js')
      setValue('toolName', 'auto')
      setValue('toolInputField', 'prompt')
      setValue('timeoutMs', 300000)
    },
  },
  {
    id: 'scraper-mcp',
    label: 'Web Scraper',
    icon: '🕷️',
    fill: setValue => {
      setValue('alias', '/scrape')
      setValue('description', 'Web page scraper with content extraction')
      setValue('transport', 'stdio')
      setValue('command', 'babel-node')
      setValue('args', '--presets @babel/preset-env src/mcp-servers/scraper/server.js')
      setValue('toolName', 'scrape_web_pages')
      setValue('toolInputField', 'urls')
      setValue('timeoutMs', 180000)
    },
  },
  {
    id: 'outliner-mcp',
    label: 'Outliner',
    icon: '📋',
    fill: setValue => {
      setValue('alias', '/mkoutline')
      setValue('description', 'Generate structured outlines from topics')
      setValue('transport', 'stdio')
      setValue('command', 'babel-node')
      setValue('args', '--presets @babel/preset-env src/mcp-servers/outliner/server.js')
      setValue('toolName', 'generate_outline')
      setValue('toolInputField', 'query')
      setValue('timeoutMs', 300000)
    },
  },
]
