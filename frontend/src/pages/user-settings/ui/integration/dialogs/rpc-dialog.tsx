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
import { Label } from '@shared/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/ui/select'
import { Textarea } from '@shared/ui/textarea'
import { useApiMutation } from '@shared/composables'
import type { HttpError } from '@shared/lib/error'

const rpcProtocols = ['ssh', 'http'] as const
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

const rpcSchema = z.discriminatedUnion('protocol', [sshSchema, httpSchema])

type RPCFormValues = z.infer<typeof rpcSchema>

/* Flat merged type so react-hook-form resolves all fields without union ambiguity */
type RPCFormFlat = {
  alias: string
  protocol: 'ssh' | 'http'
  description?: string
  timeoutMs?: number
  outputFormat: 'text' | 'json'
  outputField?: string
  sessionIdField: string
  host?: string
  port?: number
  username?: string
  privateKey?: string
  passphrase?: string
  commandTemplate?: string
  workingDir?: string
  url?: string
  method?: 'GET' | 'POST' | 'PUT'
  bodyTemplate?: string
}

interface Props extends DialogProps {
  data?: Partial<RPCFormValues>
  refresh: () => Promise<void>
  existingAliases?: string[]
}

const RPCDialog: React.FC<Props> = ({ open, onClose, refresh, data, existingAliases = [] }) => {
  const { mutateAsync: save } = useApiMutation<RPCFormValues[], HttpError, { rpc: RPCFormValues[] }>({
    url: '/integration/rpc/update',
    method: 'PUT',
    onSuccess: () => toast.success(<FormattedMessage id="dialog.integration.saveSuccess" />),
    onError: (err: Error) => {
      const { message } = err
      if (message) toast.error(message)
      else toast.error(<FormattedMessage id="errorServer" />)
    },
  })

  const form = useForm<RPCFormFlat>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(rpcSchema) as any,
    defaultValues: data || {
      protocol: 'ssh',
      port: 22,
      method: 'POST',
      outputFormat: 'text',
      sessionIdField: 'session_id',
    },
  })

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = form

  const protocol = watch('protocol')

  const onSubmit = async (values: RPCFormFlat) => {
    try {
      if (!data && existingAliases.includes(values.alias)) {
        toast.error('Alias already exists')
        return
      }

      await save({ rpc: [values as RPCFormValues] })
      await refresh()
      onClose?.()
    } catch {
      // Error already handled by mutation hook
    }
  }

  return (
    <Dialog onOpenChange={onClose} open={open}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto" data-dialog-name="rpc">
        <DialogHeader>
          <DialogTitle>
            <FormattedMessage id={data ? 'integration.rpc.edit' : 'integration.rpc.add'} />
          </DialogTitle>
          <DialogClose className="absolute right-4 top-4">
            <X className="h-4 w-4" />
          </DialogClose>
        </DialogHeader>

        <DialogDescription />

        <div className="flex flex-col gap-4">
          {/* Alias */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="alias">
              Alias <span className="text-destructive">*</span>
            </Label>
            <Input
              id="alias"
              {...register('alias')}
              disabled={isSubmitting || !!data}
              error={!!errors.alias}
              errorHelper={errors.alias?.message?.toString()}
              placeholder="/myalias"
            />
          </div>

          {/* Protocol */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="protocol">
              Protocol <span className="text-destructive">*</span>
            </Label>
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
            <Label htmlFor="description">Description</Label>
            <Input id="description" {...register('description')} disabled={isSubmitting} />
          </div>

          {protocol === 'ssh' ? (
            <>
              {/* SSH Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="host">
                    Host <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="host"
                    {...register('host')}
                    disabled={isSubmitting}
                    error={!!errors.host}
                    errorHelper={errors.host?.message?.toString()}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="port">Port</Label>
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
                <Label htmlFor="username">
                  Username <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="username"
                  {...register('username')}
                  disabled={isSubmitting}
                  error={!!errors.username}
                  errorHelper={errors.username?.message?.toString()}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="privateKey">
                  Private Key <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="privateKey"
                  {...register('privateKey')}
                  className="font-mono text-xs"
                  disabled={isSubmitting}
                  rows={4}
                />
                {errors.privateKey ? (
                  <span className="text-sm text-destructive">{errors.privateKey.message?.toString()}</span>
                ) : null}
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="passphrase">Passphrase (optional)</Label>
                <Input id="passphrase" type="password" {...register('passphrase')} disabled={isSubmitting} />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="commandTemplate">
                  Command Template <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="commandTemplate"
                  {...register('commandTemplate')}
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
                <Label htmlFor="workingDir">Working Directory</Label>
                <Input id="workingDir" {...register('workingDir')} disabled={isSubmitting} />
              </div>
            </>
          ) : (
            <>
              {/* HTTP Fields */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="url">
                  URL <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="url"
                  {...register('url')}
                  disabled={isSubmitting}
                  error={!!errors.url}
                  errorHelper={errors.url?.message?.toString()}
                  placeholder="https://api.example.com/execute"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="method">Method</Label>
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
                <Label htmlFor="bodyTemplate">Body Template (JSON)</Label>
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
          )}

          {/* Common Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="outputFormat">Output Format</Label>
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
              <Label htmlFor="outputField">Output Field (JSON path)</Label>
              <Input id="outputField" {...register('outputField')} disabled={isSubmitting} placeholder="result.data" />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="sessionIdField">Session ID Field (JSON path)</Label>
            <Input
              id="sessionIdField"
              {...register('sessionIdField')}
              disabled={isSubmitting}
              placeholder="session_id"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="timeoutMs">Timeout (ms)</Label>
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
