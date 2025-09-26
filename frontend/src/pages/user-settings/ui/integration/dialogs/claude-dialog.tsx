import { zodResolver } from '@hookform/resolvers/zod'
import { X } from 'lucide-react'
import React from 'react'
import { useForm } from 'react-hook-form'
import { FormattedMessage } from 'react-intl'
import { z } from 'zod'

import type { ApiError, Claude, DialogProps } from '@shared/base-types'
import { useApiMutation } from '@shared/composables'
import { CLAUDE_DEFAULT_MODEL, ClaudeModels } from '@shared/config'
import { createResponseClaude, getClaudeMaxOutput } from '@shared/lib/llm'
import { objectsAreEqual } from '@shared/lib/objectsAreEqual'
import { Button } from '@shared/ui/button'
import { Checkbox } from '@shared/ui/checkbox'
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
import { toast } from 'sonner'
import type { HttpError } from '@shared/lib/error'

const claudeSchema = z.object({
  apiKey: z.string().min(1, 'API Key is required'),
  model: z.nativeEnum(ClaudeModels, {
    errorMap: () => ({ message: 'Please select a model' }),
  }),
  useApi: z.boolean(),
})

type ClaudeFormValues = z.infer<typeof claudeSchema>

interface Props extends DialogProps {
  data: Claude | undefined
  refresh: () => Promise<void>
}

export const ClaudeDialog: React.FC<Props> = ({ data, open, onClose, refresh }) => {
  const { mutateAsync: save } = useApiMutation<Claude, HttpError, Claude>({
    url: '/integration/claude/update',
    method: 'PUT',
    onSuccess: () => toast.success(<FormattedMessage id="dialog.integration.saveSuccess" />),
    onError: (err: Error) => toast.error(err.message || 'Server error'),
  })

  const form = useForm<ClaudeFormValues>({
    resolver: zodResolver(claudeSchema),
    defaultValues: {
      apiKey: data?.apiKey || '',
      model: (data?.model as ClaudeModels) || CLAUDE_DEFAULT_MODEL,
      useApi: data?.useApi || false,
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
      const apiKeyChanged = values.apiKey.trim() !== data?.apiKey
      const modelChanged = values.model.trim() !== data?.model

      if (apiKeyChanged || modelChanged) {
        await createResponseClaude(
          {
            model: values.model,
            messages: [{ role: 'user', content: 'Hello, world!' }],
            max_tokens: getClaudeMaxOutput(values.model),
          },
          values.apiKey,
        )
        await save(values)
      } else if (!objectsAreEqual(values, data)) {
        await save(values)
      }

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
    <Dialog onOpenChange={state => !state && onClose?.()} open={open}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            <FormattedMessage id="dialog.integration.title" />
          </DialogTitle>
          <DialogClose className="absolute right-4 top-4">
            <X className="h-4 w-4" />
          </DialogClose>
        </DialogHeader>

        <DialogDescription />

        <div>
          <Label htmlFor="apiKey">
            <FormattedMessage id="dialog.integration.apiKey" />
          </Label>
          <Input
            {...register('apiKey')}
            disabled={isSubmitting}
            error={!!errors.apiKey}
            errorHelper={errors.apiKey?.message?.toString()}
            id="apiKey"
            required
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
            <SelectTrigger>
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

        <div className="flex items-center space-x-2">
          <Checkbox
            checked={watch('useApi')}
            disabled={isSubmitting}
            id="useApi"
            onCheckedChange={checked => setValue('useApi', !!checked)}
          />
          <Label htmlFor="useApi">
            <FormattedMessage id="dialog.integration.useApi" />
          </Label>
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
