import { describe, it, expect, vi } from 'vitest'
import type { UseFormSetValue } from 'react-hook-form'
import { RPC_PRESETS } from './rpc-presets'

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

const fillPreset = (preset: (typeof RPC_PRESETS)[number]) => {
  const setValue = vi.fn()
  preset.fill(setValue as unknown as UseFormSetValue<RPCFormFlat>)
  return { preset, setValue }
}

const fillAll = () => RPC_PRESETS.map(fillPreset)

const getField = (setValue: ReturnType<typeof vi.fn>, field: string) =>
  setValue.mock.calls.find((call: unknown[]) => call[0] === field)?.[1]

const getFieldEntries = (setValue: ReturnType<typeof vi.fn>) =>
  setValue.mock.calls.map((call: unknown[]) => ({ field: String(call[0]), value: call[1] }))

const getStringFieldEntries = (setValue: ReturnType<typeof vi.fn>) =>
  getFieldEntries(setValue).filter(
    (entry): entry is { field: string; value: string } => typeof entry.value === 'string',
  )

const backendOwnedRuntimeTokens = ['D5_BACKEND_ROOT', 'mcp-servers/cli.js', '/app', 'backend/build', '../backend']

const portableD5CLISSHContracts = [
  {
    id: 'scraper-ssh',
    commandTemplate: 'd5-scrape "{{prompt}}"',
    description: 'Run a portable D5 scraper CLI installed on the SSH target',
    timeoutMs: 180000,
  },
  {
    id: 'outliner-ssh',
    commandTemplate: 'd5-outline "{{prompt}}"',
    description: 'Run a portable D5 outliner CLI installed on the SSH target',
    timeoutMs: 300000,
  },
  {
    id: 'research-rag-ssh',
    commandTemplate: 'd5-research "{{prompt}}"',
    description: 'Run a portable D5 research CLI installed on the SSH target',
    timeoutMs: 300000,
  },
] as const

const portableD5CLISSHIds = portableD5CLISSHContracts.map(contract => contract.id)

describe('RPC_PRESETS', () => {
  describe('collection structure', () => {
    it('count matches expected (breaking-change sentinel)', () => {
      expect(RPC_PRESETS).toHaveLength(6 + portableD5CLISSHContracts.length)
    })

    it('ids are unique across all presets', () => {
      const ids = RPC_PRESETS.map(p => p.id)
      expect(new Set(ids).size).toBe(ids.length)
    })

    it('includes portable D5 CLI SSH replacement presets', () => {
      const ids = RPC_PRESETS.map(p => p.id)
      expect(ids).toEqual(expect.arrayContaining([...portableD5CLISSHIds]))
    })

    it('ids are non-empty', () => {
      RPC_PRESETS.forEach(preset => {
        expect(preset.id.length).toBeGreaterThan(0)
      })
    })

    it('ids follow kebab-case convention', () => {
      RPC_PRESETS.forEach(preset => {
        expect(preset.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
      })
    })

    it('icons are emoji characters', () => {
      RPC_PRESETS.forEach(preset => {
        expect(preset.icon).toMatch(/[\u{1F000}-\u{1F9FF}]/u)
      })
    })

    it('labels are descriptive (minimum 5 characters)', () => {
      RPC_PRESETS.forEach(preset => {
        expect(preset.label.length).toBeGreaterThanOrEqual(5)
      })
    })

    it('each preset exposes a fill function', () => {
      RPC_PRESETS.forEach(preset => {
        expect(typeof preset.fill).toBe('function')
      })
    })

    it('labels are unique across all presets', () => {
      const labels = RPC_PRESETS.map(p => p.label)
      expect(new Set(labels).size).toBe(labels.length)
    })

    it('labels indicate the protocol type', () => {
      RPC_PRESETS.forEach(preset => {
        const label = preset.label.toLowerCase()
        const hasProtocol = label.includes('ssh') || label.includes('http') || label.includes('acp')
        expect(hasProtocol).toBe(true)
      })
    })
  })

  describe('per-preset field snapshots', () => {
    const fillPresetCalls = (id: string) => {
      const preset = RPC_PRESETS.find(p => p.id === id)!
      return fillPreset(preset).setValue.mock.calls
    }

    it('claude-cli-ssh: SSH execution via claude binary', () => {
      expect(fillPresetCalls('claude-cli-ssh')).toEqual([
        ['protocol', 'ssh'],
        ['commandTemplate', 'claude -p "{{prompt}}" --output-format json --dangerously-skip-permissions'],
        ['outputFormat', 'json'],
        ['outputField', 'output'],
        ['sessionIdField', 'session_id'],
      ])
    })

    it('playwright-ssh: SSH execution via npx playwright', () => {
      expect(fillPresetCalls('playwright-ssh')).toEqual([
        ['protocol', 'ssh'],
        ['commandTemplate', 'cd /workspace && npx playwright test {{prompt}} --reporter=json'],
        ['outputFormat', 'json'],
        ['outputField', 'suites'],
        ['sessionIdField', 'session_id'],
      ])
    })

    it('ide-http: HTTP POST to local IDE endpoint', () => {
      expect(fillPresetCalls('ide-http')).toEqual([
        ['protocol', 'http'],
        ['url', 'http://localhost:8080/api/v1/execute'],
        ['method', 'POST'],
        ['bodyTemplate', '{"command":"{{prompt}}"}'],
        ['outputFormat', 'json'],
        ['outputField', 'result'],
      ])
    })

    it('ide-acp: ACP local agent with auto-approve', () => {
      expect(fillPresetCalls('ide-acp')).toEqual([
        ['protocol', 'acp-local'],
        ['command', 'npx'],
        ['args', '-y @agentclientprotocol/claude-agent-acp'],
        ['workingDir', '/workspace'],
        ['autoApprove', 'all'],
      ])
    })

    it('qa-testing-acp: ACP local agent without auto-approve', () => {
      expect(fillPresetCalls('qa-testing-acp')).toEqual([
        ['protocol', 'acp-local'],
        ['command', 'npx'],
        ['args', 'playwright test'],
        ['workingDir', '/workspace'],
        ['autoApprove', 'none'],
      ])
    })

    it('qa-playwright-ssh: SSH execution with explicit timeout and description', () => {
      expect(fillPresetCalls('qa-playwright-ssh')).toEqual([
        ['protocol', 'ssh'],
        ['commandTemplate', 'cd /workspace && npx playwright test {{prompt}} --reporter=json'],
        ['outputFormat', 'json'],
        ['outputField', 'output'],
        ['description', 'Run Playwright tests via SSH'],
        ['timeoutMs', 300000],
      ])
    })

    it.each(portableD5CLISSHContracts)('$id: portable D5 CLI over SSH', contract => {
      expect(fillPresetCalls(contract.id)).toEqual([
        ['protocol', 'ssh'],
        ['commandTemplate', contract.commandTemplate],
        ['outputFormat', 'text'],
        ['description', contract.description],
        ['timeoutMs', contract.timeoutMs],
      ])
    })
  })

  describe('fill behavior', () => {
    it('protocol is always set as the first field', () => {
      fillAll().forEach(({ setValue }) => {
        expect((setValue.mock.calls[0] as unknown[])[0]).toBe('protocol')
      })
    })

    it('consecutive fills produce identical call sequences (idempotency)', () => {
      RPC_PRESETS.forEach(preset => {
        const first = vi.fn()
        const second = vi.fn()
        preset.fill(first as unknown as UseFormSetValue<RPCFormFlat>)
        preset.fill(second as unknown as UseFormSetValue<RPCFormFlat>)
        expect(first.mock.calls).toEqual(second.mock.calls)
      })
    })

    it('fill does not mutate the preset definition', () => {
      RPC_PRESETS.forEach(preset => {
        const { id, label, icon } = preset
        preset.fill(vi.fn() as unknown as UseFormSetValue<RPCFormFlat>)
        expect(preset.id).toBe(id)
        expect(preset.label).toBe(label)
        expect(preset.icon).toBe(icon)
      })
    })

    it('string field values are non-empty and trimmed', () => {
      fillAll().forEach(({ setValue }) => {
        getStringFieldEntries(setValue).forEach(({ value }) => {
          expect(value.length).toBeGreaterThan(0)
          expect(value.trim()).toBe(value)
        })
      })
    })

    it('does not generate RPC fields coupled to backend-owned runtime filesystems', () => {
      fillAll().forEach(({ preset, setValue }) => {
        getStringFieldEntries(setValue).forEach(({ field, value }) => {
          backendOwnedRuntimeTokens.forEach(token => {
            expect(value, `${preset.id}.${field} must not include ${token}`).not.toContain(token)
          })
        })
      })
    })

    it('args values do not contain shell metacharacters', () => {
      fillAll().forEach(({ setValue }) => {
        const args = getField(setValue, 'args')
        if (args) {
          expect(args).not.toMatch(/[;&|`$()]/)
        }
      })
    })

    it('protocol values are constrained to the allowed enum', () => {
      const allowed = new Set(['ssh', 'http', 'acp-local'])
      fillAll().forEach(({ setValue }) => {
        expect(allowed.has(getField(setValue, 'protocol'))).toBe(true)
      })
    })
  })

  describe('protocol distribution', () => {
    it('collection includes at least one SSH preset', () => {
      const count = fillAll().filter(({ setValue }) => getField(setValue, 'protocol') === 'ssh').length
      expect(count).toBeGreaterThanOrEqual(1)
    })

    it('collection includes at least one HTTP preset', () => {
      const count = fillAll().filter(({ setValue }) => getField(setValue, 'protocol') === 'http').length
      expect(count).toBeGreaterThanOrEqual(1)
    })

    it('collection includes at least one ACP preset', () => {
      const count = fillAll().filter(({ setValue }) => getField(setValue, 'protocol') === 'acp-local').length
      expect(count).toBeGreaterThanOrEqual(1)
    })
  })

  describe('ssh commandTemplate requirements', () => {
    it('all SSH presets include the {{prompt}} placeholder in their commandTemplate', () => {
      fillAll()
        .filter(({ setValue }) => getField(setValue, 'protocol') === 'ssh')
        .forEach(({ setValue }) => {
          expect(getField(setValue, 'commandTemplate')).toContain('{{prompt}}')
        })
    })

    it('SSH presets remain executable commands rather than D5 source-tree launchers', () => {
      fillAll()
        .filter(({ setValue }) => getField(setValue, 'protocol') === 'ssh')
        .forEach(({ setValue }) => {
          const commandTemplate = getField(setValue, 'commandTemplate')
          expect(commandTemplate).toEqual(expect.any(String))
          expect(commandTemplate).not.toMatch(/D5_BACKEND_ROOT|mcp-servers\/cli\.js/)
        })
    })

    it('portable D5 CLI SSH presets invoke installed CLI commands without remote source-tree assumptions', () => {
      portableD5CLISSHContracts.forEach(contract => {
        const preset = RPC_PRESETS.find(candidate => candidate.id === contract.id)
        expect(preset, `${contract.id} preset must exist`).toBeTruthy()

        const { setValue } = fillPreset(preset!)
        const commandTemplate = getField(setValue, 'commandTemplate') as string

        expect(commandTemplate).toBe(contract.commandTemplate)
        expect(commandTemplate).toContain('{{prompt}}')
        expect(commandTemplate).not.toMatch(/\b(cd|node|npm|npx)\b|[./~]/)
        backendOwnedRuntimeTokens.forEach(token => {
          expect(commandTemplate).not.toContain(token)
        })
      })
    })
  })

  describe('http preset requirements', () => {
    it('HTTP presets target localhost for local development', () => {
      fillAll()
        .filter(({ setValue }) => getField(setValue, 'protocol') === 'http')
        .forEach(({ setValue }) => {
          expect(getField(setValue, 'url')).toContain('localhost')
        })
    })

    it('HTTP body templates are structurally valid JSON', () => {
      fillAll()
        .filter(({ setValue }) => getField(setValue, 'protocol') === 'http')
        .forEach(({ setValue }) => {
          const bodyTemplate = getField(setValue, 'bodyTemplate')
          if (bodyTemplate) {
            expect(() => JSON.parse(bodyTemplate as string)).not.toThrow()
          }
        })
    })
  })

  describe('acp preset requirements', () => {
    it('all ACP presets configure workingDir', () => {
      fillAll()
        .filter(({ setValue }) => getField(setValue, 'protocol') === 'acp-local')
        .forEach(({ setValue }) => {
          expect(getField(setValue, 'workingDir')).toBeTruthy()
        })
    })
  })

  describe('field value enum constraints', () => {
    it('outputFormat values are constrained to text or json', () => {
      const allowed = new Set(['text', 'json'])
      fillAll().forEach(({ setValue }) => {
        const outputFormat = getField(setValue, 'outputFormat')
        if (outputFormat !== undefined) {
          expect(allowed.has(outputFormat)).toBe(true)
        }
      })
    })

    it('autoApprove values are constrained to all, none, or whitelist', () => {
      const allowed = new Set(['all', 'none', 'whitelist'])
      fillAll().forEach(({ setValue }) => {
        const autoApprove = getField(setValue, 'autoApprove')
        if (autoApprove !== undefined) {
          expect(allowed.has(autoApprove)).toBe(true)
        }
      })
    })
  })
})
