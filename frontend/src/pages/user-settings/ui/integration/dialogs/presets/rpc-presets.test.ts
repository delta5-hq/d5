import { describe, it, expect, vi } from 'vitest'
import type { UseFormSetValue } from 'react-hook-form'
import { RPC_PRESETS } from './rpc-presets'
import { D5_BACKEND_ROOT, D5_BACKEND_PATHS } from './d5-backend-paths'

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

const fillAll = () =>
  RPC_PRESETS.map(preset => {
    const setValue = vi.fn()
    preset.fill(setValue as unknown as UseFormSetValue<RPCFormFlat>)
    return { preset, setValue }
  })

const getField = (setValue: ReturnType<typeof vi.fn>, field: string) =>
  setValue.mock.calls.find((call: unknown[]) => call[0] === field)?.[1]

describe('RPC_PRESETS', () => {
  describe('collection structure', () => {
    it('count matches expected (breaking-change sentinel)', () => {
      expect(RPC_PRESETS).toHaveLength(8)
    })

    it('ids are unique across all presets', () => {
      const ids = RPC_PRESETS.map(p => p.id)
      expect(new Set(ids).size).toBe(ids.length)
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
    const fillPreset = (id: string) => {
      const preset = RPC_PRESETS.find(p => p.id === id)!
      const setValue = vi.fn()
      preset.fill(setValue as unknown as UseFormSetValue<RPCFormFlat>)
      return setValue.mock.calls
    }

    it('claude-cli-ssh: SSH execution via claude binary', () => {
      expect(fillPreset('claude-cli-ssh')).toEqual([
        ['protocol', 'ssh'],
        ['commandTemplate', 'claude -p "{{prompt}}" --output-format json --dangerously-skip-permissions'],
        ['outputFormat', 'json'],
        ['outputField', 'output'],
        ['sessionIdField', 'session_id'],
      ])
    })

    it('playwright-ssh: SSH execution via npx playwright', () => {
      expect(fillPreset('playwright-ssh')).toEqual([
        ['protocol', 'ssh'],
        ['commandTemplate', 'cd /workspace && npx playwright test {{prompt}} --reporter=json'],
        ['outputFormat', 'json'],
        ['outputField', 'suites'],
        ['sessionIdField', 'session_id'],
      ])
    })

    it('ide-http: HTTP POST to local IDE endpoint', () => {
      expect(fillPreset('ide-http')).toEqual([
        ['protocol', 'http'],
        ['url', 'http://localhost:8080/api/v1/execute'],
        ['method', 'POST'],
        ['bodyTemplate', '{"command":"{{prompt}}"}'],
        ['outputFormat', 'json'],
        ['outputField', 'result'],
      ])
    })

    it('ide-acp: ACP local agent with auto-approve', () => {
      expect(fillPreset('ide-acp')).toEqual([
        ['protocol', 'acp-local'],
        ['command', 'npx'],
        ['args', '-y @agentclientprotocol/claude-agent-acp'],
        ['workingDir', '/workspace'],
        ['autoApprove', 'all'],
      ])
    })

    it('qa-testing-acp: ACP local agent without auto-approve', () => {
      expect(fillPreset('qa-testing-acp')).toEqual([
        ['protocol', 'acp-local'],
        ['command', 'npx'],
        ['args', 'playwright test'],
        ['workingDir', '/workspace'],
        ['autoApprove', 'none'],
      ])
    })

    it('qa-playwright-ssh: SSH execution with explicit timeout and description', () => {
      expect(fillPreset('qa-playwright-ssh')).toEqual([
        ['protocol', 'ssh'],
        ['commandTemplate', 'cd /workspace && npx playwright test {{prompt}} --reporter=json'],
        ['outputFormat', 'json'],
        ['outputField', 'output'],
        ['description', 'Run Playwright tests via SSH'],
        ['timeoutMs', 300000],
      ])
    })

    it('outliner-ssh: SSH execution via d5 CLI invoker to outliner MCP server', () => {
      expect(fillPreset('outliner-ssh')).toEqual([
        ['protocol', 'ssh'],
        [
          'commandTemplate',
          `cd ${D5_BACKEND_ROOT} && node ${D5_BACKEND_PATHS.mcpCli} ${D5_BACKEND_PATHS.mcpOutliner} generate_outline --query="{{prompt}}"`,
        ],
        ['outputFormat', 'text'],
      ])
    })

    it('scraper-ssh: SSH execution via d5 CLI invoker to scraper MCP server', () => {
      expect(fillPreset('scraper-ssh')).toEqual([
        ['protocol', 'ssh'],
        [
          'commandTemplate',
          `cd ${D5_BACKEND_ROOT} && node ${D5_BACKEND_PATHS.mcpCli} ${D5_BACKEND_PATHS.mcpScraper} scrape_web_pages --urls="{{prompt}}"`,
        ],
        ['outputFormat', 'text'],
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
        setValue.mock.calls.forEach((call: unknown[]) => {
          if (typeof call[1] === 'string') {
            expect(call[1].length).toBeGreaterThan(0)
            expect(call[1].trim()).toBe(call[1])
          }
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
