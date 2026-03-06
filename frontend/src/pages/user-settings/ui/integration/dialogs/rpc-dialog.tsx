import { zodResolver } from '@hookform/resolvers/zod'
import * as React from 'react'
import { useForm } from 'react-hook-form'
import { FormattedMessage } from 'react-intl'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'

import type { DialogProps } from '@shared/base-types'
import { Button } from '@shared/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@shared/ui/dialog'
import { Input } from '@shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/ui/select'
import { Textarea } from '@shared/ui/textarea'
import { useApiMutation } from '@shared/composables'
import type { HttpError } from '@shared/lib/error'
import { FormFieldLabel } from '../components/form-field-label'
import {
  serializeArrayToSpaceSeparated,
  serializeArrayToCommaSeparated,
  serializeObjectToKeyValueLines,
  deserializeSpaceSeparatedToArray,
  deserializeCommaSeparatedToArray,
  deserializeKeyValueLinesToObject,
} from './form-serialization'

const rpcProtocols = ['ssh', 'http', 'acp-local'] as const
const acpAutoApproveOptions = ['all', 'none', 'whitelist'] as const
const rpcMethods = ['GET', 'POST', 'PUT'] as const
const rpcOutputFormats = ['text', 'json'] as const

const sshSchema = z.object({
  alias: z.string().regex(/^\/[a-zA-Z][a-zA-Z0-9_-]*$/, 'Alias must start with / followed by alphanumeric'),
  protocol: z.literal('ssh'),
  description: z.string().optional(),
  host: z.string().min(1, 'Host is required'),
  port: z.number().int().min(1).max(65535).default(22),
  username: z.string().min(1, 'Username is required'),
  privateKey: z.string().min(1, 'Private key is required'),
  passphrase: z.string().optional(),
  commandTemplate: z.string().min(1, 'Command template is required'),
  workingDir: z.string().optional(),
  timeoutMs: z.number().int().min(5000).max(7200000).optional(),
  outputFormat: z.enum(rpcOutputFormats).default('text'),
  outputField: z.string().optional(),
  sessionIdField: z.string().default('session_id'),
})

const httpSchema = z.object({
  alias: z.string().regex(/^\/[a-zA-Z][a-zA-Z0-9_-]*$/, 'Alias must start with / followed by alphanumeric'),
  protocol: z.literal('http'),
  description: z.string().optional(),
  url: z.string().url('Must be a valid URL'),
  method: z.enum(rpcMethods).default('POST'),
  bodyTemplate: z.string().optional(),
  timeoutMs: z.number().int().min(5000).max(7200000).optional(),
  outputFormat: z.enum(rpcOutputFormats).default('text'),
  outputField: z.string().optional(),
  sessionIdField: z.string().default('session_id'),
})

const acpLocalSchema = z.object({
  alias: z.string().regex(/^\/[a-zA-Z][a-zA-Z0-9_-]*$/, 'Alias must start with / followed by alphanumeric'),
  protocol: z.literal('acp-local'),
  description: z.string().optional(),
  command: z.string().min(1, 'Command is required'),
  args: z.string().optional(),
  env: z.string().optional(),
  workingDir: z.string().optional(),
  timeoutMs: z.number().int().min(5000).max(7200000).optional(),
  autoApprove: z.enum(acpAutoApproveOptions).default('none'),
  allowedTools: z.string().optional(),
})

const rpcSchema = z.discriminatedUnion('protocol', [sshSchema, httpSchema, acpLocalSchema])

type RPCFormValues = z.infer<typeof rpcSchema>

/* Flat merged type so react-hook-form resolves all fields without union ambiguity */
type RPCFormFlat = {
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

interface Props extends DialogProps {
  data?: Partial<RPCFormValues>
  refresh: () => Promise<void>
  existingAliases?: string[]
  isEdit?: boolean
}

const RPCDialog: React.FC<Props> = ({ open, onClose, refresh, data, existingAliases = [], isEdit = false }) => {
  const { mutateAsync: save } = useApiMutation<RPCFormValues, HttpError, RPCFormValues>({
    url: isEdit ? `/integration/rpc/items/${data?.alias}` : '/integration/rpc/items',
    method: isEdit ? 'PUT' : 'POST',
    onSuccess: () => toast.success(<FormattedMessage id="dialog.integration.saveSuccess" />),
    onError: (err: Error) => {
      const { message } = err
      if (message) toast.error(message)
      else toast.error(<FormattedMessage id="errorServer" />)
    },
  })

  const formDefaults = React.useMemo(() => {
    if (!data) {
      return {
        protocol: 'ssh' as const,
        port: 22,
        method: 'POST' as const,
        outputFormat: 'text' as const,
        sessionIdField: 'session_id',
      }
    }

    const serialized: Partial<RPCFormFlat> = { ...data }

    serialized.args = serializeArrayToSpaceSeparated((data as any).args)
    serialized.env = serializeObjectToKeyValueLines((data as any).env)
    serialized.headers = serializeObjectToKeyValueLines((data as any).headers)
    serialized.allowedTools = serializeArrayToCommaSeparated((data as any).allowedTools)

    return serialized
  }, [data])

  const form = useForm<RPCFormFlat>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(rpcSchema) as any,
    defaultValues: formDefaults,
  })

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = form

  const protocol = watch('protocol')

  const fillClaudePreset = () => {
    setValue('commandTemplate', 'claude -p "{{prompt}}" --output-format json --dangerously-skip-permissions')
    setValue('outputFormat', 'json')
    setValue('outputField', 'output')
    setValue('sessionIdField', 'session_id')
  }

  const onSubmit = async (values: RPCFormFlat) => {
    try {
      if (!isEdit && existingAliases.includes(values.alias)) {
        toast.error('Alias already exists')
        return
      }

      const payload = { ...values }
      if (protocol === 'acp-local') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(payload as any).args = deserializeSpaceSeparatedToArray(values.args)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(payload as any).env = deserializeKeyValueLinesToObject(values.env)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(payload as any).allowedTools = deserializeCommaSeparatedToArray(values.allowedTools)
      } else if (protocol === 'http') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(payload as any).headers = deserializeKeyValueLinesToObject(values.headers)
      }

      await save(payload as RPCFormValues)
      await refresh()
      onClose?.()
    } catch {
      // Error already handled by mutation hook
    }
  }

  return (
    <Dialog onOpenChange={onClose} open={open}>
      <DialogContent
        className="max-w-[95vw] xs:max-w-md sm:max-w-2xl max-h-[85vh] overflow-y-auto"
        data-dialog-name="rpc"
      >
        <DialogHeader>
          <DialogTitle>
            <FormattedMessage id={data ? 'integration.rpc.edit' : 'integration.rpc.add'} />
          </DialogTitle>
          <DialogClose className="absolute right-4 top-4">
            <X className="h-4 w-4" />
            <span className="sr-only">
              <FormattedMessage id="close" />
            </span>
          </DialogClose>
        </DialogHeader>

        <DialogDescription />

        <div className="flex flex-col gap-4">
          {/* Alias */}
          <div className="flex flex-col gap-2">
            <FormFieldLabel htmlFor="alias" labelId="dialog.integration.alias" required />
            <Input
              id="alias"
              {...register('alias')}
              aria-required="true"
              disabled={isSubmitting || !!data}
              error={!!errors.alias}
              errorHelper={errors.alias?.message?.toString()}
              placeholder="/myalias"
            />
          </div>

          {/* Protocol */}
          <div className="flex flex-col gap-2">
            <FormFieldLabel htmlFor="protocol" labelId="dialog.integration.protocol" required />
            <Select
              disabled={isSubmitting || !!data}
              onValueChange={(val: typeof protocol) => setValue('protocol', val)}
              value={protocol}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {rpcProtocols.map(p => (
                  <SelectItem key={p} value={p}>
                    {p.toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="flex flex-col gap-2">
            <FormFieldLabel htmlFor="description" labelId="dialog.integration.description" />
            <Input id="description" {...register('description')} disabled={isSubmitting} />
          </div>

          {protocol === 'ssh' ? (
            <>
              {/* SSH Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <FormFieldLabel htmlFor="host" labelId="dialog.integration.host" required />
                  <Input
                    id="host"
                    {...register('host')}
                    aria-required="true"
                    disabled={isSubmitting}
                    error={!!errors.host}
                    errorHelper={errors.host?.message?.toString()}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <FormFieldLabel htmlFor="port" labelId="dialog.integration.port" />
                  <Input
                    id="port"
                    type="number"
                    {...register('port', { valueAsNumber: true })}
                    disabled={isSubmitting}
                    error={!!errors.port}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <FormFieldLabel htmlFor="username" labelId="dialog.integration.username" required />
                <Input
                  id="username"
                  {...register('username')}
                  aria-required="true"
                  disabled={isSubmitting}
                  error={!!errors.username}
                  errorHelper={errors.username?.message?.toString()}
                />
              </div>

              <div className="flex flex-col gap-2">
                <FormFieldLabel htmlFor="privateKey" labelId="dialog.integration.privateKey" required />
                <Textarea
                  id="privateKey"
                  {...register('privateKey')}
                  aria-required="true"
                  className="font-mono text-xs"
                  disabled={isSubmitting}
                  rows={4}
                />
                {errors.privateKey ? (
                  <span className="text-sm text-destructive">{errors.privateKey.message?.toString()}</span>
                ) : null}
              </div>

              <div className="flex flex-col gap-2">
                <FormFieldLabel htmlFor="passphrase" labelId="dialog.integration.passphrase" />
                <Input id="passphrase" type="password" {...register('passphrase')} disabled={isSubmitting} />
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <FormFieldLabel htmlFor="commandTemplate" labelId="dialog.integration.commandTemplate" required />
                  <Button disabled={isSubmitting} onClick={fillClaudePreset} size="sm" type="button" variant="default">
                    🤖 Claude CLI Preset
                  </Button>
                </div>
                <Textarea
                  id="commandTemplate"
                  {...register('commandTemplate')}
                  aria-required="true"
                  className="font-mono text-xs"
                  disabled={isSubmitting}
                  placeholder='claude -p "{{prompt}}" --output-format json'
                />
                {errors.commandTemplate ? (
                  <span className="text-sm text-destructive">{errors.commandTemplate.message?.toString()}</span>
                ) : null}
                <span className="text-xs text-muted-foreground">Use {`{{prompt}}`} as placeholder</span>
              </div>

              <div className="flex flex-col gap-2">
                <FormFieldLabel htmlFor="workingDir" labelId="dialog.integration.workingDirectory" />
                <Input id="workingDir" {...register('workingDir')} disabled={isSubmitting} />
              </div>
            </>
          ) : protocol === 'http' ? (
            <>
              {/* HTTP Fields */}
              <div className="flex flex-col gap-2">
                <FormFieldLabel htmlFor="url" labelId="dialog.integration.url" required />
                <Input
                  id="url"
                  {...register('url')}
                  aria-required="true"
                  disabled={isSubmitting}
                  error={!!errors.url}
                  errorHelper={errors.url?.message?.toString()}
                  placeholder="https://api.example.com/execute"
                />
              </div>

              <div className="flex flex-col gap-2">
                <FormFieldLabel htmlFor="method" labelId="dialog.integration.method" />
                <Select
                  disabled={isSubmitting}
                  onValueChange={(val: (typeof rpcMethods)[number]) => setValue('method', val)}
                  value={watch('method')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {rpcMethods.map(m => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <FormFieldLabel htmlFor="headers" labelId="dialog.integration.headers" />
                <Textarea
                  id="headers"
                  {...register('headers')}
                  className="font-mono text-xs"
                  disabled={isSubmitting}
                  placeholder="Authorization=Bearer token&#10;Content-Type=application/json"
                  rows={3}
                />
                <span className="text-xs text-muted-foreground">One KEY=VALUE per line</span>
              </div>

              <div className="flex flex-col gap-2">
                <FormFieldLabel htmlFor="bodyTemplate" labelId="dialog.integration.bodyTemplate" />
                <Textarea
                  id="bodyTemplate"
                  {...register('bodyTemplate')}
                  className="font-mono text-xs"
                  disabled={isSubmitting}
                  placeholder={`{"query":"{{prompt}}"}`}
                />
                <span className="text-xs text-muted-foreground">Use {`{{prompt}}`} as placeholder</span>
              </div>
            </>
          ) : (
            <>
              {/* ACP-Local Fields */}
              <div className="flex flex-col gap-2">
                <FormFieldLabel htmlFor="command" labelId="dialog.integration.command" required />
                <Input
                  id="command"
                  {...register('command')}
                  aria-required="true"
                  disabled={isSubmitting}
                  error={!!errors.command}
                  errorHelper={errors.command?.message?.toString()}
                  placeholder="cline"
                />
              </div>

              <div className="flex flex-col gap-2">
                <FormFieldLabel htmlFor="args" labelId="dialog.integration.arguments" />
                <Textarea
                  id="args"
                  {...register('args')}
                  className="font-mono text-xs"
                  disabled={isSubmitting}
                  placeholder="--acp"
                  rows={2}
                />
                <span className="text-xs text-muted-foreground">Space-separated arguments</span>
              </div>

              <div className="flex flex-col gap-2">
                <FormFieldLabel htmlFor="env" labelId="dialog.integration.environmentVariables" />
                <Textarea
                  id="env"
                  {...register('env')}
                  className="font-mono text-xs"
                  disabled={isSubmitting}
                  placeholder="PATH=/usr/local/bin&#10;NODE_ENV=production"
                  rows={3}
                />
                <span className="text-xs text-muted-foreground">One KEY=VALUE per line</span>
              </div>

              <div className="flex flex-col gap-2">
                <FormFieldLabel htmlFor="workingDir" labelId="dialog.integration.workingDirectory" />
                <Input id="workingDir" {...register('workingDir')} disabled={isSubmitting} />
              </div>

              <div className="flex flex-col gap-2">
                <FormFieldLabel htmlFor="autoApprove" labelId="dialog.integration.autoApproveMode" />
                <Select
                  disabled={isSubmitting}
                  onValueChange={(val: (typeof acpAutoApproveOptions)[number]) => setValue('autoApprove', val)}
                  value={watch('autoApprove')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {acpAutoApproveOptions.map(opt => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <FormFieldLabel htmlFor="allowedTools" labelId="dialog.integration.allowedTools" />
                <Textarea
                  id="allowedTools"
                  {...register('allowedTools')}
                  className="font-mono text-xs"
                  disabled={isSubmitting}
                  placeholder="read_file,write_file,execute_command"
                  rows={2}
                />
                <span className="text-xs text-muted-foreground">Comma-separated tool names</span>
              </div>
            </>
          )}

          {/* Common Fields (SSH/HTTP only) */}
          {protocol !== 'acp-local' ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <FormFieldLabel htmlFor="outputFormat" labelId="dialog.integration.outputFormat" />
                  <Select
                    disabled={isSubmitting}
                    onValueChange={(val: (typeof rpcOutputFormats)[number]) => setValue('outputFormat', val)}
                    value={watch('outputFormat')}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {rpcOutputFormats.map(f => (
                        <SelectItem key={f} value={f}>
                          {f.toUpperCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-2">
                  <FormFieldLabel htmlFor="outputField" labelId="dialog.integration.outputField" />
                  <Input
                    id="outputField"
                    {...register('outputField')}
                    disabled={isSubmitting}
                    placeholder="result.data"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <FormFieldLabel htmlFor="sessionIdField" labelId="dialog.integration.sessionIdField" />
                <Input
                  id="sessionIdField"
                  {...register('sessionIdField')}
                  disabled={isSubmitting}
                  placeholder="session_id"
                />
              </div>
            </>
          ) : null}

          <div className="flex flex-col gap-2">
            <FormFieldLabel htmlFor="timeoutMs" labelId="dialog.integration.timeout" />
            <Input
              id="timeoutMs"
              type="number"
              {...register('timeoutMs', { valueAsNumber: true })}
              disabled={isSubmitting}
              placeholder="300000"
            />
          </div>
        </div>

        <DialogFooter className="mt-4 flex justify-end gap-2">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <Button disabled={isSubmitting} onClick={handleSubmit(onSubmit as any)} type="submit" variant="accent">
            <FormattedMessage id="save" />
          </Button>
          <DialogClose asChild>
            <Button variant="default">
              <FormattedMessage id="cancel" />
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default RPCDialog
