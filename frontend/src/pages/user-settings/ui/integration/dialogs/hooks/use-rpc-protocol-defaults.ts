import { useEffect, useRef } from 'react'
import type { FieldValues, UseFormSetValue } from 'react-hook-form'
import type { RPCProtocol, HTTPMethod, OutputFormat, AutoApprove } from '../rpc-constants'

interface ProtocolDefaults {
  ssh: {
    outputFormat: OutputFormat
  }
  http: {
    method: HTTPMethod
    outputFormat: OutputFormat
  }
  'acp-local': {
    autoApprove: AutoApprove
  }
}

const PROTOCOL_DEFAULTS: ProtocolDefaults = {
  ssh: {
    outputFormat: 'text',
  },
  http: {
    method: 'POST',
    outputFormat: 'text',
  },
  'acp-local': {
    autoApprove: 'none',
  },
}

interface UseRPCProtocolDefaultsParams<T extends FieldValues> {
  protocol: RPCProtocol
  setValue: UseFormSetValue<T>
  isEditMode: boolean
}

export function useRPCProtocolDefaults<T extends FieldValues>({
  protocol,
  setValue,
  isEditMode,
}: UseRPCProtocolDefaultsParams<T>) {
  const protocolRef = useRef<RPCProtocol>(protocol)
  const initializedRef = useRef(false)

  useEffect(() => {
    const protocolChanged = protocolRef.current !== protocol
    const shouldApplyDefaults = !isEditMode || (isEditMode && protocolChanged && initializedRef.current)

    if (!shouldApplyDefaults) {
      protocolRef.current = protocol
      initializedRef.current = true
      return
    }

    const defaults = PROTOCOL_DEFAULTS[protocol]

    Object.entries(defaults).forEach(([key, value]) => {
      setValue(key as any, value as any)
    })

    protocolRef.current = protocol
    initializedRef.current = true
  }, [protocol, setValue, isEditMode])
}
