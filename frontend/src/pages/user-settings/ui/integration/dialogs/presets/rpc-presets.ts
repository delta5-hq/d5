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

type PortableSSHCLIPreset = {
  id: string
  label: string
  icon: string
  command: string
  description: string
  timeoutMs: number
}

const applyTextSSHCommandPreset = (
  setValue: Parameters<RPCPreset['fill']>[0],
  commandTemplate: string,
  description?: string,
  timeoutMs?: number,
) => {
  setValue('protocol', 'ssh')
  setValue('commandTemplate', commandTemplate)
  setValue('outputFormat', 'text')
  if (description) setValue('description', description)
  if (timeoutMs) setValue('timeoutMs', timeoutMs)
}

const portableD5CLIPresets: PortableSSHCLIPreset[] = [
  {
    id: 'scraper-ssh',
    label: 'D5 Scraper CLI (SSH)',
    icon: '🕷️',
    command: 'd5-scrape "{{prompt}}"',
    description: 'Run a portable D5 scraper CLI installed on the SSH target',
    timeoutMs: 180000,
  },
  {
    id: 'outliner-ssh',
    label: 'D5 Outliner CLI (SSH)',
    icon: '📋',
    command: 'd5-outline "{{prompt}}"',
    description: 'Run a portable D5 outliner CLI installed on the SSH target',
    timeoutMs: 300000,
  },
  {
    id: 'research-rag-ssh',
    label: 'D5 Research CLI (SSH)',
    icon: '🔬',
    command: 'd5-research "{{prompt}}"',
    description: 'Run a portable D5 research CLI installed on the SSH target',
    timeoutMs: 300000,
  },
]

const createPortableD5CLIPreset = (preset: PortableSSHCLIPreset): RPCPreset => ({
  id: preset.id,
  label: preset.label,
  icon: preset.icon,
  fill: setValue => {
    applyTextSSHCommandPreset(setValue, preset.command, preset.description, preset.timeoutMs)
  },
})

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
  ...portableD5CLIPresets.map(createPortableD5CLIPreset),
]
