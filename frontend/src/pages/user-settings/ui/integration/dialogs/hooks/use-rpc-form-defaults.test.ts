import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useRPCFormDefaults } from './use-rpc-form-defaults'

describe('useRPCFormDefaults', () => {
  describe('create mode defaults', () => {
    it('returns schema defaults when data is undefined', () => {
      const { result } = renderHook(() => useRPCFormDefaults(undefined))

      expect(result.current).toEqual({
        protocol: 'ssh',
        port: 22,
        method: 'POST',
        outputFormat: 'text',
        sessionIdField: 'session_id',
        autoApprove: 'none',
      })
    })

    it('returns same reference across rerenders when data is undefined', () => {
      const { result, rerender } = renderHook(() => useRPCFormDefaults(undefined))

      const firstResult = result.current
      rerender()
      expect(result.current).toBe(firstResult)
    })
  })

  describe('serialization of array and object fields', () => {
    it('serializes args array to space-separated string', () => {
      const editData = {
        protocol: 'acp-local' as const,
        alias: '/test',
        command: 'cline',
        args: ['--acp', '--verbose'],
      }

      const { result } = renderHook(() => useRPCFormDefaults(editData))

      expect(result.current.args).toBe('--acp --verbose')
    })

    it('serializes env object to key-value lines', () => {
      const editData = {
        protocol: 'acp-local' as const,
        alias: '/test',
        command: 'cline',
        env: { NODE_ENV: 'production', API_KEY: 'secret' },
      }

      const { result } = renderHook(() => useRPCFormDefaults(editData))

      expect(result.current.env).toContain('NODE_ENV=production')
      expect(result.current.env).toContain('API_KEY=secret')
    })

    it('serializes headers object to key-value lines', () => {
      const editData = {
        protocol: 'http' as const,
        alias: '/test',
        url: 'https://example.com',
        headers: { Authorization: 'Bearer token' },
      }

      const { result } = renderHook(() => useRPCFormDefaults(editData))

      expect(result.current.headers).toBe('Authorization=Bearer token')
    })

    it('serializes allowedTools array to comma-separated string', () => {
      const editData = {
        protocol: 'acp-local' as const,
        alias: '/test',
        command: 'cline',
        allowedTools: ['read_file', 'write_file'],
      }

      const { result } = renderHook(() => useRPCFormDefaults(editData))

      expect(result.current.allowedTools).toBe('read_file, write_file')
    })

    it('handles empty arrays gracefully', () => {
      const editData = {
        protocol: 'acp-local' as const,
        alias: '/test',
        command: 'cline',
        args: [],
        allowedTools: [],
      }

      const { result } = renderHook(() => useRPCFormDefaults(editData))

      expect(result.current.args).toBe('')
      expect(result.current.allowedTools).toBe('')
    })

    it('handles empty objects gracefully', () => {
      const editData = {
        protocol: 'acp-local' as const,
        alias: '/test',
        command: 'cline',
        env: {},
      }

      const { result } = renderHook(() => useRPCFormDefaults(editData))

      expect(result.current.env).toBe('')
    })

    it('preserves already-serialized string fields', () => {
      const editData = {
        protocol: 'acp-local' as const,
        alias: '/test',
        command: 'cline',
        args: '--acp --verbose',
        env: 'NODE_ENV=production',
        headers: 'Authorization=Bearer token',
        allowedTools: 'read_file, write_file',
      }

      const { result } = renderHook(() => useRPCFormDefaults(editData))

      expect(result.current.args).toBe('--acp --verbose')
      expect(result.current.env).toBe('NODE_ENV=production')
      expect(result.current.headers).toBe('Authorization=Bearer token')
      expect(result.current.allowedTools).toBe('read_file, write_file')
    })
  })

  describe('protocol-specific field preservation', () => {
    it('preserves SSH protocol fields from edit data', () => {
      const editData = {
        protocol: 'ssh' as const,
        alias: '/test-ssh',
        host: '192.168.1.100',
        port: 2222,
        username: 'admin',
        privateKey: '***',
        commandTemplate: 'claude -p "{{prompt}}"',
        outputFormat: 'json' as const,
        sessionIdField: 'custom_session',
      }

      const { result } = renderHook(() => useRPCFormDefaults(editData))

      expect(result.current.protocol).toBe('ssh')
      expect(result.current.alias).toBe('/test-ssh')
      expect(result.current.host).toBe('192.168.1.100')
      expect(result.current.port).toBe(2222)
      expect(result.current.outputFormat).toBe('json')
      expect(result.current.sessionIdField).toBe('custom_session')
    })

    it('preserves HTTP protocol fields from edit data', () => {
      const editData = {
        protocol: 'http' as const,
        alias: '/test-http',
        url: 'https://api.example.com',
        method: 'PUT' as const,
        headers: { Authorization: 'Bearer token' },
        bodyTemplate: '{"prompt":"{{prompt}}"}',
        outputFormat: 'json' as const,
      }

      const { result } = renderHook(() => useRPCFormDefaults(editData))

      expect(result.current.protocol).toBe('http')
      expect(result.current.url).toBe('https://api.example.com')
      expect(result.current.method).toBe('PUT')
      expect(result.current.outputFormat).toBe('json')
    })

    it('preserves ACP-local protocol fields from edit data', () => {
      const editData = {
        protocol: 'acp-local' as const,
        alias: '/test-acp',
        command: 'cline',
        args: ['--acp', '--verbose'],
        env: { NODE_ENV: 'production', API_KEY: '***' },
        autoApprove: 'whitelist' as const,
        allowedTools: ['read_file', 'write_file'],
      }

      const { result } = renderHook(() => useRPCFormDefaults(editData))

      expect(result.current.protocol).toBe('acp-local')
      expect(result.current.command).toBe('cline')
      expect(result.current.autoApprove).toBe('whitelist')
    })
  })

  describe('fallback defaults for missing optional fields', () => {
    it('applies outputFormat fallback when missing from SSH edit data', () => {
      const editData = {
        protocol: 'ssh' as const,
        alias: '/test',
        host: '127.0.0.1',
        username: 'user',
        privateKey: '***',
        commandTemplate: 'echo "{{prompt}}"',
      }

      const { result } = renderHook(() => useRPCFormDefaults(editData))

      expect(result.current.outputFormat).toBe('text')
    })

    it('applies method and outputFormat fallbacks when missing from HTTP edit data', () => {
      const editData = {
        protocol: 'http' as const,
        alias: '/test',
        url: 'https://example.com',
      }

      const { result } = renderHook(() => useRPCFormDefaults(editData))

      expect(result.current.method).toBe('POST')
      expect(result.current.outputFormat).toBe('text')
    })

    it('applies autoApprove fallback when missing from ACP edit data', () => {
      const editData = {
        protocol: 'acp-local' as const,
        alias: '/test',
        command: 'cline',
      }

      const { result } = renderHook(() => useRPCFormDefaults(editData))

      expect(result.current.autoApprove).toBe('none')
    })

    it('applies sessionIdField fallback when missing', () => {
      const editData = {
        protocol: 'ssh' as const,
        alias: '/test',
        host: '127.0.0.1',
        username: 'user',
        privateKey: '***',
        commandTemplate: 'echo',
      }

      const { result } = renderHook(() => useRPCFormDefaults(editData))

      expect(result.current.sessionIdField).toBe('session_id')
    })

    it('applies all fallback defaults when all optional fields missing', () => {
      const minimalData = {
        protocol: 'http' as const,
        alias: '/test',
        url: 'https://example.com',
      }

      const { result } = renderHook(() => useRPCFormDefaults(minimalData))

      expect(result.current.outputFormat).toBe('text')
      expect(result.current.method).toBe('POST')
      expect(result.current.sessionIdField).toBe('session_id')
      expect(result.current.autoApprove).toBe('none')
    })
  })

  describe('memoization behavior', () => {
    it('returns same reference when data object reference unchanged', () => {
      const data = { protocol: 'ssh' as const, alias: '/test' }
      const { result, rerender } = renderHook(() => useRPCFormDefaults(data))

      const firstResult = result.current
      rerender()
      expect(result.current).toBe(firstResult)
    })

    it('returns new reference when data object reference changes', () => {
      const { result, rerender } = renderHook(({ data }) => useRPCFormDefaults(data), {
        initialProps: { data: { protocol: 'ssh' as const, alias: '/test1' } },
      })

      const firstResult = result.current
      rerender({ data: { protocol: 'ssh' as const, alias: '/test2' } })

      expect(result.current).not.toBe(firstResult)
      expect(result.current.alias).toBe('/test2')
    })
  })

  describe('edge cases', () => {
    it('preserves extra fields not in schema', () => {
      const editData = {
        protocol: 'ssh' as const,
        alias: '/test',
        customField: 'custom-value',
        unknownProp: 123,
      }

      const { result } = renderHook(() => useRPCFormDefaults(editData as any))

      expect((result.current as any).customField).toBe('custom-value')
      expect((result.current as any).unknownProp).toBe(123)
    })

    it('handles null values in optional fields', () => {
      const editData = {
        protocol: 'ssh' as const,
        alias: '/test',
        description: null as any,
        workingDir: null as any,
      }

      const { result } = renderHook(() => useRPCFormDefaults(editData))

      expect(result.current.description).toBeNull()
      expect(result.current.workingDir).toBeNull()
    })
  })
})
