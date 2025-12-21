import React, { useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { Button } from '@shared/ui/button'
import { Download } from 'lucide-react'
import { cn } from '@shared/lib/utils'
import { useIntl } from 'react-intl'

interface QRCodeDisplayProps {
  url: string
  size?: number
  downloadable?: boolean
  className?: string
}

export const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({ url, size = 200, downloadable = true, className }) => {
  const { formatMessage } = useIntl()
  const [isDownloading, setIsDownloading] = useState(false)

  const handleDownload = () => {
    setIsDownloading(true)
    try {
      const canvas = document.querySelector('canvas[data-qr-code]') as HTMLCanvasElement
      if (!canvas) return

      canvas.toBlob(blob => {
        if (!blob) return

        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = 'workflow-qr-code.png'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
        setIsDownloading(false)
      })
    } catch {
      setIsDownloading(false)
    }
  }

  return (
    <div className={cn('flex flex-col items-center gap-4', className)}>
      <div className="p-4 bg-white rounded-lg shadow-sm">
        <QRCodeCanvas data-qr-code level="H" size={size} value={url} />
      </div>
      {downloadable ? (
        <Button disabled={isDownloading} onClick={handleDownload} size="sm" variant="default">
          <Download className="h-4 w-4 mr-2" />
          {formatMessage({ id: 'downloadQRCode' })}
        </Button>
      ) : null}
    </div>
  )
}
