import React, { useState } from 'react'
import { Tooltip, TooltipTrigger, TooltipContent } from '@shared/ui/tooltip'
import { Button } from '@shared/ui/button'
import { Copy } from 'lucide-react'
import { useIntl } from 'react-intl'

interface ClickToCopyProps {
  text: string
  hideIcon?: boolean
  className?: string
}

const ClickToCopy: React.FC<ClickToCopyProps> = ({ text, hideIcon = false, className = '' }) => {
  const [copied, setCopied] = useState(false)
  const [tooltipOpen, setTooltipOpen] = useState(false)
  const { formatMessage } = useIntl()

  const handleCopy = async (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation()
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTooltipOpen(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Tooltip onOpenChange={setTooltipOpen} open={tooltipOpen}>
      <TooltipTrigger asChild>
        <span
          className={`inline-flex items-center cursor-pointer underline ${className || 'text-sm'}`}
          onClick={handleCopy}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') handleCopy(e)
          }}
          role="button"
          tabIndex={0}
        >
          <span className={hideIcon ? '' : 'mr-2'}>{text}</span>
          {hideIcon ? null : (
            <Button className="!p-0 !h-4" size="sm" variant="ghost">
              <Copy className="w-4 h-4 p-0" />
            </Button>
          )}
        </span>
      </TooltipTrigger>
      <TooltipContent sideOffset={4}>{formatMessage({ id: copied ? 'copied' : 'copy' })}</TooltipContent>
    </Tooltip>
  )
}

export default ClickToCopy
