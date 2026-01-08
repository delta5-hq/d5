import { apiFetch } from '@shared/lib/base-api'
import { Card, CardContent } from '@shared/ui/card'
import { Loader2, Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import useFormattedTemplates from '../api/use-formatted-templates'
import type { TemplateItem } from '../model'
import {
  DESKTOP_OFFSET_WIDTH,
  MAX_CARDS,
  MIN_CARD_SIZE,
  MOBILE_MAXIMUM_WIDTH,
  MOBILE_OFFSET_WIDTH,
} from '@shared/config'
import { useWorkflowManage } from '@entities/workflow'
import { useNavigate } from 'react-router-dom'
import { FormattedMessage } from 'react-intl'

const calcCardCounter = (width: number) => Math.min(Math.round(width / MIN_CARD_SIZE), MAX_CARDS)

const getInitWidth = () => {
  const windowsWidth = window.innerWidth
  return windowsWidth - (windowsWidth <= MOBILE_MAXIMUM_WIDTH ? MOBILE_OFFSET_WIDTH : DESKTOP_OFFSET_WIDTH)
}

const TemplateCard = ({ template }: { template: TemplateItem }) => {
  const imageUrlRef = useRef(template.picture)
  const [isLoading, setIsLoading] = useState(false)
  const { createFromTemplate } = useWorkflowManage()
  const navigate = useNavigate()

  useEffect(() => {
    const fetchBackgroundImage = async () => {
      if (template.backgroundImage) {
        setIsLoading(true)
        const response = await apiFetch<Blob>(`/templates/${template._id}/images/${template.backgroundImage}`)
        const url = URL.createObjectURL(response)
        imageUrlRef.current = url
        setIsLoading(false)
      }
    }
    fetchBackgroundImage()

    return () => {
      if (imageUrlRef.current && imageUrlRef.current !== template.picture) {
        URL.revokeObjectURL(imageUrlRef.current)
      }
    }
  }, [template])

  const onCreate = (id: string) => async () => {
    const { workflowId } = await createFromTemplate({ templateId: id })
    navigate(`/workflow/${workflowId}`)
  }

  return (
    <Card
      className="bg-card rounded-lg border overflow-hidden p-0 cursor-pointer transform transition duration-300 hover:scale-101 hover:shadow-lg"
      glassEffect={false}
      onClick={onCreate(template._id)}
    >
      {isLoading ? (
        <Loader2 className="animate-spin" />
      ) : (
        <img
          alt={template.name}
          className={`w-full ${template.properties?.imageFit === 'cover' ? 'object-cover' : 'object-contain'} h-[150px] bg-gray-100`}
          src={imageUrlRef.current}
        />
      )}
      <CardContent className="p-3">
        <p className="text-left">{template.properties?.shownName || template.name || <>&nbsp;</>}</p>
      </CardContent>
    </Card>
  )
}

export const WorkflowTemplates = () => {
  const containerRef = useRef<HTMLDivElement>(null)
  const { data } = useFormattedTemplates()
  const [, forceRerender] = useState({})
  const { createEmpty } = useWorkflowManage()
  const navigate = useNavigate()

  const shownCards = calcCardCounter(containerRef.current?.offsetWidth || getInitWidth())

  useEffect(() => {
    const refreshShownCards = () => forceRerender({})
    window.addEventListener('resize', refreshShownCards)
    return () => window.removeEventListener('resize', refreshShownCards)
  }, [])

  const onCreateEmpty = async () => {
    const { workflowId } = await createEmpty()
    navigate(`/workflow/${workflowId}`)
  }

  return (
    <Card className="flex flex-col flex-1 p-6 md:p-8" glassEffect>
      <h1 className="text-3xl font-bold text-center mb-6">
        <FormattedMessage id="workflowTemplates" />
      </h1>
      <div
        className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-8 auto-rows-fr"
        ref={containerRef}
      >
        <Card
          className="aspect-square flex justify-center items-center bg-card rounded-lg border p-0 cursor-pointer transform transition duration-300 hover:scale-101 hover:shadow-lg"
          glassEffect
          onClick={onCreateEmpty}
        >
          <CardContent className="flex justify-center items-center flex-col ">
            <Plus className="w-8 h-8" />
            <p className="text-left text-base">
              <FormattedMessage id="emptyWorkflow" />
            </p>
          </CardContent>
        </Card>
        {data.slice(0, shownCards).map(template => (
          <TemplateCard key={template._id} template={template} />
        ))}
      </div>
    </Card>
  )
}
