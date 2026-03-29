import { describe, it, expect, vi } from 'vitest'
import type { UseFormSetValue } from 'react-hook-form'
import { RPC_PRESETS } from './rpc-presets'

interface RPCFormFlat {
  alias: string
  protocol: 'ssh' | 'http' | 'acp-local'
  description?: string
  commandTemplate?: string
  outputFormat?: 'text' | 'json'
  outputField?: string
  sessionIdField?: string
  url?: string
  method?: 'GET' | 'POST' | 'PUT'
  bodyTemplate?: string
  command?: string
  args?: string
  workingDir?: string
  autoApprove?: 'all' | 'none' | 'whitelist'
}

describe('RPC_PRESETS', () => {
  describe('preset collection structure', () => {
    it('maintains stable preset count (breaking change detection)', () => {
      expect(RPC_PRESETS).toHaveLength(6)
    })

    it('enforces unique preset identifiers', () => {
      const ids = RPC_PRESETS.map(p => p.id)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(ids.length)
    })

    it('requires all presets to have non-empty ids', () => {
      RPC_PRESETS.forEach(preset => {
        expect(preset.id).toBeTruthy()
        expect(preset.id.length).toBeGreaterThan(0)
      })
    })

    it('enforces kebab-case convention for preset ids', () => {
      RPC_PRESETS.forEach(preset => {
        expect(preset.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
      })
    })
  })

  describe('preset metadata requirements', () => {
    it('requires icon for each preset', () => {
      RPC_PRESETS.forEach(preset => {
        expect(preset.icon).toBeTruthy()
        expect(typeof preset.icon).toBe('string')
        expect(preset.icon.length).toBeGreaterThan(0)
      })
    })

    it('requires label for each preset', () => {
      RPC_PRESETS.forEach(preset => {
        expect(preset.label).toBeTruthy()
        expect(typeof preset.label).toBe('string')
        expect(preset.label.length).toBeGreaterThan(0)
      })
    })

    it('requires fill function for each preset', () => {
      RPC_PRESETS.forEach(preset => {
        expect(preset.fill).toBeDefined()
        expect(typeof preset.fill).toBe('function')
      })
    })

    it('ensures labels are descriptive (minimum length)', () => {
      RPC_PRESETS.forEach(preset => {
        expect(preset.label.length).toBeGreaterThanOrEqual(5)
      })
    })
  })

  describe('Claude CLI SSH preset behavior', () => {
    const getPreset = () => RPC_PRESETS.find(p => p.id === 'claude-cli-ssh')!

    it('exists in preset collection', () => {
      expect(getPreset()).toBeDefined()
    })

    it('sets protocol to SSH before other fields', () => {
      const setValue = vi.fn()
      getPreset().fill(setValue as unknown as UseFormSetValue<RPCFormFlat>)

      const firstCall = setValue.mock.calls[0] as unknown[]
      expect(firstCall).toEqual(['protocol', 'ssh'])
    })

    it('configures complete SSH integration fields', () => {
      const setValue = vi.fn()
      getPreset().fill(setValue as unknown as UseFormSetValue<RPCFormFlat>)

      expect(setValue).toHaveBeenCalledWith('protocol', 'ssh')
      expect(setValue).toHaveBeenCalledWith(
        'commandTemplate',
        'claude -p "{{prompt}}" --output-format json --dangerously-skip-permissions',
      )
      expect(setValue).toHaveBeenCalledWith('outputFormat', 'json')
      expect(setValue).toHaveBeenCalledWith('outputField', 'output')
      expect(setValue).toHaveBeenCalledWith('sessionIdField', 'session_id')
    })

    it('sets exactly 5 fields (no more, no less)', () => {
      const setValue = vi.fn()
      getPreset().fill(setValue as unknown as UseFormSetValue<RPCFormFlat>)

      expect(setValue).toHaveBeenCalledTimes(5)
    })

    it('uses JSON output format for structured data', () => {
      const setValue = vi.fn()
      getPreset().fill(setValue as unknown as UseFormSetValue<RPCFormFlat>)

      expect(setValue).toHaveBeenCalledWith('outputFormat', 'json')
    })
  })

  describe('IDE HTTP preset behavior', () => {
    const getPreset = () => RPC_PRESETS.find(p => p.id === 'ide-http')!

    it('exists in preset collection', () => {
      expect(getPreset()).toBeDefined()
    })

    it('sets protocol to HTTP before other fields', () => {
      const setValue = vi.fn()
      getPreset().fill(setValue as unknown as UseFormSetValue<RPCFormFlat>)

      const firstCall = setValue.mock.calls[0] as unknown[]
      expect(firstCall).toEqual(['protocol', 'http'])
    })

    it('configures complete HTTP integration fields', () => {
      const setValue = vi.fn()
      getPreset().fill(setValue as unknown as UseFormSetValue<RPCFormFlat>)

      expect(setValue).toHaveBeenCalledWith('protocol', 'http')
      expect(setValue).toHaveBeenCalledWith('url', 'http://localhost:8080/api/v1/execute')
      expect(setValue).toHaveBeenCalledWith('method', 'POST')
      expect(setValue).toHaveBeenCalledWith('bodyTemplate', '{"command":"{{prompt}}"}')
      expect(setValue).toHaveBeenCalledWith('outputFormat', 'json')
      expect(setValue).toHaveBeenCalledWith('outputField', 'result')
    })

    it('uses localhost URL for local development', () => {
      const setValue = vi.fn()
      getPreset().fill(setValue as unknown as UseFormSetValue<RPCFormFlat>)

      const urlCall = setValue.mock.calls.find((call: unknown[]) => call[0] === 'url')
      expect(urlCall![1]).toContain('localhost')
    })

    it('uses POST method for command execution', () => {
      const setValue = vi.fn()
      getPreset().fill(setValue as unknown as UseFormSetValue<RPCFormFlat>)

      expect(setValue).toHaveBeenCalledWith('method', 'POST')
    })

    it('provides valid JSON body template', () => {
      const setValue = vi.fn()
      getPreset().fill(setValue as unknown as UseFormSetValue<RPCFormFlat>)

      const bodyCall = setValue.mock.calls.find((call: unknown[]) => call[0] === 'bodyTemplate')
      expect(() => JSON.parse(bodyCall![1] as string)).not.toThrow()
    })
  })

  describe('IDE ACP preset behavior', () => {
    const getPreset = () => RPC_PRESETS.find(p => p.id === 'ide-acp')!

    it('exists in preset collection', () => {
      expect(getPreset()).toBeDefined()
    })

    it('sets protocol to ACP-local before other fields', () => {
      const setValue = vi.fn()
      getPreset().fill(setValue as unknown as UseFormSetValue<RPCFormFlat>)

      const firstCall = setValue.mock.calls[0] as unknown[]
      expect(firstCall).toEqual(['protocol', 'acp-local'])
    })

    it('configures complete ACP integration fields', () => {
      const setValue = vi.fn()
      getPreset().fill(setValue as unknown as UseFormSetValue<RPCFormFlat>)

      expect(setValue).toHaveBeenCalledWith('protocol', 'acp-local')
      expect(setValue).toHaveBeenCalledWith('command', 'claude')
      expect(setValue).toHaveBeenCalledWith('args', '--ide')
      expect(setValue).toHaveBeenCalledWith('workingDir', '/workspace')
      expect(setValue).toHaveBeenCalledWith('autoApprove', 'all')
    })

    it('enables auto-approve for IDE workflow', () => {
      const setValue = vi.fn()
      getPreset().fill(setValue as unknown as UseFormSetValue<RPCFormFlat>)

      expect(setValue).toHaveBeenCalledWith('autoApprove', 'all')
    })
  })

  describe('QA Testing ACP preset behavior', () => {
    const getPreset = () => RPC_PRESETS.find(p => p.id === 'qa-testing-acp')!

    it('exists in preset collection', () => {
      expect(getPreset()).toBeDefined()
    })

    it('sets protocol to ACP-local before other fields', () => {
      const setValue = vi.fn()
      getPreset().fill(setValue as unknown as UseFormSetValue<RPCFormFlat>)

      const firstCall = setValue.mock.calls[0] as unknown[]
      expect(firstCall).toEqual(['protocol', 'acp-local'])
    })

    it('configures complete QA testing fields', () => {
      const setValue = vi.fn()
      getPreset().fill(setValue as unknown as UseFormSetValue<RPCFormFlat>)

      expect(setValue).toHaveBeenCalledWith('protocol', 'acp-local')
      expect(setValue).toHaveBeenCalledWith('command', 'npx')
      expect(setValue).toHaveBeenCalledWith('args', 'playwright test')
      expect(setValue).toHaveBeenCalledWith('workingDir', '/workspace')
      expect(setValue).toHaveBeenCalledWith('autoApprove', 'none')
    })

    it('disables auto-approve for security in test execution', () => {
      const setValue = vi.fn()
      getPreset().fill(setValue as unknown as UseFormSetValue<RPCFormFlat>)

      expect(setValue).toHaveBeenCalledWith('autoApprove', 'none')
    })

    it('uses npx for package execution without installation', () => {
      const setValue = vi.fn()
      getPreset().fill(setValue as unknown as UseFormSetValue<RPCFormFlat>)

      expect(setValue).toHaveBeenCalledWith('command', 'npx')
    })
  })

  describe('protocol distribution', () => {
    it('includes at least one SSH preset', () => {
      const sshPresets = RPC_PRESETS.filter(p => {
        const setValue = vi.fn()
        p.fill(setValue as unknown as UseFormSetValue<RPCFormFlat>)
        return setValue.mock.calls.some((call: unknown[]) => call[0] === 'protocol' && call[1] === 'ssh')
      })
      expect(sshPresets.length).toBeGreaterThanOrEqual(1)
    })

    it('includes at least one HTTP preset', () => {
      const httpPresets = RPC_PRESETS.filter(p => {
        const setValue = vi.fn()
        p.fill(setValue as unknown as UseFormSetValue<RPCFormFlat>)
        return setValue.mock.calls.some((call: unknown[]) => call[0] === 'protocol' && call[1] === 'http')
      })
      expect(httpPresets.length).toBeGreaterThanOrEqual(1)
    })

    it('includes at least one ACP preset', () => {
      const acpPresets = RPC_PRESETS.filter(p => {
        const setValue = vi.fn()
        p.fill(setValue as unknown as UseFormSetValue<RPCFormFlat>)
        return setValue.mock.calls.some((call: unknown[]) => call[0] === 'protocol' && call[1] === 'acp-local')
      })
      expect(acpPresets.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('edge cases and error handling', () => {
    it('handles multiple invocations without side effects', () => {
      const preset = RPC_PRESETS[0]
      const setValue1 = vi.fn()
      const setValue2 = vi.fn()

      preset.fill(setValue1 as unknown as UseFormSetValue<RPCFormFlat>)
      preset.fill(setValue2 as unknown as UseFormSetValue<RPCFormFlat>)

      expect(setValue1).toHaveBeenCalled()
      expect(setValue2).toHaveBeenCalled()
      expect(setValue1.mock.calls).toEqual(setValue2.mock.calls)
    })

    it('does not mutate preset objects during fill', () => {
      const preset = { ...RPC_PRESETS[0] }
      const originalPreset = JSON.parse(JSON.stringify(preset))
      const setValue = vi.fn()

      preset.fill(setValue as unknown as UseFormSetValue<RPCFormFlat>)

      expect(preset.id).toBe(originalPreset.id)
      expect(preset.label).toBe(originalPreset.label)
      expect(preset.icon).toBe(originalPreset.icon)
    })

    it('all presets call setValue at least once', () => {
      RPC_PRESETS.forEach(preset => {
        const setValue = vi.fn()
        preset.fill(setValue as unknown as UseFormSetValue<RPCFormFlat>)
        expect(setValue).toHaveBeenCalled()
      })
    })

    it('all presets set protocol as first action', () => {
      RPC_PRESETS.forEach(preset => {
        const setValue = vi.fn()
        preset.fill(setValue as unknown as UseFormSetValue<RPCFormFlat>)
        const firstCall = setValue.mock.calls[0] as unknown[]
        expect(firstCall[0]).toBe('protocol')
      })
    })
  })

  describe('preset naming conventions', () => {
    it('uses consistent icon-label pattern', () => {
      RPC_PRESETS.forEach(preset => {
        expect(preset.icon).toMatch(/[\u{1F000}-\u{1F9FF}]/u)
      })
    })

    it('labels indicate protocol type', () => {
      RPC_PRESETS.forEach(preset => {
        const label = preset.label.toLowerCase()
        const hasProtocol = label.includes('ssh') || label.includes('http') || label.includes('acp')
        expect(hasProtocol).toBe(true)
      })
    })
  })

  describe('Outliner SSH preset behavior', () => {
    const getPreset = () => RPC_PRESETS.find(p => p.id === 'outliner-ssh')!

    it('exists in preset collection', () => {
      expect(getPreset()).toBeDefined()
    })

    it('sets protocol to SSH before other fields', () => {
      const setValue = vi.fn()
      getPreset().fill(setValue as unknown as UseFormSetValue<RPCFormFlat>)

      const firstCall = setValue.mock.calls[0] as unknown[]
      expect(firstCall).toEqual(['protocol', 'ssh'])
    })

    it('configures CLI command template for outliner MCP server', () => {
      const setValue = vi.fn()
      getPreset().fill(setValue as unknown as UseFormSetValue<RPCFormFlat>)

      expect(setValue).toHaveBeenCalledWith('protocol', 'ssh')
      expect(setValue).toHaveBeenCalledWith('commandTemplate', expect.stringContaining('cli.js'))
      expect(setValue).toHaveBeenCalledWith('commandTemplate', expect.stringContaining('outliner/server.js'))
      expect(setValue).toHaveBeenCalledWith('commandTemplate', expect.stringContaining('generate_outline'))
      expect(setValue).toHaveBeenCalledWith('outputFormat', 'text')
    })

    it('uses text output format for outline trees', () => {
      const setValue = vi.fn()
      getPreset().fill(setValue as unknown as UseFormSetValue<RPCFormFlat>)

      expect(setValue).toHaveBeenCalledWith('outputFormat', 'text')
    })
  })

  describe('Web Scraper SSH preset behavior', () => {
    const getPreset = () => RPC_PRESETS.find(p => p.id === 'scraper-ssh')!

    it('exists in preset collection', () => {
      expect(getPreset()).toBeDefined()
    })

    it('sets protocol to SSH before other fields', () => {
      const setValue = vi.fn()
      getPreset().fill(setValue as unknown as UseFormSetValue<RPCFormFlat>)

      const firstCall = setValue.mock.calls[0] as unknown[]
      expect(firstCall).toEqual(['protocol', 'ssh'])
    })

    it('configures CLI command template for scraper MCP server', () => {
      const setValue = vi.fn()
      getPreset().fill(setValue as unknown as UseFormSetValue<RPCFormFlat>)

      expect(setValue).toHaveBeenCalledWith('protocol', 'ssh')
      expect(setValue).toHaveBeenCalledWith('commandTemplate', expect.stringContaining('cli.js'))
      expect(setValue).toHaveBeenCalledWith('commandTemplate', expect.stringContaining('scraper/server.js'))
      expect(setValue).toHaveBeenCalledWith('commandTemplate', expect.stringContaining('scrape_web_pages'))
      expect(setValue).toHaveBeenCalledWith('outputFormat', 'text')
    })

    it('uses text output format for scraped content', () => {
      const setValue = vi.fn()
      getPreset().fill(setValue as unknown as UseFormSetValue<RPCFormFlat>)

      expect(setValue).toHaveBeenCalledWith('outputFormat', 'text')
    })
  })
})
