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

type RPCPreset = PresetDefinition<RPCFormFlat>

const d5CliCommandTemplate = (binary: string) =>
  `command -v ${binary} >/dev/null 2>&1 && ${binary} "{{prompt}}" || { echo "${binary} executable not found on SSH target"; exit 127; }`

const fillD5CliSshPreset = (setValue: Parameters<RPCPreset['fill']>[0], binary: string, description: string) => {
  setValue('protocol', 'ssh')
  setValue('commandTemplate', d5CliCommandTemplate(binary))
  setValue('outputFormat', 'text')
  setValue('description', description)
  setValue('timeoutMs', 300000)
}

export const RPC_PRESETS: RPCPreset[] = [
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
    id: 'playwright-ssh',
    label: 'Playwright CLI (SSH)',
    icon: '🎭',
    fill: setValue => {
      setValue('protocol', 'ssh')
      setValue('commandTemplate', 'cd /workspace && npx playwright test {{prompt}} --reporter=json')
      setValue('outputFormat', 'json')
      setValue('outputField', 'suites')
      setValue('sessionIdField', 'session_id')
    },
  },
  {
    id: 'd5-scrape-ssh',
    label: 'D5 Scrape (SSH)',
    icon: '🧲',
    fill: setValue => {
      fillD5CliSshPreset(setValue, 'd5-scrape', 'Run the installed D5 scraper CLI via SSH')
    },
  },
  {
    id: 'd5-outline-ssh',
    label: 'D5 Outline (SSH)',
    icon: '🧭',
    fill: setValue => {
      fillD5CliSshPreset(setValue, 'd5-outline', 'Run the installed D5 outliner CLI via SSH')
    },
  },
  {
    id: 'd5-research-ssh',
    label: 'D5 Research (SSH)',
    icon: '🔎',
    fill: setValue => {
      fillD5CliSshPreset(setValue, 'd5-research', 'Run the installed D5 research CLI via SSH')
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
      setValue('command', 'npx')
      setValue('args', '-y @agentclientprotocol/claude-agent-acp')
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
    id: 'qa-playwright-ssh',
    label: 'QA Playwright (SSH)',
    icon: '🧪',
    fill: setValue => {
      setValue('protocol', 'ssh')
      setValue('commandTemplate', 'cd /workspace && npx playwright test {{prompt}} --reporter=json')
      setValue('outputFormat', 'json')
      setValue('outputField', 'output')
      setValue('description', 'Run Playwright tests via SSH')
      setValue('timeoutMs', 300000)
    },
  },
]
