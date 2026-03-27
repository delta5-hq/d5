import { describe, it, expect, vi } from 'vitest'
import type { UseFormSetValue } from 'react-hook-form'
import { MCP_PRESETS } from './mcp-presets'

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

describe('MCP_PRESETS', () => {
  describe('preset collection structure', () => {
    it('maintains stable preset count (breaking change detection)', () => {
      expect(MCP_PRESETS).toHaveLength(1)
    })

    it('enforces unique preset identifiers', () => {
      const ids = MCP_PRESETS.map(p => p.id)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(ids.length)
    })

    it('requires all presets to have non-empty ids', () => {
      MCP_PRESETS.forEach(preset => {
        expect(preset.id).toBeTruthy()
        expect(preset.id.length).toBeGreaterThan(0)
      })
    })

    it('enforces kebab-case convention for preset ids', () => {
      MCP_PRESETS.forEach(preset => {
        expect(preset.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
      })
    })
  })

  describe('preset metadata requirements', () => {
    it('requires icon for each preset', () => {
      MCP_PRESETS.forEach(preset => {
        expect(preset.icon).toBeTruthy()
        expect(typeof preset.icon).toBe('string')
        expect(preset.icon.length).toBeGreaterThan(0)
      })
    })

    it('requires label for each preset', () => {
      MCP_PRESETS.forEach(preset => {
        expect(preset.label).toBeTruthy()
        expect(typeof preset.label).toBe('string')
        expect(preset.label.length).toBeGreaterThan(0)
      })
    })

    it('requires fill function for each preset', () => {
      MCP_PRESETS.forEach(preset => {
        expect(preset.fill).toBeDefined()
        expect(typeof preset.fill).toBe('function')
      })
    })

    it('ensures labels are descriptive (minimum length)', () => {
      MCP_PRESETS.forEach(preset => {
        expect(preset.label.length).toBeGreaterThanOrEqual(5)
      })
    })
  })

  describe('QA Testing MCP preset behavior', () => {
    const getPreset = () => MCP_PRESETS.find(p => p.id === 'qa-testing-mcp')!

    it('exists in preset collection', () => {
      expect(getPreset()).toBeDefined()
    })

    it('sets transport to stdio before other fields', () => {
      const setValue = vi.fn()
      getPreset().fill(setValue as unknown as UseFormSetValue<MCPFormFlat>)

      const firstCall = setValue.mock.calls[0] as unknown[]
      expect(firstCall).toEqual(['transport', 'stdio'])
    })

    it('configures complete MCP stdio integration fields', () => {
      const setValue = vi.fn()
      getPreset().fill(setValue as unknown as UseFormSetValue<MCPFormFlat>)

      expect(setValue).toHaveBeenCalledWith('transport', 'stdio')
      expect(setValue).toHaveBeenCalledWith('command', 'npx')
      expect(setValue).toHaveBeenCalledWith('args', '@playwright/mcp@latest')
      expect(setValue).toHaveBeenCalledWith('toolName', 'browser_navigate')
      expect(setValue).toHaveBeenCalledWith('toolInputField', 'prompt')
    })

    it('sets exactly 5 fields (no more, no less)', () => {
      const setValue = vi.fn()
      getPreset().fill(setValue as unknown as UseFormSetValue<MCPFormFlat>)

      expect(setValue).toHaveBeenCalledTimes(5)
    })

    it('uses npx for package execution without installation', () => {
      const setValue = vi.fn()
      getPreset().fill(setValue as unknown as UseFormSetValue<MCPFormFlat>)

      expect(setValue).toHaveBeenCalledWith('command', 'npx')
    })

    it('uses @latest version tag for up-to-date package', () => {
      const setValue = vi.fn()
      getPreset().fill(setValue as unknown as UseFormSetValue<MCPFormFlat>)

      const argsCall = setValue.mock.calls.find((call: unknown[]) => call[0] === 'args')
      expect(argsCall![1]).toContain('@latest')
    })

    it('configures browser navigation tool', () => {
      const setValue = vi.fn()
      getPreset().fill(setValue as unknown as UseFormSetValue<MCPFormFlat>)

      expect(setValue).toHaveBeenCalledWith('toolName', 'browser_navigate')
    })

    it('uses prompt as default tool input field', () => {
      const setValue = vi.fn()
      getPreset().fill(setValue as unknown as UseFormSetValue<MCPFormFlat>)

      expect(setValue).toHaveBeenCalledWith('toolInputField', 'prompt')
    })
  })

  describe('transport distribution', () => {
    it('includes at least one stdio preset', () => {
      const stdioPresets = MCP_PRESETS.filter(p => {
        const setValue = vi.fn()
        p.fill(setValue as unknown as UseFormSetValue<MCPFormFlat>)
        return setValue.mock.calls.some((call: unknown[]) => call[0] === 'transport' && call[1] === 'stdio')
      })
      expect(stdioPresets.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('edge cases and error handling', () => {
    it('handles multiple invocations without side effects', () => {
      const preset = MCP_PRESETS[0]
      const setValue1 = vi.fn()
      const setValue2 = vi.fn()

      preset.fill(setValue1 as unknown as UseFormSetValue<MCPFormFlat>)
      preset.fill(setValue2 as unknown as UseFormSetValue<MCPFormFlat>)

      expect(setValue1).toHaveBeenCalled()
      expect(setValue2).toHaveBeenCalled()
      expect(setValue1.mock.calls).toEqual(setValue2.mock.calls)
    })

    it('does not mutate preset objects during fill', () => {
      const preset = { ...MCP_PRESETS[0] }
      const originalPreset = JSON.parse(JSON.stringify(preset))
      const setValue = vi.fn()

      preset.fill(setValue as unknown as UseFormSetValue<MCPFormFlat>)

      expect(preset.id).toBe(originalPreset.id)
      expect(preset.label).toBe(originalPreset.label)
      expect(preset.icon).toBe(originalPreset.icon)
    })

    it('all presets call setValue at least once', () => {
      MCP_PRESETS.forEach(preset => {
        const setValue = vi.fn()
        preset.fill(setValue as unknown as UseFormSetValue<MCPFormFlat>)
        expect(setValue).toHaveBeenCalled()
      })
    })

    it('all presets set transport as first action', () => {
      MCP_PRESETS.forEach(preset => {
        const setValue = vi.fn()
        preset.fill(setValue as unknown as UseFormSetValue<MCPFormFlat>)
        const firstCall = setValue.mock.calls[0] as unknown[]
        expect(firstCall[0]).toBe('transport')
      })
    })
  })

  describe('preset naming conventions', () => {
    it('uses consistent icon-label pattern', () => {
      MCP_PRESETS.forEach(preset => {
        expect(preset.icon).toMatch(/[\u{1F000}-\u{1F9FF}]/u)
      })
    })

    it('labels indicate MCP integration type', () => {
      MCP_PRESETS.forEach(preset => {
        const label = preset.label.toLowerCase()
        expect(label).toContain('mcp')
      })
    })
  })

  describe('MCP-specific field requirements', () => {
    it('all presets configure toolName field', () => {
      MCP_PRESETS.forEach(preset => {
        const setValue = vi.fn()
        preset.fill(setValue as unknown as UseFormSetValue<MCPFormFlat>)
        const toolNameCall = setValue.mock.calls.find((call: unknown[]) => call[0] === 'toolName')
        expect(toolNameCall).toBeDefined()
        expect(toolNameCall![1]).toBeTruthy()
      })
    })

    it('all presets configure toolInputField', () => {
      MCP_PRESETS.forEach(preset => {
        const setValue = vi.fn()
        preset.fill(setValue as unknown as UseFormSetValue<MCPFormFlat>)
        const toolInputCall = setValue.mock.calls.find((call: unknown[]) => call[0] === 'toolInputField')
        expect(toolInputCall).toBeDefined()
        expect(toolInputCall![1]).toBeTruthy()
      })
    })
  })
})
