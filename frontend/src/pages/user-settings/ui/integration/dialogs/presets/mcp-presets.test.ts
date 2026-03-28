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

const fillPreset = (id: string) => {
  const preset = MCP_PRESETS.find(p => p.id === id)!
  const setValue = vi.fn()
  preset.fill(setValue as unknown as UseFormSetValue<MCPFormFlat>)
  return setValue
}

const fillAll = () =>
  MCP_PRESETS.map(preset => {
    const setValue = vi.fn()
    preset.fill(setValue as unknown as UseFormSetValue<MCPFormFlat>)
    return { preset, setValue }
  })

const getField = (setValue: ReturnType<typeof vi.fn>, field: string) =>
  setValue.mock.calls.find((call: unknown[]) => call[0] === field)?.[1]

describe('MCP_PRESETS', () => {
  describe('preset collection structure', () => {
    it('maintains stable preset count (breaking change detection)', () => {
      expect(MCP_PRESETS).toHaveLength(3)
    })

    it('enforces unique preset identifiers', () => {
      const ids = MCP_PRESETS.map(p => p.id)
      expect(new Set(ids).size).toBe(ids.length)
    })

    it('enforces kebab-case convention for preset ids', () => {
      MCP_PRESETS.forEach(preset => {
        expect(preset.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
      })
    })
  })

  describe('preset metadata requirements', () => {
    it('requires non-empty icon, descriptive label, and fill function', () => {
      MCP_PRESETS.forEach(preset => {
        expect(preset.icon).toMatch(/[\u{1F000}-\u{1F9FF}]/u)
        expect(preset.label.length).toBeGreaterThanOrEqual(5)
        expect(typeof preset.fill).toBe('function')
      })
    })
  })

  describe('per-preset field snapshots', () => {
    it('Claude Code one-shot: direct mode via third-party npx package', () => {
      const setValue = fillPreset('claude-code-oneshot')

      expect(setValue.mock.calls).toEqual([
        ['transport', 'stdio'],
        ['command', 'npx'],
        ['args', '-y @steipete/claude-code-mcp@latest'],
        ['toolName', 'claude_code'],
        ['toolInputField', 'prompt'],
        ['timeoutMs', 600000],
      ])
    })

    it('Claude Code multi-tool: agent mode via native claude CLI', () => {
      const setValue = fillPreset('claude-code-multi')

      expect(setValue.mock.calls).toEqual([
        ['transport', 'stdio'],
        ['command', 'claude'],
        ['args', 'mcp serve'],
        ['toolName', 'auto'],
        ['toolInputField', 'prompt'],
        ['timeoutMs', 600000],
      ])
    })

    it('QA Testing: agent mode via Playwright MCP', () => {
      const setValue = fillPreset('qa-testing-mcp')

      expect(setValue.mock.calls).toEqual([
        ['transport', 'stdio'],
        ['command', 'npx'],
        ['args', '@playwright/mcp@latest'],
        ['toolName', 'auto'],
        ['toolInputField', 'prompt'],
        ['timeoutMs', 300000],
      ])
    })
  })

  describe('cross-cutting invariants', () => {
    it('transport is always the first field set', () => {
      fillAll().forEach(({ setValue }) => {
        expect(setValue.mock.calls[0]).toEqual(expect.arrayContaining(['transport']))
      })
    })

    it('all presets configure toolName and toolInputField', () => {
      fillAll().forEach(({ setValue }) => {
        expect(getField(setValue, 'toolName')).toBeTruthy()
        expect(getField(setValue, 'toolInputField')).toBeTruthy()
      })
    })

    it('all stdio presets configure command', () => {
      fillAll().forEach(({ setValue }) => {
        if (getField(setValue, 'transport') === 'stdio') {
          expect(getField(setValue, 'command')).toBeTruthy()
        }
      })
    })

    it('all presets configure timeout as a positive number', () => {
      fillAll().forEach(({ setValue }) => {
        const timeout = getField(setValue, 'timeoutMs')
        expect(typeof timeout).toBe('number')
        expect(timeout).toBeGreaterThanOrEqual(60000)
        expect(timeout).toBeLessThanOrEqual(3600000)
      })
    })
  })

  describe('agent mode vs direct mode', () => {
    it('at least one preset uses agent mode and at least one uses direct mode', () => {
      const results = fillAll().map(({ setValue }) => getField(setValue, 'toolName'))
      expect(results).toContain('auto')
      expect(results.some(t => t !== 'auto')).toBe(true)
    })
  })

  describe('idempotency', () => {
    it('consecutive fills produce identical calls', () => {
      MCP_PRESETS.forEach(preset => {
        const first = vi.fn()
        const second = vi.fn()
        preset.fill(first as unknown as UseFormSetValue<MCPFormFlat>)
        preset.fill(second as unknown as UseFormSetValue<MCPFormFlat>)
        expect(first.mock.calls).toEqual(second.mock.calls)
      })
    })
  })

  describe('field value safety', () => {
    it('string values are non-empty and trimmed', () => {
      fillAll().forEach(({ setValue }) => {
        setValue.mock.calls.forEach((call: unknown[]) => {
          if (typeof call[1] === 'string') {
            expect(call[1].length).toBeGreaterThan(0)
            expect(call[1].trim()).toBe(call[1])
          }
        })
      })
    })

    it('command values are simple executable names', () => {
      fillAll().forEach(({ setValue }) => {
        const command = getField(setValue, 'command')
        if (command) {
          expect(command).toMatch(/^[a-zA-Z0-9_\-./]+$/)
        }
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
  })
})
