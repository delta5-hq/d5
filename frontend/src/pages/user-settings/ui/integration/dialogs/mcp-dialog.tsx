import { zodResolver } from '@hookform/resolvers/zod'
import * as React from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { FormattedMessage } from 'react-intl'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'

import type { DialogProps } from '@shared/base-types'
import { Button } from '@shared/ui/button'
import {
  GlassDialog,
  GlassDialogClose,
  GlassDialogContent,
  GlassDialogDescription,
  GlassDialogFooter,
  GlassDialogHeader,
  GlassDialogTitle,
} from '@shared/ui/glass-dialog'
import { Input } from '@shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/ui/select'
import { Textarea } from '@shared/ui/textarea'
import { useApiMutation } from '@shared/composables'
import type { HttpError } from '@shared/lib/error'
import { FormFieldLabel } from '../components/form-field-label'
import {
  serializeArrayToSpaceSeparated,
  deserializeSpaceSeparatedToArray,
  serializeObjectToKeyValueLines,
  deserializeKeyValueLinesToObject,
} from './form-serialization'
import { buildIntegrationUrl } from '../utils/build-integration-url'
import { PresetButtonRow, MCP_PRESETS } from './presets'
import { integrationAliasSchema } from './integration-alias-schema'

const mcpTransports = ['stdio', 'streamable-http', 'sse'] as const
const KEY_VALUE_LINES_HELP_TEXT = 'One KEY=VALUE per line'

const timeoutMsField = z.preprocess(
  val => (typeof val === 'number' && Number.isNaN(val) ? undefined : val),
  z.number().int().min(5000).max(3600000).optional(),
)

const stdioSchema = z.object({
  alias: integrationAliasSchema,
  transport: z.literal('stdio'),
  toolName: z.string().min(1, 'Tool name is required'),
  toolInputField: z.string().default('prompt'),
  description: z.string().optional(),
  command: z.string().min(1, 'Command is required'),
  args: z.string().optional(),
  env: z.string().optional(),
  timeoutMs: timeoutMsField,
})

const urlBasedFields = {
  alias: integrationAliasSchema,
  toolName: z.string().min(1, 'Tool name is required'),
  toolInputField: z.string().default('prompt'),
  description: z.string().optional(),
  serverUrl: z.string().url('Must be a valid URL'),
  headers: z.string().optional(),
  timeoutMs: timeoutMsField,
}

const httpSchema = z.object({ ...urlBasedFields, transport: z.literal('streamable-http') })
const sseSchema = z.object({ ...urlBasedFields, transport: z.literal('sse') })

const mcpSchema = z.discriminatedUnion('transport', [stdioSchema, httpSchema, sseSchema])

type MCPFormValues = z.infer<typeof mcpSchema>

type MCPFormFlat = {
  alias: string
  transport: 'stdio' | 'streamable-http' | 'sse'
  toolName: string
  toolInputField: string
  description?: string
  timeoutMs?: number
  command?: string
  args?: string
  env?: string
  serverUrl?: string
  headers?: string
}

type MCPDialogData = Partial<Omit<MCPFormFlat, 'args' | 'env' | 'headers'>> & {
  args?: string[] | string
  env?: Record<string, string> | string
  headers?: Record<string, string> | string
}

type MCPPayload = Omit<MCPFormFlat, 'args' | 'env' | 'headers'> & {
  args?: string[]
  env?: Record<string, string>
  headers?: Record<string, string>
}

interface Props extends DialogProps {
  data?: MCPDialogData
  refresh: () => Promise<void>
  existingAliases?: string[]
  isEdit?: boolean
  workflowId?: string | null
}

const MCPDialog: React.FC<Props> = ({
  open,
  onClose,
  refresh,
  data,
  existingAliases = [],
  isEdit = false,
  workflowId,
}) => {
  const baseUrl = isEdit ? `/integration/mcp/items/${encodeURIComponent(data?.alias ?? '')}` : '/integration/mcp/items'
  const url = buildIntegrationUrl(baseUrl, workflowId)

  const { mutateAsync: save } = useApiMutation<MCPFormValues, HttpError, MCPFormValues>({
    url,
    method: isEdit ? 'PUT' : 'POST',
    onSuccess: () => toast.success(<FormattedMessage id="dialog.integration.saveSuccess" />),
    onError: (err: Error) => {
      const { message } = err
      if (message && /already exists in field/i.test(message)) {
        toast.error('Alias already in use by another integration')
      } else if (message) {
        toast.error(message)
      } else {
        toast.error(<FormattedMessage id="errorServer" />)
      }
    },
  })

  const formDefaults = React.useMemo(() => {
    if (!data) {
      return {
        transport: 'stdio' as const,
        toolInputField: 'prompt',
      }
    }

    const { args, env, headers, ...plainFields } = data
    const serialized: Partial<MCPFormFlat> = { ...plainFields }

    serialized.args = serializeArrayToSpaceSeparated(args)
    serialized.env = serializeObjectToKeyValueLines(env)
    serialized.headers = serializeObjectToKeyValueLines(headers)

    return serialized
  }, [data])

  const form = useForm<MCPFormFlat>({
    resolver: zodResolver(mcpSchema) as Resolver<MCPFormFlat>,
    defaultValues: formDefaults,
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
      const otherAliases = isEdit ? existingAliases.filter(a => a !== data?.alias) : existingAliases
      if (otherAliases.includes(values.alias)) {
        toast.error('Alias already in use by another integration')
        return
      }

      const { args, env, headers, ...plainValues } = values
      const payload: MCPPayload = { ...plainValues }
      if (transport === 'stdio') {
        payload.args = deserializeSpaceSeparatedToArray(args)
        payload.env = deserializeKeyValueLinesToObject(env)
      } else {
        payload.headers = deserializeKeyValueLinesToObject(headers)
      }

      await save(payload as unknown as MCPFormValues)
      await refresh()
      onClose?.()
    } catch {
      return undefined
    }
  }

  return (
    <GlassDialog onOpenChange={onClose} open={open}>
      <GlassDialogContent
        className="max-w-[95vw] xs:max-w-md sm:max-w-2xl max-h-[85vh] overflow-y-auto"
        data-dialog-name="mcp"
        dismissible={false}
      >
        <GlassDialogHeader>
          <GlassDialogTitle>
            <FormattedMessage id={data ? 'integration.mcp.edit' : 'integration.mcp.add'} />
          </GlassDialogTitle>
          <GlassDialogClose className="absolute right-4 top-4">
            <X className="h-4 w-4" />
            <span className="sr-only">
              <FormattedMessage id="close" />
            </span>
          </GlassDialogClose>
        </GlassDialogHeader>

        <GlassDialogDescription />

        <div className="flex flex-col gap-4">
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

          {!isEdit ? <PresetButtonRow disabled={isSubmitting} presets={MCP_PRESETS} setValue={setValue} /> : null}

          <div className="flex flex-col gap-2">
            <FormFieldLabel htmlFor="transport" labelId="dialog.integration.transport" required />
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

          <div className="flex flex-col gap-2">
            <FormFieldLabel htmlFor="description" labelId="dialog.integration.description" />
            <Input id="description" {...register('description')} disabled={isSubmitting} />
          </div>

          <div className="flex flex-col gap-2">
            <FormFieldLabel htmlFor="toolName" labelId="dialog.integration.toolName" required />
            <Input
              id="toolName"
              {...register('toolName')}
              aria-required="true"
              disabled={isSubmitting}
              error={!!errors.toolName}
              errorHelper={errors.toolName?.message?.toString()}
              placeholder="auto"
            />
          </div>

          <div className="flex flex-col gap-2">
            <FormFieldLabel htmlFor="toolInputField" labelId="dialog.integration.toolInputField" />
            <Input id="toolInputField" {...register('toolInputField')} disabled={isSubmitting} placeholder="prompt" />
          </div>

          {transport === 'stdio' ? (
            <>
              <div className="flex flex-col gap-2">
                <FormFieldLabel htmlFor="command" labelId="dialog.integration.command" required />
                <Input
                  id="command"
                  {...register('command')}
                  aria-required="true"
                  disabled={isSubmitting}
                  error={!!errors.command}
                  errorHelper={errors.command?.message?.toString()}
                  placeholder="npx"
                />
              </div>

              <div className="flex flex-col gap-2">
                <FormFieldLabel htmlFor="args" labelId="dialog.integration.arguments" />
                <Textarea
                  id="args"
                  {...register('args')}
                  className="font-mono text-xs"
                  disabled={isSubmitting}
                  placeholder="-y @modelcontextprotocol/server-filesystem"
                  rows={2}
                />
              </div>

              <div className="flex flex-col gap-2">
                <FormFieldLabel htmlFor="env" labelId="dialog.integration.environmentVariables" />
                <Textarea
                  id="env"
                  {...register('env')}
                  className="font-mono text-xs"
                  disabled={isSubmitting}
                  placeholder="API_KEY=secret&#10;NODE_ENV=production"
                  rows={3}
                />
                <span className="text-xs text-muted-foreground">{KEY_VALUE_LINES_HELP_TEXT}</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                <FormFieldLabel htmlFor="serverUrl" labelId="dialog.integration.serverUrl" required />
                <Input
                  id="serverUrl"
                  {...register('serverUrl')}
                  aria-required="true"
                  disabled={isSubmitting}
                  error={!!errors.serverUrl}
                  errorHelper={errors.serverUrl?.message?.toString()}
                  placeholder="http://localhost:3100"
                />
              </div>

              <div className="flex flex-col gap-2">
                <FormFieldLabel htmlFor="headers" labelId="dialog.integration.headers" />
                <Textarea
                  id="headers"
                  {...register('headers')}
                  className="font-mono text-xs"
                  disabled={isSubmitting}
                  placeholder="Authorization=Bearer token&#10;X-API-Key=secret"
                  rows={3}
                />
                <span className="text-xs text-muted-foreground">{KEY_VALUE_LINES_HELP_TEXT}</span>
              </div>
            </>
          )}

          <div className="flex flex-col gap-2">
            <FormFieldLabel htmlFor="timeoutMs" labelId="dialog.integration.timeout" />
            <Input
              id="timeoutMs"
              type="number"
              {...register('timeoutMs', { valueAsNumber: true })}
              disabled={isSubmitting}
              placeholder="120000"
            />
          </div>
        </div>

        <GlassDialogFooter className="mt-4 flex justify-end gap-2">
          <Button disabled={isSubmitting} onClick={handleSubmit(onSubmit)} type="submit" variant="accent">
            <FormattedMessage id="save" />
          </Button>
          <GlassDialogClose asChild>
            <Button variant="default">
              <FormattedMessage id="cancel" />
            </Button>
          </GlassDialogClose>
        </GlassDialogFooter>
      </GlassDialogContent>
    </GlassDialog>
  )
}

export default MCPDialog
