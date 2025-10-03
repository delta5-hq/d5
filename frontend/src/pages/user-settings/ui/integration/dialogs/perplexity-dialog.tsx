import { zodResolver } from '@hookform/resolvers/zod'
import { X } from 'lucide-react'
import React from 'react'
import { useForm } from 'react-hook-form'
import { FormattedMessage } from 'react-intl'
import { z } from 'zod'

import type { DialogProps, Perplexity } from '@shared/base-types'
import { useApiMutation } from '@shared/composables'
import { PERPLEXITY_DEFAULT_MODEL, PerplexityModels } from '@shared/config'
import type { HttpError } from '@shared/lib/error'
import { createPerplexityResponse } from '@shared/lib/llm'
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
import { toast } from 'sonner'

const perplexitySchema = z.object({
  apiKey: z.string().min(1, 'API Key is required'),
  model: z.nativeEnum(PerplexityModels, {
    errorMap: () => ({ message: 'Please select a model' }),
  }),
})

type PerplexityFormValues = z.infer<typeof perplexitySchema>

interface Props extends DialogProps {
  data: Perplexity | undefined
  refresh: () => Promise<void>
}

export const PerplexityDialog: React.FC<Props> = ({ data, open, onClose, refresh }) => {
  const { mutateAsync: save } = useApiMutation<Perplexity, HttpError, Perplexity>({
    url: '/integration/perplexity/update',
    method: 'PUT',
    onSuccess: () => toast.success(<FormattedMessage id="dialog.integration.saveSuccess" />),
    onError: (err: Error) => toast.error(err.message || 'Server error'),
  })

  const form = useForm<PerplexityFormValues>({
    resolver: zodResolver(perplexitySchema),
    defaultValues: {
      apiKey: data?.apiKey || '',
      model: (data?.model as PerplexityModels) || PERPLEXITY_DEFAULT_MODEL,
    },
  })

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { isSubmitting, errors },
  } = form

  const onSubmit = async (values: PerplexityFormValues) => {
    try {
      const apiKeyChanged = values.apiKey !== data?.apiKey
      const modelChanged = values.model !== data?.model

      if (apiKeyChanged || modelChanged) {
        await createPerplexityResponse(
          'Hello!',
          {
            apiKey: values.apiKey,
            model: values.model,
          },
          { maxRetries: 0 },
        )
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
    <Dialog onOpenChange={state => !state && onClose?.()} open={open}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            <FormattedMessage id="integration.perplexity.title" />
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
            onValueChange={(val: PerplexityModels) => setValue('model', val)}
            value={watch('model')}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select model" />
            </SelectTrigger>
            <SelectContent>
              {Object.values(PerplexityModels).map(model => (
                <SelectItem key={model} value={model}>
                  {model}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
