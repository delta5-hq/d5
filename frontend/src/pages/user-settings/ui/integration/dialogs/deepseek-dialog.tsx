import React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { FormattedMessage } from 'react-intl'
import { toast } from 'sonner'

import {
  GlassDialog,
  GlassDialogContent,
  GlassDialogHeader,
  GlassDialogFooter,
  GlassDialogTitle,
  GlassDialogDescription,
  GlassDialogClose,
} from '@shared/ui/glass-dialog'
import { Input } from '@shared/ui/input'
import { Label } from '@shared/ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@shared/ui/select'
import { Button } from '@shared/ui/button'
import { useApiMutation } from '@shared/composables'
import type { Deepseek, DialogProps } from '@shared/base-types'
import type { HttpError } from '@shared/lib/error'
import { buildIntegrationUrl } from '../utils/build-integration-url'
import { DEEPSEEK_DEFAULT_MODEL, DeepseekModels } from '@shared/config'
import { objectsAreEqual } from '@shared/lib/objectsAreEqual'
import { createResponseDeepseek } from '@shared/lib/llm'
import { X } from 'lucide-react'

const deepseekSchema = z.object({
  apiKey: z.string().min(1, 'API Key is required'),
  model: z.nativeEnum(DeepseekModels, {
    errorMap: () => ({ message: 'Please select a model' }),
  }),
})

type DeepseekFormValues = z.infer<typeof deepseekSchema>

interface DeepseekDialogProps extends DialogProps {
  data: Deepseek | undefined
  refresh: () => Promise<void>
  workflowId?: string | null
}

export const DeepseekDialog: React.FC<DeepseekDialogProps> = ({ data, open, onClose, refresh, workflowId }) => {
  const url = buildIntegrationUrl('/integration/deepseek/update', workflowId)

  const { mutateAsync: save } = useApiMutation<Deepseek, HttpError, Deepseek>({
    url,
    method: 'PUT',
    onSuccess: () => toast.success(<FormattedMessage id="dialog.integration.saveSuccess" />),
    onError: (err: Error) => toast.error(err?.message || 'Server error'),
  })

  const form = useForm<DeepseekFormValues>({
    resolver: zodResolver(deepseekSchema),
    defaultValues: {
      apiKey: data?.apiKey || '',
      model: (data?.model as DeepseekModels) || DEEPSEEK_DEFAULT_MODEL,
    },
  })

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { isSubmitting, errors },
  } = form

  const onSubmit = async (values: DeepseekFormValues) => {
    try {
      const apiKeyChanged = values.apiKey.trim() !== data?.apiKey
      const modelChanged = values.model.trim() !== data?.model

      if (apiKeyChanged || modelChanged) {
        await createResponseDeepseek('Hello!', values)
        await save(values)
      } else if (!objectsAreEqual(values, data || {})) {
        await save(values)
      }

      await refresh()
      onClose?.()
    } catch (e: unknown) {
      const error = e as HttpError
      const status = error?.response?.status

      if (status === 401) {
        toast.error(<FormattedMessage id="dialog.integration.authenticationError" />)
      } else if (status === 429) {
        toast.error(<FormattedMessage id="dialog.integration.rateLimitExceeded" />)
      } else if (status === 404) {
        toast.error(<FormattedMessage id="dialog.integration.noAccess" values={{ model: values.model }} />)
      } else if (status === 503) {
        toast.error(<FormattedMessage id="dialog.integration.serverError" />)
      } else {
        toast.error(<FormattedMessage id="dialog.integration.wrongRequest" />)
      }
    }
  }

  return (
    <GlassDialog onOpenChange={onClose} open={open}>
      <GlassDialogContent className="sm:max-w-lg" data-dialog-name="deepseek" dismissible={false}>
        <GlassDialogHeader>
          <GlassDialogTitle>
            <FormattedMessage id="integration.deepseek.title" />
          </GlassDialogTitle>
          <GlassDialogClose className="absolute right-4 top-4">
            <X className="h-4 w-4" />
          </GlassDialogClose>
        </GlassDialogHeader>

        <GlassDialogDescription />

        <div className="flex flex-col gap-2">
          <Label htmlFor="apiKey">
            <FormattedMessage id="dialog.integration.apiKey" />
          </Label>
          <Input
            id="apiKey"
            {...register('apiKey')}
            disabled={isSubmitting}
            error={!!errors.apiKey}
            errorHelper={errors.apiKey?.message?.toString()}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="model">
            <FormattedMessage id="dialog.integration.model" />
          </Label>
          <Select
            disabled={isSubmitting}
            onValueChange={(val: DeepseekModels) => setValue('model', val)}
            value={watch('model')}
          >
            <SelectTrigger data-select-name="deepseek-model">
              <SelectValue placeholder="Select model" />
            </SelectTrigger>
            <SelectContent>
              {Object.values(DeepseekModels).map(model => (
                <SelectItem key={model} value={model}>
                  {model}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.model ? <span className="text-sm text-destructive">{errors.model.message}</span> : null}
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
