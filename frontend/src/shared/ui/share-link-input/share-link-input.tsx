import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Input } from '@shared/ui/input'
import { Button } from '@shared/ui/button'
import { Copy, Check } from 'lucide-react'
import { cn } from '@shared/lib/utils'
import { useIntl } from 'react-intl'

interface ShareLinkInputProps {
  url: string
  autoCopy?: boolean
  autoSelect?: boolean
  onCopied?: () => void
  className?: string
}

export const ShareLinkInput: React.FC<ShareLinkInputProps> = ({
  url,
  autoCopy = false,
  autoSelect = true,
  onCopied,
  className,
}) => {
  const [copied, setCopied] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { formatMessage } = useIntl()

  useEffect(() => {
    if (autoSelect && inputRef.current) {
      inputRef.current.select()
    }
  }, [autoSelect])

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      onCopied?.()
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* Clipboard access failed */
    }
  }, [url, onCopied])

  useEffect(() => {
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
    <div className={cn('flex items-center gap-2 w-full', className)}>
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
    </div>
  )
}
