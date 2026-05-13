import { describe, it, expect, vi } from 'vitest'
import type { UseFormSetValue } from 'react-hook-form'
import { MCP_PRESETS } from './mcp-presets'
import { D5_BACKEND_ROOT, D5_BACKEND_PATHS } from './d5-backend-paths'

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
  describe('collection structure', () => {
    it('count matches expected (breaking-change sentinel)', () => {
      expect(MCP_PRESETS).toHaveLength(6)
    })

    it('ids are unique across all presets', () => {
      const ids = MCP_PRESETS.map(p => p.id)
      expect(new Set(ids).size).toBe(ids.length)
    })

    it('ids follow kebab-case convention', () => {
      MCP_PRESETS.forEach(preset => {
        expect(preset.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
      })
    })

    it('icons are emoji characters', () => {
      MCP_PRESETS.forEach(preset => {
        expect(preset.icon).toMatch(/[\u{1F000}-\u{1F9FF}]/u)
      })
    })

    it('labels are descriptive (minimum 5 characters)', () => {
      MCP_PRESETS.forEach(preset => {
        expect(preset.label.length).toBeGreaterThanOrEqual(5)
      })
    })

    it('each preset exposes a fill function', () => {
      MCP_PRESETS.forEach(preset => {
        expect(typeof preset.fill).toBe('function')
      })
    })
  })

  describe('per-preset field snapshots', () => {
    it('claude-code-oneshot: direct mode via third-party npx package', () => {
      expect(fillPreset('claude-code-oneshot').mock.calls).toEqual([
        ['alias', '/code'],
        ['description', 'Claude Code one-shot coding agent'],
        ['transport', 'stdio'],
        ['command', 'npx'],
        ['args', '-y @steipete/claude-code-mcp@latest'],
        ['toolName', 'claude_code'],
        ['toolInputField', 'prompt'],
        ['timeoutMs', 600000],
      ])
    })

    it('claude-code-multi: agent mode via native claude CLI', () => {
      expect(fillPreset('claude-code-multi').mock.calls).toEqual([
        ['alias', '/agent'],
        ['description', 'Claude Code multi-tool agent with full MCP capabilities'],
        ['transport', 'stdio'],
        ['command', 'claude'],
        ['args', 'mcp serve'],
        ['toolName', 'auto'],
        ['toolInputField', 'prompt'],
        ['timeoutMs', 600000],
      ])
    })

    it('qa-testing-mcp: agent mode via Playwright MCP', () => {
      expect(fillPreset('qa-testing-mcp').mock.calls).toEqual([
        ['alias', '/qa'],
        ['description', 'Playwright-powered QA testing with browser automation'],
        ['transport', 'stdio'],
        ['command', 'npx'],
        ['args', '@playwright/mcp@latest'],
        ['toolName', 'auto'],
        ['toolInputField', 'prompt'],
        ['timeoutMs', 300000],
      ])
    })

    it('research-rag-mcp: agent mode via d5 internal MCP server', () => {
      expect(fillPreset('research-rag-mcp').mock.calls).toEqual([
        ['alias', '/research'],
        ['description', 'Deep research with web and academic paper search'],
        ['transport', 'stdio'],
        ['command', 'node'],
        ['args', `${D5_BACKEND_ROOT}/${D5_BACKEND_PATHS.mcpResearchRag}`],
        ['toolName', 'auto'],
        ['toolInputField', 'prompt'],
        ['timeoutMs', 300000],
      ])
    })

    it('scraper-mcp: direct mode via d5 internal scraper server', () => {
      expect(fillPreset('scraper-mcp').mock.calls).toEqual([
        ['alias', '/scrape'],
        ['description', 'Web page scraper with content extraction'],
        ['transport', 'stdio'],
        ['command', 'node'],
        ['args', `${D5_BACKEND_ROOT}/${D5_BACKEND_PATHS.mcpScraper}`],
        ['toolName', 'scrape_web_pages'],
        ['toolInputField', 'text'],
        ['timeoutMs', 180000],
      ])
    })

    it('outliner-mcp: direct mode via d5 internal outliner server', () => {
      expect(fillPreset('outliner-mcp').mock.calls).toEqual([
        ['alias', '/mkoutline'],
        ['description', 'Generate structured outlines from topics'],
        ['transport', 'stdio'],
        ['command', 'node'],
        ['args', `${D5_BACKEND_ROOT}/${D5_BACKEND_PATHS.mcpOutliner}`],
        ['toolName', 'generate_outline'],
        ['toolInputField', 'query'],
        ['timeoutMs', 300000],
      ])
    })
  })

  describe('fill behavior', () => {
    it('consecutive fills produce identical call sequences (idempotency)', () => {
      MCP_PRESETS.forEach(preset => {
        const first = vi.fn()
        const second = vi.fn()
        preset.fill(first as unknown as UseFormSetValue<MCPFormFlat>)
        preset.fill(second as unknown as UseFormSetValue<MCPFormFlat>)
        expect(first.mock.calls).toEqual(second.mock.calls)
      })
    })

    it('fill does not mutate the preset definition', () => {
      MCP_PRESETS.forEach(preset => {
        const { id, label, icon } = preset
        preset.fill(vi.fn() as unknown as UseFormSetValue<MCPFormFlat>)
        expect(preset.id).toBe(id)
        expect(preset.label).toBe(label)
        expect(preset.icon).toBe(icon)
      })
    })

    it('alias is always set first', () => {
      fillAll().forEach(({ setValue }) => {
        expect((setValue.mock.calls[0] as unknown[])[0]).toBe('alias')
      })
    })

    it('description is always set second', () => {
      fillAll().forEach(({ setValue }) => {
        expect((setValue.mock.calls[1] as unknown[])[0]).toBe('description')
      })
    })

    it('transport is always set third', () => {
      fillAll().forEach(({ setValue }) => {
        expect((setValue.mock.calls[2] as unknown[])[0]).toBe('transport')
      })
    })

    it('timeout is always set last', () => {
      fillAll().forEach(({ setValue }) => {
        const last = setValue.mock.calls[setValue.mock.calls.length - 1] as unknown[]
        expect(last[0]).toBe('timeoutMs')
      })
    })

    it('transport values are constrained to the allowed enum', () => {
      const allowed = new Set(['stdio', 'streamable-http', 'sse'])
      fillAll().forEach(({ setValue }) => {
        expect(allowed.has(getField(setValue, 'transport'))).toBe(true)
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

    it('command values are safe executable names', () => {
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

    it('stdio presets set command before args', () => {
      fillAll().forEach(({ setValue }) => {
        if (getField(setValue, 'transport') === 'stdio') {
          const commandIdx = setValue.mock.calls.findIndex((c: unknown[]) => c[0] === 'command')
          const argsIdx = setValue.mock.calls.findIndex((c: unknown[]) => c[0] === 'args')
          if (argsIdx !== -1) {
            expect(commandIdx).toBeLessThan(argsIdx)
          }
        }
      })
    })

    it('stdio presets do not set serverUrl', () => {
      fillAll().forEach(({ setValue }) => {
        if (getField(setValue, 'transport') === 'stdio') {
          expect(getField(setValue, 'serverUrl')).toBeUndefined()
        }
      })
    })

    it('streamable-http and sse presets set serverUrl', () => {
      fillAll().forEach(({ setValue }) => {
        const transport = getField(setValue, 'transport')
        if (transport === 'streamable-http' || transport === 'sse') {
          expect(getField(setValue, 'serverUrl')).toBeTruthy()
        }
      })
    })
  })

  describe('alias contract', () => {
    it('aliases are unique across all presets', () => {
      const aliases = fillAll().map(({ setValue }) => getField(setValue, 'alias'))
      expect(new Set(aliases).size).toBe(aliases.length)
    })

    it('aliases follow slash-command format', () => {
      fillAll().forEach(({ setValue }) => {
        expect(getField(setValue, 'alias')).toMatch(/^\/[a-zA-Z][a-zA-Z0-9_-]*$/)
      })
    })
  })

  describe('description contract', () => {
    it('descriptions start with a capital letter', () => {
      fillAll().forEach(({ setValue }) => {
        const description = getField(setValue, 'description')
        expect(description[0]).toMatch(/[A-Z]/)
      })
    })

    it('descriptions do not end with a period', () => {
      fillAll().forEach(({ setValue }) => {
        expect(getField(setValue, 'description')).not.toMatch(/\.$/)
      })
    })

    it('descriptions are meaningfully different from aliases', () => {
      fillAll().forEach(({ setValue }) => {
        const alias = getField(setValue, 'alias')
        const description = getField(setValue, 'description')
        expect(description.toLowerCase()).not.toBe(alias.toLowerCase().replace(/[^a-z]/g, ''))
      })
    })
  })

  describe('tool configuration requirements', () => {
    it('all presets configure toolName and toolInputField', () => {
      fillAll().forEach(({ setValue }) => {
        expect(getField(setValue, 'toolName')).toBeTruthy()
        expect(getField(setValue, 'toolInputField')).toBeTruthy()
      })
    })

    it('collection covers both agent mode (auto) and direct mode (specific tool)', () => {
      const toolNames = fillAll().map(({ setValue }) => getField(setValue, 'toolName'))
      expect(toolNames).toContain('auto')
      expect(toolNames.some((t: string) => t !== 'auto')).toBe(true)
    })
  })

  describe('timeout policy', () => {
    it('all timeouts are between 1 minute and 1 hour', () => {
      fillAll().forEach(({ setValue }) => {
        const timeout = getField(setValue, 'timeoutMs')
        expect(timeout).toBeGreaterThanOrEqual(60_000)
        expect(timeout).toBeLessThanOrEqual(3_600_000)
      })
    })

    it('agent mode presets have higher average timeout than direct mode presets', () => {
      const all = fillAll()
      const agentItems = all.filter(({ setValue }) => getField(setValue, 'toolName') === 'auto')
      const directItems = all.filter(({ setValue }) => getField(setValue, 'toolName') !== 'auto')
      if (agentItems.length > 0 && directItems.length > 0) {
        const agentAvg =
          agentItems.reduce((acc, { setValue }) => acc + getField(setValue, 'timeoutMs'), 0) / agentItems.length
        const directAvg =
          directItems.reduce((acc, { setValue }) => acc + getField(setValue, 'timeoutMs'), 0) / directItems.length
        expect(agentAvg).toBeGreaterThanOrEqual(directAvg)
      }
    })
  })
})
