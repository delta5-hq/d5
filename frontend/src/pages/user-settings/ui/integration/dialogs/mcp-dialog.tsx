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

const mcpTransports = ['stdio', 'streamable-http'] as const

const stdioSchema = z.object({
  alias: z.string().regex(/^\/[a-zA-Z][a-zA-Z0-9_-]*$/, 'Alias must start with / followed by alphanumeric'),
  transport: z.literal('stdio'),
  toolName: z.string().min(1, 'Tool name is required'),
  toolInputField: z.string().default('prompt'),
  description: z.string().optional(),
  command: z.string().min(1, 'Command is required'),
  args: z.string().optional(),
  timeoutMs: z.number().int().min(5000).max(3600000).optional(),
})

const httpSchema = z.object({
  alias: z.string().regex(/^\/[a-zA-Z][a-zA-Z0-9_-]*$/, 'Alias must start with / followed by alphanumeric'),
  transport: z.literal('streamable-http'),
  toolName: z.string().min(1, 'Tool name is required'),
  toolInputField: z.string().default('prompt'),
  description: z.string().optional(),
  serverUrl: z.string().url('Must be a valid URL'),
  timeoutMs: z.number().int().min(5000).max(3600000).optional(),
})

const mcpSchema = z.discriminatedUnion('transport', [stdioSchema, httpSchema])

type MCPFormValues = z.infer<typeof mcpSchema>

/* Flat merged type so react-hook-form resolves all fields without union ambiguity */
type MCPFormFlat = {
  alias: string
  transport: 'stdio' | 'streamable-http'
  toolName: string
  toolInputField: string
  description?: string
  timeoutMs?: number
  command?: string
  args?: string
  serverUrl?: string
}

interface Props extends DialogProps {
  data?: Partial<MCPFormValues>
  refresh: () => Promise<void>
  existingAliases?: string[]
  isEdit?: boolean
}

const MCPDialog: React.FC<Props> = ({ open, onClose, refresh, data, existingAliases = [], isEdit = false }) => {
  const { mutateAsync: save } = useApiMutation<MCPFormValues, HttpError, MCPFormValues>({
    url: isEdit ? `/integration/mcp/items/${data?.alias}` : '/integration/mcp/items',
    method: isEdit ? 'PUT' : 'POST',
    onSuccess: () => toast.success(<FormattedMessage id="dialog.integration.saveSuccess" />),
    onError: (err: Error) => {
      const { message } = err
      if (message) toast.error(message)
      else toast.error(<FormattedMessage id="errorServer" />)
    },
  })

  const form = useForm<MCPFormFlat>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(mcpSchema) as any,
    defaultValues: data || {
      transport: 'stdio',
      toolInputField: 'prompt',
    },
  })

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = form

  const transport = watch('transport')

  const onSubmit = async (values: MCPFormFlat) => {
    try {
      if (!isEdit && existingAliases.includes(values.alias)) {
        toast.error('Alias already exists')
        return
      }

      const payload = { ...values }
      if (transport === 'stdio' && values.args) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(payload as any).args = values.args.split(' ').filter(Boolean)
      }

      await save(payload as unknown as MCPFormValues)
      await refresh()
      onClose?.()
    } catch {
      // Error already handled by mutation hook
    }
  }

  return (
    <Dialog onOpenChange={onClose} open={open}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto" data-dialog-name="mcp">
        <DialogHeader>
          <DialogTitle>
            <FormattedMessage id={data ? 'integration.mcp.edit' : 'integration.mcp.add'} />
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

          {/* Transport */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="transport">
              Transport <span className="text-destructive">*</span>
            </Label>
            <Select
              disabled={isSubmitting || !!data}
              onValueChange={(val: typeof transport) => setValue('transport', val)}
              value={transport}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {mcpTransports.map(t => (
                  <SelectItem key={t} value={t}>
                    {t}
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

          {/* Tool Name */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="toolName">
              Tool Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="toolName"
              {...register('toolName')}
              disabled={isSubmitting}
              error={!!errors.toolName}
              errorHelper={errors.toolName?.message?.toString()}
              placeholder="auto"
            />
            <span className="text-xs text-muted-foreground">
              Use &quot;auto&quot; for agent mode with tool discovery
            </span>
          </div>

          {/* Tool Input Field */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="toolInputField">Tool Input Field</Label>
            <Input id="toolInputField" {...register('toolInputField')} disabled={isSubmitting} placeholder="prompt" />
          </div>

          {transport === 'stdio' ? (
            <>
              {/* STDIO Fields */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="command">
                  Command <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="command"
                  {...register('command')}
                  disabled={isSubmitting}
                  error={!!errors.command}
                  errorHelper={errors.command?.message?.toString()}
                  placeholder="npx"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="args">Arguments</Label>
                <Textarea
                  id="args"
                  {...register('args')}
                  className="font-mono text-xs"
                  disabled={isSubmitting}
                  placeholder="-y @modelcontextprotocol/server-filesystem"
                  rows={2}
                />
                <span className="text-xs text-muted-foreground">Space-separated arguments</span>
              </div>
            </>
          ) : (
            <>
              {/* HTTP Fields */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="serverUrl">
                  Server URL <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="serverUrl"
                  {...register('serverUrl')}
                  disabled={isSubmitting}
                  error={!!errors.serverUrl}
                  errorHelper={errors.serverUrl?.message?.toString()}
                  placeholder="http://localhost:3100"
                />
              </div>
            </>
          )}

          {/* Timeout */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="timeoutMs">Timeout (ms)</Label>
            <Input
              id="timeoutMs"
              type="number"
              {...register('timeoutMs', { valueAsNumber: true })}
              disabled={isSubmitting}
              placeholder="120000"
            />
          </div>
        </div>

        <DialogFooter className="mt-4 flex justify-end gap-2">
          <Button disabled={isSubmitting} onClick={handleSubmit(onSubmit)} type="submit" variant="accent">
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

export default MCPDialog
