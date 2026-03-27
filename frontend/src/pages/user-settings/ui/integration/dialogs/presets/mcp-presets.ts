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
    id: 'qa-testing-mcp',
    label: 'QA Testing (MCP)',
    icon: '🧪',
    fill: setValue => {
      setValue('transport', 'stdio')
      setValue('command', 'npx')
      setValue('args', '@playwright/mcp@latest')
      setValue('toolName', 'browser_navigate')
      setValue('toolInputField', 'prompt')
    },
  },
]
