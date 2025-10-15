import React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { FormattedMessage } from 'react-intl'
import { toast } from 'sonner'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@shared/ui/dialog'
import { Input } from '@shared/ui/input'
import { Label } from '@shared/ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@shared/ui/select'
import { Button } from '@shared/ui/button'

import { useApiMutation } from '@shared/composables'
import type { CustomLLM, DialogProps } from '@shared/base-types'
import type { HttpError } from '@shared/lib/error'
import { CustomLLMApiType, OPENAI_API_KEY_EMPTY } from '@shared/config'
import { objectsAreEqual } from '@shared/lib/objectsAreEqual'

import isUrl from '@shared/lib/isUrl'
import { OpenAI } from '@langchain/openai'
import { HumanMessage } from '@langchain/core/messages'
import { X } from 'lucide-react'

const customLLMSchema = z.object({
  apiType: z.nativeEnum(CustomLLMApiType, { errorMap: () => ({ message: 'API Type is required' }) }),
  apiKey: z.string().optional(),
  apiRootUrl: z.string().min(1, 'API Root URL is required').refine(isUrl, 'Invalid URL'),
  maxTokens: z.number().min(1, 'Max tokens must be positive'),
  embeddingsChunkSize: z.number().min(1, 'Chunk size must be positive'),
})

type CustomLLMFormValues = z.infer<typeof customLLMSchema>

interface CustomLLMDialogProps extends DialogProps {
  data: CustomLLM | undefined
  refresh: () => Promise<void>
}

export const CustomLLMDialog: React.FC<CustomLLMDialogProps> = ({ data, open, onClose, refresh }) => {
  const { mutateAsync: save } = useApiMutation<CustomLLM, HttpError, CustomLLM>({
    url: '/integration/custom_llm/update',
    method: 'PUT',
    onSuccess: () => toast.success(<FormattedMessage id="dialog.integration.saveSuccess" />),
    onError: err => toast.error(err?.message || 'Server error'),
  })

  const form = useForm<CustomLLMFormValues>({
    resolver: zodResolver(customLLMSchema),
    defaultValues: {
      apiType: (data?.apiType as CustomLLMApiType) || CustomLLMApiType.OpenAI_Compatible,
      apiKey: data?.apiKey || '',
      apiRootUrl: data?.apiRootUrl || '',
      maxTokens: data?.maxTokens || 30000,
      embeddingsChunkSize: data?.embeddingsChunkSize || 2048,
    },
  })

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { isSubmitting, errors },
  } = form

  const onSubmit = async (values: CustomLLMFormValues) => {
    try {
      const urlChanged = values.apiRootUrl !== data?.apiRootUrl
      const apiKeyChanged = values.apiKey !== data?.apiKey

      if (urlChanged || apiKeyChanged) {
        const client = new OpenAI({
          openAIApiKey: values.apiKey || OPENAI_API_KEY_EMPTY,
          configuration: {
            baseURL: values.apiRootUrl,
          },
        })

        await client.invoke([new HumanMessage('Hello!')])

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
      } else {
        toast.error(<FormattedMessage id="dialog.integration.wrongRequest" />)
      }
    }
  }

  return (
    <Dialog onOpenChange={onClose} open={open}>
      <DialogContent className="sm:max-w-lg" data-dialog-name="custom_llm">
        <DialogHeader>
          <DialogTitle>
            <FormattedMessage id="integration.custom_llm.title" />
          </DialogTitle>
          <DialogClose className="absolute right-4 top-4">
            <X className="h-4 w-4" />
          </DialogClose>
        </DialogHeader>

        <DialogDescription>
          <FormattedMessage id="customLLMHint" />
        </DialogDescription>
        {/* API Type */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="apiType">
            <FormattedMessage id="apiType" />
          </Label>
          <Select
            disabled={isSubmitting}
            onValueChange={(val: CustomLLMApiType) => setValue('apiType', val)}
            value={watch('apiType')}
          >
            <SelectTrigger data-select-name="custom_llm-model">
              <SelectValue placeholder="Select API Type" />
            </SelectTrigger>
            <SelectContent>
              {Object.values(CustomLLMApiType).map(type => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

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

        {/* API Root URL */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="apiRootUrl">
            <FormattedMessage id="apiRootUrl" />
          </Label>
          <Input
            id="apiRootUrl"
            {...register('apiRootUrl')}
            disabled={isSubmitting}
            error={!!errors.apiRootUrl}
            errorHelper={errors.apiRootUrl?.message?.toString()}
          />
        </div>

        {/* maxTokens */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="maxTokens">
            <FormattedMessage id="maxTokens" />
          </Label>
          <Input
            id="maxTokens"
            type="number"
            {...register('maxTokens', { valueAsNumber: true })}
            disabled={isSubmitting}
            error={!!errors.maxTokens}
            errorHelper={errors.maxTokens?.message?.toString()}
          />
        </div>

        {/* embeddingsChunkSize */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="embeddingsChunkSize">
            <FormattedMessage id="embeddingsChunkSize" />
          </Label>
          <Input
            id="embeddingsChunkSize"
            type="number"
            {...register('embeddingsChunkSize', { valueAsNumber: true })}
            disabled={isSubmitting}
            error={!!errors.embeddingsChunkSize}
            errorHelper={errors.embeddingsChunkSize?.message?.toString()}
          />
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

export default CustomLLMDialog
