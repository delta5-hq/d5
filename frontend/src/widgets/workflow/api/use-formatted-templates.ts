import { miscMapPicture } from '@shared/assets'
import type { Template } from '@shared/base-types'
import { useApiQuery } from '@shared/composables'
import { FORMATTED_TEMPLATE_LIST, queryKeys, type FormattedTemplate } from '@shared/config'
import { useMemo } from 'react'
import type { TemplateItem } from '../model'

const createFindTemplate = (templateDescription: FormattedTemplate) => (template: Template) =>
  templateDescription.prodId === template._id ||
  templateDescription.devId === template._id ||
  templateDescription.localhostIds.find(localId => localId === template._id)

/**
 * Order the specified templates and set pictures
 */
const extractTemplates = (array: Template[]): TemplateItem[] =>
  FORMATTED_TEMPLATE_LIST.map((templateDescription, index) => {
    const explicitTemplate = array.find(createFindTemplate(templateDescription))
    const baseTemplate = explicitTemplate || array[index] || { _id: Math.random() }

    if (explicitTemplate) {
      return {
        ...baseTemplate,
        properties: templateDescription.properties,
        picture: templateDescription.picture,
      }
    }
    return {
      ...baseTemplate,
      properties: {},
      ...(!baseTemplate.backgroundImage && { picture: miscMapPicture }),
    }
  })

const useFormattedTemplates = () => {
  const { data: templates = [], isFetching } = useApiQuery<Template[]>({
    queryKey: queryKeys.templates,
    url: '/templates',
    staleTime: 2,
  })

  const data = useMemo(() => extractTemplates(templates), [templates])

  return useMemo(() => ({ data, isFetching }), [data, isFetching])
}

export default useFormattedTemplates
