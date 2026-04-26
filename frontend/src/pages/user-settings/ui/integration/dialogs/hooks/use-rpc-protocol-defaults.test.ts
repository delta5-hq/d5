import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useRPCProtocolDefaults } from './use-rpc-protocol-defaults'
import type { RPCProtocol } from '../rpc-constants'

describe('useRPCProtocolDefaults', () => {
  describe('protocol-specific defaults mapping', () => {
    it('applies SSH defaults (outputFormat only)', () => {
      const setValue = vi.fn()
      renderHook(() => useRPCProtocolDefaults({ protocol: 'ssh', setValue, isEditMode: false }))

      expect(setValue).toHaveBeenCalledWith('outputFormat', 'text')
      expect(setValue).toHaveBeenCalledTimes(1)
    })

    it('applies HTTP defaults (method and outputFormat)', () => {
      const setValue = vi.fn()
      renderHook(() => useRPCProtocolDefaults({ protocol: 'http', setValue, isEditMode: false }))

      expect(setValue).toHaveBeenCalledWith('method', 'POST')
      expect(setValue).toHaveBeenCalledWith('outputFormat', 'text')
      expect(setValue).toHaveBeenCalledTimes(2)
    })

    it('applies ACP-local defaults (autoApprove only)', () => {
      const setValue = vi.fn()
      renderHook(() => useRPCProtocolDefaults({ protocol: 'acp-local', setValue, isEditMode: false }))

      expect(setValue).toHaveBeenCalledWith('autoApprove', 'none')
      expect(setValue).toHaveBeenCalledTimes(1)
    })
  })

  describe('protocol switching behavior in create mode', () => {
    it('reapplies defaults when protocol changes from SSH to HTTP', () => {
      const setValue = vi.fn()
      const { rerender } = renderHook(
        ({ protocol }) => useRPCProtocolDefaults({ protocol, setValue, isEditMode: false }),
        { initialProps: { protocol: 'ssh' as RPCProtocol } },
      )

      setValue.mockClear()
      rerender({ protocol: 'http' as RPCProtocol })

      expect(setValue).toHaveBeenCalledWith('method', 'POST')
      expect(setValue).toHaveBeenCalledWith('outputFormat', 'text')
      expect(setValue).toHaveBeenCalledTimes(2)
    })

    it('reapplies defaults when protocol changes from HTTP to ACP-local', () => {
      const setValue = vi.fn()
      const { rerender } = renderHook(
        ({ protocol }) => useRPCProtocolDefaults({ protocol, setValue, isEditMode: false }),
        { initialProps: { protocol: 'http' as RPCProtocol } },
      )

      setValue.mockClear()
      rerender({ protocol: 'acp-local' as RPCProtocol })

      expect(setValue).toHaveBeenCalledWith('autoApprove', 'none')
      expect(setValue).toHaveBeenCalledTimes(1)
    })

    it('reapplies defaults when protocol changes from ACP-local to SSH', () => {
      const setValue = vi.fn()
      const { rerender } = renderHook(
        ({ protocol }) => useRPCProtocolDefaults({ protocol, setValue, isEditMode: false }),
        { initialProps: { protocol: 'acp-local' as RPCProtocol } },
      )

      setValue.mockClear()
      rerender({ protocol: 'ssh' as RPCProtocol })

      expect(setValue).toHaveBeenCalledWith('outputFormat', 'text')
      expect(setValue).toHaveBeenCalledTimes(1)
    })

    it('handles round-trip protocol changes (SSH→HTTP→SSH)', () => {
      const setValue = vi.fn()
      const { rerender } = renderHook(
        ({ protocol }) => useRPCProtocolDefaults({ protocol, setValue, isEditMode: false }),
        { initialProps: { protocol: 'ssh' as RPCProtocol } },
      )

      setValue.mockClear()
      rerender({ protocol: 'http' as RPCProtocol })
      expect(setValue).toHaveBeenCalledTimes(2)

      setValue.mockClear()
      rerender({ protocol: 'ssh' as RPCProtocol })
      expect(setValue).toHaveBeenCalledWith('outputFormat', 'text')
      expect(setValue).toHaveBeenCalledTimes(1)
    })

    it('does not reapply defaults when protocol remains unchanged', () => {
      const setValue = vi.fn()
      const { rerender } = renderHook(
        ({ protocol }) => useRPCProtocolDefaults({ protocol, setValue, isEditMode: false }),
        { initialProps: { protocol: 'ssh' as RPCProtocol } },
      )

      setValue.mockClear()
      rerender({ protocol: 'ssh' as RPCProtocol })

      expect(setValue).not.toHaveBeenCalled()
    })
  })

  describe('edit mode behavior', () => {
    it('does not apply defaults on initial mount in edit mode', () => {
      const setValue = vi.fn()
      renderHook(() => useRPCProtocolDefaults({ protocol: 'ssh', setValue, isEditMode: true }))

      expect(setValue).not.toHaveBeenCalled()
    })

    it('applies defaults when protocol changes in edit mode after initialization', () => {
      const setValue = vi.fn()
      const { rerender } = renderHook(
        ({ protocol }) => useRPCProtocolDefaults({ protocol, setValue, isEditMode: true }),
        { initialProps: { protocol: 'ssh' as RPCProtocol } },
      )

      expect(setValue).not.toHaveBeenCalled()

      rerender({ protocol: 'http' as RPCProtocol })
      expect(setValue).toHaveBeenCalledWith('method', 'POST')
      expect(setValue).toHaveBeenCalledWith('outputFormat', 'text')
    })

    it('does not reapply defaults when protocol remains same in edit mode', () => {
      const setValue = vi.fn()
      const { rerender } = renderHook(
        ({ protocol }) => useRPCProtocolDefaults({ protocol, setValue, isEditMode: true }),
        { initialProps: { protocol: 'ssh' as RPCProtocol } },
      )

      expect(setValue).not.toHaveBeenCalled()

      rerender({ protocol: 'ssh' as RPCProtocol })
      expect(setValue).not.toHaveBeenCalled()
    })

    it('handles multiple protocol changes in edit mode', () => {
      const setValue = vi.fn()
      const { rerender } = renderHook(
        ({ protocol }) => useRPCProtocolDefaults({ protocol, setValue, isEditMode: true }),
        { initialProps: { protocol: 'ssh' as RPCProtocol } },
      )

      rerender({ protocol: 'http' as RPCProtocol })
      expect(setValue).toHaveBeenCalledTimes(2)

      setValue.mockClear()
      rerender({ protocol: 'acp-local' as RPCProtocol })
      expect(setValue).toHaveBeenCalledTimes(1)
    })
  })

  describe('create mode behavior', () => {
    it('applies defaults on initial mount in create mode', () => {
      const setValue = vi.fn()
      renderHook(() => useRPCProtocolDefaults({ protocol: 'ssh', setValue, isEditMode: false }))

      expect(setValue).toHaveBeenCalledWith('outputFormat', 'text')
    })

    it('applies defaults on every protocol change in create mode', () => {
      const setValue = vi.fn()
      const { rerender } = renderHook(
        ({ protocol }) => useRPCProtocolDefaults({ protocol, setValue, isEditMode: false }),
        { initialProps: { protocol: 'ssh' as RPCProtocol } },
      )

      setValue.mockClear()
      rerender({ protocol: 'http' as RPCProtocol })
      expect(setValue).toHaveBeenCalledTimes(2)

      setValue.mockClear()
      rerender({ protocol: 'acp-local' as RPCProtocol })
      expect(setValue).toHaveBeenCalledTimes(1)
    })
  })

  describe('rapid protocol switching', () => {
    it('handles rapid sequential protocol changes correctly', () => {
      const setValue = vi.fn()
      const { rerender } = renderHook(
        ({ protocol }) => useRPCProtocolDefaults({ protocol, setValue, isEditMode: false }),
        { initialProps: { protocol: 'ssh' as RPCProtocol } },
      )

      setValue.mockClear()
      rerender({ protocol: 'http' as RPCProtocol })
      rerender({ protocol: 'acp-local' as RPCProtocol })
      rerender({ protocol: 'ssh' as RPCProtocol })

      const allCalls = setValue.mock.calls
      expect(allCalls).toContainEqual(['method', 'POST'])
      expect(allCalls).toContainEqual(['outputFormat', 'text'])
      expect(allCalls).toContainEqual(['autoApprove', 'none'])
    })

    it('maintains correct state after rapid protocol changes with duplicates', () => {
      const setValue = vi.fn()
      const { rerender } = renderHook(
        ({ protocol }) => useRPCProtocolDefaults({ protocol, setValue, isEditMode: false }),
        { initialProps: { protocol: 'ssh' as RPCProtocol } },
      )

      setValue.mockClear()
      rerender({ protocol: 'http' as RPCProtocol })
      rerender({ protocol: 'http' as RPCProtocol })
      rerender({ protocol: 'ssh' as RPCProtocol })
      rerender({ protocol: 'ssh' as RPCProtocol })

      const calls = setValue.mock.calls
      const sshCalls = calls.filter(([key]) => key === 'outputFormat')
      const httpCalls = calls.filter(([key]) => key === 'method')

      expect(sshCalls.length).toBeGreaterThan(0)
      expect(httpCalls.length).toBeGreaterThan(0)
    })
  })

  describe('initialization tracking', () => {
    it('tracks initialization state correctly in create mode', () => {
      const setValue = vi.fn()
      const { rerender } = renderHook(
        ({ protocol }) => useRPCProtocolDefaults({ protocol, setValue, isEditMode: false }),
        { initialProps: { protocol: 'ssh' as RPCProtocol } },
      )

      expect(setValue).toHaveBeenCalledTimes(1)

      setValue.mockClear()
      rerender({ protocol: 'ssh' as RPCProtocol })
      expect(setValue).not.toHaveBeenCalled()
    })

    it('tracks initialization state correctly in edit mode', () => {
      const setValue = vi.fn()
      const { rerender } = renderHook(
        ({ protocol }) => useRPCProtocolDefaults({ protocol, setValue, isEditMode: true }),
        { initialProps: { protocol: 'http' as RPCProtocol } },
      )

      expect(setValue).not.toHaveBeenCalled()

      rerender({ protocol: 'acp-local' as RPCProtocol })
      expect(setValue).toHaveBeenCalledTimes(1)
    })
  })
})
