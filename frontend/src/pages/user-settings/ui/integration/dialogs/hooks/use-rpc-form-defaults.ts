import { useMemo } from 'react'
import type { HTTPMethod, OutputFormat, AutoApprove } from '../rpc-constants'
import {
  serializeArrayToSpaceSeparated,
  serializeArrayToCommaSeparated,
  serializeObjectToKeyValueLines,
} from '../form-serialization'

interface RPCFormData {
  protocol?: 'ssh' | 'http' | 'acp-local'
  port?: number
  method?: HTTPMethod
  outputFormat?: OutputFormat
  sessionIdField?: string
  autoApprove?: AutoApprove
  args?: string[] | string
  env?: Record<string, string> | string
  headers?: Record<string, string> | string
  allowedTools?: string[] | string
  [key: string]: any
}

const CREATE_MODE_DEFAULTS = {
  protocol: 'ssh' as const,
  port: 22,
  method: 'POST' as const,
  outputFormat: 'text' as const,
  sessionIdField: 'session_id',
  autoApprove: 'none' as const,
}

export function useRPCFormDefaults(data: RPCFormData | undefined) {
  return useMemo(() => {
    if (!data) {
      return CREATE_MODE_DEFAULTS
    }

    const serialized: any = { ...data }

    serialized.args = serializeArrayToSpaceSeparated(data.args as any)
    serialized.env = serializeObjectToKeyValueLines(data.env as any)
    serialized.headers = serializeObjectToKeyValueLines(data.headers as any)
    serialized.allowedTools = serializeArrayToCommaSeparated(data.allowedTools as any)

    if (!serialized.outputFormat) serialized.outputFormat = 'text'
    if (!serialized.method) serialized.method = 'POST'
    if (!serialized.autoApprove) serialized.autoApprove = 'none'
    if (!serialized.sessionIdField) serialized.sessionIdField = 'session_id'

    return serialized
  }, [data])
}
