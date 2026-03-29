import type { PresetDefinition } from './types'

interface RPCFormFlat {
  alias: string
  protocol: 'ssh' | 'http' | 'acp-local'
  description?: string
  timeoutMs?: number
  outputFormat?: 'text' | 'json'
  outputField?: string
  sessionIdField?: string
  host?: string
  port?: number
  username?: string
  privateKey?: string
  passphrase?: string
  commandTemplate?: string
  workingDir?: string
  url?: string
  method?: 'GET' | 'POST' | 'PUT'
  headers?: string
  bodyTemplate?: string
  command?: string
  args?: string
  env?: string
  autoApprove?: 'all' | 'none' | 'whitelist'
  allowedTools?: string
}

export const RPC_PRESETS: PresetDefinition<RPCFormFlat>[] = [
  {
    id: 'claude-cli-ssh',
    label: 'Claude CLI (SSH)',
    icon: '🤖',
    fill: setValue => {
      setValue('protocol', 'ssh')
      setValue('commandTemplate', 'claude -p "{{prompt}}" --output-format json --dangerously-skip-permissions')
      setValue('outputFormat', 'json')
      setValue('outputField', 'output')
      setValue('sessionIdField', 'session_id')
    },
  },
  {
    id: 'ide-http',
    label: 'IDE (HTTP)',
    icon: '🖥️',
    fill: setValue => {
      setValue('protocol', 'http')
      setValue('url', 'http://localhost:8080/api/v1/execute')
      setValue('method', 'POST')
      setValue('bodyTemplate', '{"command":"{{prompt}}"}')
      setValue('outputFormat', 'json')
      setValue('outputField', 'result')
    },
  },
  {
    id: 'ide-acp',
    label: 'IDE (ACP)',
    icon: '🖥️',
    fill: setValue => {
      setValue('protocol', 'acp-local')
      setValue('command', 'claude')
      setValue('args', '--ide')
      setValue('workingDir', '/workspace')
      setValue('autoApprove', 'all')
    },
  },
  {
    id: 'qa-testing-acp',
    label: 'QA Testing (ACP)',
    icon: '🧪',
    fill: setValue => {
      setValue('protocol', 'acp-local')
      setValue('command', 'npx')
      setValue('args', 'playwright test')
      setValue('workingDir', '/workspace')
      setValue('autoApprove', 'none')
    },
  },
  {
    id: 'outliner-ssh',
    label: 'Outliner (SSH)',
    icon: '📝',
    fill: setValue => {
      setValue('protocol', 'ssh')
      setValue(
        'commandTemplate',
        'cd /path/to/backend && npx babel-node src/mcp-servers/cli.js src/mcp-servers/outliner/server.js generate_outline --query="{{prompt}}"',
      )
      setValue('outputFormat', 'text')
    },
  },
  {
    id: 'scraper-ssh',
    label: 'Web Scraper (SSH)',
    icon: '🌐',
    fill: setValue => {
      setValue('protocol', 'ssh')
      setValue(
        'commandTemplate',
        'cd /path/to/backend && npx babel-node src/mcp-servers/cli.js src/mcp-servers/scraper/server.js scrape_web_pages --urls="{{prompt}}"',
      )
      setValue('outputFormat', 'text')
    },
  },
]
