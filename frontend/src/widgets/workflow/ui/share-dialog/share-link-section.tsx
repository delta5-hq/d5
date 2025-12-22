import React, { useState } from 'react'
import { QRCodeDisplay } from '@shared/ui/qr-code-display'
import { Button } from '@shared/ui/button'
import { Input } from '@shared/ui/input'
import { QrCode, Copy, Check } from 'lucide-react'
import { FormattedMessage, useIntl } from 'react-intl'
import { cn } from '@shared/lib/utils'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@shared/ui/collapsible'

interface ShareLinkSectionProps {
  url: string
  autoCopy?: boolean
  className?: string
}

export const ShareLinkSection: React.FC<ShareLinkSectionProps> = ({ url, autoCopy = false, className }) => {
  const [showQR, setShowQR] = useState(false)
  const [copied, setCopied] = useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const { formatMessage } = useIntl()

  React.useEffect(() => {
    if (inputRef.current) {
      inputRef.current.select()
    }
  }, [])

  const handleCopy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* Clipboard access failed */
    }
  }, [url])

  React.useEffect(() => {
    if (autoCopy && url) {
      handleCopy()
    }
  }, [autoCopy, url, handleCopy])

  const handleInputClick = () => {
    if (inputRef.current) {
      inputRef.current.select()
    }
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div>
        <label className="text-sm font-medium mb-2 block">
          <FormattedMessage id="shareLink" />
        </label>
        <div className="flex items-center gap-2 w-full">
          <Input
            className="flex-1 font-mono text-sm min-w-0"
            onClick={handleInputClick}
            readOnly
            ref={inputRef}
            type="text"
            value={url}
          />
          <Button
            className="shrink-0"
            onClick={handleCopy}
            size="sm"
            title={formatMessage({ id: copied ? 'copied' : 'copy' })}
            variant="default"
          >
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
          </Button>
          <Collapsible onOpenChange={setShowQR} open={showQR}>
            <CollapsibleTrigger asChild>
              <Button className="shrink-0" size="sm" variant="default">
                <QrCode className="h-4 w-4" />
              </Button>
            </CollapsibleTrigger>
          </Collapsible>
        </div>
      </div>

      <Collapsible onOpenChange={setShowQR} open={showQR}>
        <CollapsibleContent>
          <div className="flex justify-center py-4 border-t border-card-foreground/10">
            <QRCodeDisplay size={180} url={url} />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
