import { zodResolver } from '@hookform/resolvers/zod'
import { X } from 'lucide-react'
import React from 'react'
import { useForm } from 'react-hook-form'
import { FormattedMessage } from 'react-intl'
import { z } from 'zod'

import type { ApiError, Claude, DialogProps, LLMSecretMetadata } from '@shared/base-types'
import { useApiMutation } from '@shared/composables'
import { CLAUDE_DEFAULT_MODEL, ClaudeModels } from '@shared/config'
import { createResponseClaude, getClaudeMaxOutput } from '@shared/lib/llm'
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
import { Label } from '@shared/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/ui/select'
import { toast } from 'sonner'
import type { HttpError } from '@shared/lib/error'
import { buildIntegrationUrl } from '../utils/build-integration-url'

const claudeSchema = z.object({
  apiKey: z.string().optional(),
  model: z.nativeEnum(ClaudeModels, {
    errorMap: () => ({ message: 'Please select a model' }),
  }),
})

type ClaudeFormValues = z.infer<typeof claudeSchema>

interface Props extends DialogProps {
  data: Claude | undefined
  secretMeta?: LLMSecretMetadata
  refresh: () => Promise<void>
  workflowId?: string | null
}

export const ClaudeDialog: React.FC<Props> = ({ data, secretMeta, open, onClose, refresh, workflowId }) => {
  const url = buildIntegrationUrl('/integration/claude/update', workflowId)

  const { mutateAsync: save } = useApiMutation<Claude, HttpError, Claude>({
    url,
    method: 'PUT',
    onSuccess: () => toast.success(<FormattedMessage id="dialog.integration.saveSuccess" />),
    onError: (err: Error) => toast.error(err.message || 'Server error'),
  })

  const form = useForm<ClaudeFormValues>({
    resolver: zodResolver(claudeSchema),
    defaultValues: {
      apiKey: '',
      model: (data?.model as ClaudeModels) || CLAUDE_DEFAULT_MODEL,
    },
  })

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = form

  const onSubmit = async (values: ClaudeFormValues) => {
    try {
      const apiKeyProvided = !!values.apiKey?.trim()
      const modelChanged = values.model.trim() !== data?.model

      const payload: Partial<Claude> = {}
      if (apiKeyProvided) {
        payload.apiKey = values.apiKey
      }
      if (modelChanged || data?.model === undefined) {
        payload.model = values.model
      }

      if (Object.keys(payload).length === 0) {
        onClose?.()
        return
      }

      if (apiKeyProvided) {
        await createResponseClaude(
          {
            model: values.model,
            messages: [{ role: 'user', content: 'Hello, world!' }],
            max_tokens: getClaudeMaxOutput(values.model),
          },
          values.apiKey!,
        )
      }

      await save(payload as Claude)
      await refresh()
      onClose?.()
    } catch (e: unknown) {
      const error = e as ApiError
      const status = error?.response?.status

      if (status === 401) {
        toast.error(<FormattedMessage id="dialog.integration.authenticationError" />)
      } else if (status === 429) {
        toast.error(<FormattedMessage id="dialog.integration.rateLimitExceeded" />)
      } else if (status === 404) {
        toast.error(<FormattedMessage id="dialog.integration.noAccess" values={{ model: values.model }} />)
      } else {
        toast.error(<FormattedMessage id="dialog.integration.wrongRequest" />)
      }
    }
  }

  return (
    <GlassDialog onOpenChange={state => !state && onClose?.()} open={open}>
      <GlassDialogContent className="sm:max-w-lg" data-dialog-name="claude" dismissible={false}>
        <GlassDialogHeader>
          <GlassDialogTitle>
            <FormattedMessage id="integration.claude.title" />
          </GlassDialogTitle>
          <GlassDialogClose className="absolute right-4 top-4">
            <X className="h-4 w-4" />
          </GlassDialogClose>
        </GlassDialogHeader>

        <GlassDialogDescription />

        <div>
          <Label htmlFor="apiKey">
            <FormattedMessage id="dialog.integration.apiKey" />
            {secretMeta?.apiKey ? <span className="text-sm text-muted-foreground ml-2">(already set)</span> : null}
          </Label>
          <Input
            {...register('apiKey')}
            disabled={isSubmitting}
            error={!!errors.apiKey}
            errorHelper={errors.apiKey?.message?.toString()}
            id="apiKey"
            placeholder={secretMeta?.apiKey ? '••••••••••••••••' : 'Enter API key'}
            type="password"
          />
        </div>

        <div>
          <Label htmlFor="model">
            <FormattedMessage id="dialog.integration.model" />
          </Label>
          <Select
            disabled={isSubmitting}
            onValueChange={(val: ClaudeModels) => setValue('model', val)}
            value={watch('model')}
          >
            <SelectTrigger data-select-name="claude-model">
              <SelectValue placeholder="Select model" />
            </SelectTrigger>
            <SelectContent>
              {Object.values(ClaudeModels).map(model => (
                <SelectItem key={model} value={model}>
                  {model}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
