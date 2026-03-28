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
      setValue('transport', 'stdio')
      setValue('command', 'npx')
      setValue('args', '@playwright/mcp@latest')
      setValue('toolName', 'auto')
      setValue('toolInputField', 'prompt')
      setValue('timeoutMs', 300000)
    },
  },
]
