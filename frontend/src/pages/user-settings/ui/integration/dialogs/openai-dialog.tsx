import { zodResolver } from '@hookform/resolvers/zod'
import * as React from 'react'
import { useForm } from 'react-hook-form'
import { FormattedMessage } from 'react-intl'

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

import type { ApiError, DialogProps, Openai } from '@shared/base-types'
import { useApiMutation, useApiQuery } from '@shared/composables'
import { OpenaiModels, queryKeys } from '@shared/config'
import { createResponseChat } from '@shared/lib/llm'
import { objectsAreEqual } from '@shared/lib/objectsAreEqual'
import { z } from 'zod'
import type { HttpError } from '@shared/lib/error'
import { X } from 'lucide-react'

export const openaiSchema = z.object({
  apiKey: z.string().optional(),
  model: z.nativeEnum(OpenaiModels, {
    errorMap: () => ({ message: 'Please select a model' }),
  }),
})

export type OpenaiFormValues = z.infer<typeof openaiSchema>

interface Props extends DialogProps {
  data: Openai | undefined
  refresh: () => Promise<void>
}

const OpenaiDialog: React.FC<Props> = ({ open, onClose, refresh, data }) => {
  const { mutateAsync: save } = useApiMutation<Openai, HttpError, Openai>({
    url: '/integration/openai/update',
    method: 'PUT',
    onSuccess: () => toast.success(<FormattedMessage id="dialog.integration.saveSuccess" />),
    onError: (err: Error) => {
      const { message } = err
      if (message) toast.error(message)
      else toast.error(<FormattedMessage id="errorServer" />)
    },
  })

  const { data: apiStatus } = useApiQuery<{ success: boolean }>({
    queryKey: queryKeys.openaiStatus,
    url: '/integration/openai_api_key',
  })

  const form = useForm<OpenaiFormValues>({
    resolver: zodResolver(openaiSchema),
    defaultValues: {
      apiKey: data?.apiKey || '',
      model: (data?.model as OpenaiModels) || OpenaiModels.GPT_4o_MINI,
    },
  })

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = form

  const apiKeyValue = watch('apiKey')

  const onSubmit = async (values: OpenaiFormValues) => {
    try {
      const apiKeyChanged = values.apiKey && values.apiKey.trim() !== data?.apiKey && values.apiKey
      const modelChanged = values.model.trim() !== data?.model

      if (apiKeyChanged || modelChanged) {
        await createResponseChat('Hello!', values)
        await save(values)
      } else if (!objectsAreEqual(values, data || {})) {
        await save(values)
      }

      await refresh()
      onClose?.()
    } catch (e: unknown) {
      const error = e as ApiError
      const { status } = error.response || {}

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
    <Dialog onOpenChange={onClose} open={open}>
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

        <div className="flex flex-col gap-4">
          {/* API Key */}
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

          {/* Model */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="model">
              <FormattedMessage id="dialog.integration.model" />
            </Label>
            <Select
              disabled={isSubmitting}
              onValueChange={(val: OpenaiModels) => setValue('model', val)}
              value={watch('model')}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                {!apiStatus?.success || !apiKeyValue ? (
                  <SelectItem value={OpenaiModels.GPT_4o_MINI}>{OpenaiModels.GPT_4o_MINI}</SelectItem>
                ) : (
                  Object.values(OpenaiModels).map(m => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {errors.model ? <span className="text-sm text-destructive">{errors.model.message?.toString()}</span> : null}
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

export default OpenaiDialog
