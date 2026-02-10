export interface ClipboardProps {
  size?: number
  fillColor?: string
  edgeColor?: string
  edgeWidth?: number
  cornerRadius?: number
}

export const Clipboard = ({
  size = 100,
  fillColor = '#f5f5f5',
  edgeColor = '#333',
  edgeWidth = 2,
  cornerRadius = 4,
}: ClipboardProps) => {
  /* Clipboard occupies lower 2/3 of image per Issue #336 */
  const clipboardTop = size / 3
  const clipboardHeight = (size * 2) / 3 - edgeWidth
  const clipboardWidth = size * 0.65
  const clipWidth = clipboardWidth * 0.3
  const clipHeight = clipboardHeight * 0.1
  const clipboardX = (size - clipboardWidth) / 2

  return (
    <svg height={size} style={{ position: 'absolute', top: 0, left: 0 }} viewBox={`0 0 ${size} ${size}`} width={size}>
      <g transform={`translate(${clipboardX}, ${clipboardTop})`}>
        {/* Clipboard surface */}
        <rect
          fill={fillColor}
          height={clipboardHeight}
          rx={cornerRadius}
          stroke={edgeColor}
          strokeWidth={edgeWidth}
          width={clipboardWidth}
          x={0}
          y={0}
        />
        {/* Clip at top center */}
        <rect
          fill={edgeColor}
          height={clipHeight}
          rx={cornerRadius / 2}
          width={clipWidth}
          x={(clipboardWidth - clipWidth) / 2}
          y={-clipHeight / 2}
        />
      </g>
    </svg>
  )
}
