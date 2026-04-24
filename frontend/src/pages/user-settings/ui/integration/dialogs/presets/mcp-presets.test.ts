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
      expect(MCP_PRESETS).toHaveLength(6)
    })

    it('enforces unique preset identifiers', () => {
      const ids = MCP_PRESETS.map(p => p.id)
      expect(new Set(ids).size).toBe(ids.length)
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

    it('requires emoji icon (Unicode range check)', () => {
      MCP_PRESETS.forEach(preset => {
        expect(preset.icon).toMatch(/[\u{1F000}-\u{1F9FF}]/u)
      })
    })

    it('requires label for each preset', () => {
      MCP_PRESETS.forEach(preset => {
        expect(preset.label).toBeTruthy()
        expect(typeof preset.label).toBe('string')
        expect(preset.label.length).toBeGreaterThan(0)
      })
    })

    it('ensures labels are descriptive (minimum length)', () => {
      MCP_PRESETS.forEach(preset => {
        expect(preset.label.length).toBeGreaterThanOrEqual(5)
      })
    })

    it('requires fill function for each preset', () => {
      MCP_PRESETS.forEach(preset => {
        expect(preset.fill).toBeDefined()
        expect(typeof preset.fill).toBe('function')
      })
    })
  })

  describe('per-preset field snapshots', () => {
    it('Claude Code one-shot: direct mode via third-party npx package', () => {
      const setValue = fillPreset('claude-code-oneshot')

      expect(setValue.mock.calls).toEqual([
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

    it('Claude Code multi-tool: agent mode via native claude CLI', () => {
      const setValue = fillPreset('claude-code-multi')

      expect(setValue.mock.calls).toEqual([
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

    it('QA Testing: agent mode via Playwright MCP', () => {
      const setValue = fillPreset('qa-testing-mcp')

      expect(setValue.mock.calls).toEqual([
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

    it('Research & RAG: agent mode via d5 internal MCP server', () => {
      const setValue = fillPreset('research-rag-mcp')

      expect(setValue.mock.calls).toEqual([
        ['alias', '/research'],
        ['description', 'Deep research with web and academic paper search'],
        ['transport', 'stdio'],
        ['command', 'babel-node'],
        ['args', '--presets @babel/preset-env src/mcp-servers/research-rag/server.js'],
        ['toolName', 'auto'],
        ['toolInputField', 'prompt'],
        ['timeoutMs', 300000],
      ])
    })

    it('Web Scraper: direct mode via d5 internal scraper server', () => {
      const setValue = fillPreset('scraper-mcp')

      expect(setValue.mock.calls).toEqual([
        ['alias', '/scrape'],
        ['description', 'Web page scraper with content extraction'],
        ['transport', 'stdio'],
        ['command', 'babel-node'],
        ['args', '--presets @babel/preset-env src/mcp-servers/scraper/server.js'],
        ['toolName', 'scrape_web_pages'],
        ['toolInputField', 'urls'],
        ['timeoutMs', 180000],
      ])
    })

    it('Outliner: direct mode via d5 internal outliner server', () => {
      const setValue = fillPreset('outliner-mcp')

      expect(setValue.mock.calls).toEqual([
        ['alias', '/mkoutline'],
        ['description', 'Generate structured outlines from topics'],
        ['transport', 'stdio'],
        ['command', 'babel-node'],
        ['args', '--presets @babel/preset-env src/mcp-servers/outliner/server.js'],
        ['toolName', 'generate_outline'],
        ['toolInputField', 'query'],
        ['timeoutMs', 300000],
      ])
    })
  })

  describe('cross-cutting invariants', () => {
    it('alias and description are always the first fields set', () => {
      fillAll().forEach(({ setValue }) => {
        expect(setValue.mock.calls[0]).toEqual(expect.arrayContaining(['alias']))
        expect(setValue.mock.calls[1]).toEqual(expect.arrayContaining(['description']))
      })
    })

    it('all presets configure alias, description, toolName and toolInputField', () => {
      fillAll().forEach(({ setValue }) => {
        const alias = getField(setValue, 'alias')
        const description = getField(setValue, 'description')
        expect(alias).toBeTruthy()
        expect(alias).toMatch(/^\/[a-zA-Z][a-zA-Z0-9_-]*$/)
        expect(description).toBeTruthy()
        expect(description.length).toBeGreaterThan(10)
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

  describe('alias uniqueness and format', () => {
    it('enforces unique aliases across all presets', () => {
      const aliases = fillAll().map(({ setValue }) => getField(setValue, 'alias'))
      const uniqueAliases = new Set(aliases)
      expect(uniqueAliases.size).toBe(aliases.length)
    })

    it('aliases follow slash-command format', () => {
      fillAll().forEach(({ setValue }) => {
        const alias = getField(setValue, 'alias')
        expect(alias).toMatch(/^\/[a-zA-Z][a-zA-Z0-9_-]*$/)
      })
    })

    it('aliases do not contain spaces or special characters', () => {
      fillAll().forEach(({ setValue }) => {
        const alias = getField(setValue, 'alias')
        expect(alias).not.toMatch(/[\s!@#$%^&*()+={}[\]:;"'<>,.?\\|]/)
      })
    })

    it('aliases are lowercase or camelCase (no all-caps)', () => {
      fillAll().forEach(({ setValue }) => {
        const alias = getField(setValue, 'alias')
        const afterSlash = alias.substring(1)
        expect(afterSlash).not.toMatch(/^[A-Z]+$/)
      })
    })
  })

  describe('description quality', () => {
    it('descriptions are meaningful (not just repeating the alias)', () => {
      fillAll().forEach(({ setValue }) => {
        const alias = getField(setValue, 'alias')
        const description = getField(setValue, 'description')
        const aliasWords = alias.toLowerCase().replace(/[^a-z]/g, '')
        expect(description.toLowerCase()).not.toBe(aliasWords)
      })
    })

    it('descriptions do not end with period', () => {
      fillAll().forEach(({ setValue }) => {
        const description = getField(setValue, 'description')
        expect(description).not.toMatch(/\.$/)
      })
    })

    it('descriptions are sentence case (start with capital)', () => {
      fillAll().forEach(({ setValue }) => {
        const description = getField(setValue, 'description')
        expect(description[0]).toMatch(/[A-Z]/)
      })
    })
  })

  describe('transport-specific field requirements', () => {
    it('stdio presets set command before args', () => {
      fillAll().forEach(({ setValue }) => {
        if (getField(setValue, 'transport') === 'stdio') {
          const commandIndex = setValue.mock.calls.findIndex((call: unknown[]) => call[0] === 'command')
          const argsIndex = setValue.mock.calls.findIndex((call: unknown[]) => call[0] === 'args')
          if (argsIndex !== -1) {
            expect(commandIndex).toBeLessThan(argsIndex)
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

    it('http/sse presets would set serverUrl', () => {
      fillAll().forEach(({ setValue }) => {
        const transport = getField(setValue, 'transport')
        if (transport === 'streamable-http' || transport === 'sse') {
          expect(getField(setValue, 'serverUrl')).toBeTruthy()
        }
      })
    })
  })

  describe('timeout constraints', () => {
    it('no preset has timeout less than 1 minute', () => {
      fillAll().forEach(({ setValue }) => {
        const timeout = getField(setValue, 'timeoutMs')
        expect(timeout).toBeGreaterThanOrEqual(60000)
      })
    })

    it('no preset has timeout greater than 1 hour', () => {
      fillAll().forEach(({ setValue }) => {
        const timeout = getField(setValue, 'timeoutMs')
        expect(timeout).toBeLessThanOrEqual(3600000)
      })
    })

    it('agent mode presets have longer timeouts than direct mode', () => {
      const agentTimeouts = fillAll()
        .filter(({ setValue }) => getField(setValue, 'toolName') === 'auto')
        .map(({ setValue }) => getField(setValue, 'timeoutMs'))

      const directTimeouts = fillAll()
        .filter(({ setValue }) => getField(setValue, 'toolName') !== 'auto')
        .map(({ setValue }) => getField(setValue, 'timeoutMs'))

      if (agentTimeouts.length > 0 && directTimeouts.length > 0) {
        const avgAgent = agentTimeouts.reduce((a, b) => a + b, 0) / agentTimeouts.length
        const avgDirect = directTimeouts.reduce((a, b) => a + b, 0) / directTimeouts.length
        expect(avgAgent).toBeGreaterThanOrEqual(avgDirect)
      }
    })
  })

  describe('field ordering consistency', () => {
    it('alias is always set first', () => {
      fillAll().forEach(({ setValue }) => {
        const firstCall = setValue.mock.calls[0] as unknown[]
        expect(firstCall[0]).toBe('alias')
      })
    })

    it('description is always set second', () => {
      fillAll().forEach(({ setValue }) => {
        const secondCall = setValue.mock.calls[1] as unknown[]
        expect(secondCall[0]).toBe('description')
      })
    })

    it('transport is always set third', () => {
      fillAll().forEach(({ setValue }) => {
        const thirdCall = setValue.mock.calls[2] as unknown[]
        expect(thirdCall[0]).toBe('transport')
      })
    })

    it('timeout is always set last', () => {
      fillAll().forEach(({ setValue }) => {
        const lastCall = setValue.mock.calls[setValue.mock.calls.length - 1] as unknown[]
        expect(lastCall[0]).toBe('timeoutMs')
      })
    })
  })
})
