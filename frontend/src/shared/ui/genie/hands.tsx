export interface HandsProps {
  size?: number
  fillColor?: string
  showRibs?: boolean
}

export const Hands = ({ size = 100, fillColor = '#ffa726', showRibs = false }: HandsProps) => {
  /* Match clipboard positioning from clipboard.tsx */
  const clipboardTop = size / 3
  const clipboardWidth = size * 0.65
  const clipboardX = (size - clipboardWidth) / 2

  /* Hands grip at clipboard midpoint vertically */
  const handY = clipboardTop + size / 3
  const handRadius = size * 0.09

  /* Symmetrical positioning at clipboard edges */
  const leftHandX = clipboardX
  const rightHandX = clipboardX + clipboardWidth

  return (
    <svg height={size} style={{ position: 'absolute', top: 0, left: 0 }} viewBox={`0 0 ${size} ${size}`} width={size}>
      {/* Left hand */}
      <ellipse cx={leftHandX} cy={handY} fill={fillColor} rx={handRadius} ry={handRadius * 1.3} />
      {showRibs === true ? (
        <g opacity={0.5} stroke="#000" strokeLinecap="round" strokeWidth={1}>
          <line
            x1={leftHandX - handRadius * 0.5}
            x2={leftHandX + handRadius * 0.3}
            y1={handY - handRadius * 0.4}
            y2={handY - handRadius * 0.4}
          />
          <line x1={leftHandX - handRadius * 0.5} x2={leftHandX + handRadius * 0.3} y1={handY} y2={handY} />
          <line
            x1={leftHandX - handRadius * 0.5}
            x2={leftHandX + handRadius * 0.3}
            y1={handY + handRadius * 0.4}
            y2={handY + handRadius * 0.4}
          />
        </g>
      ) : null}

      {/* Right hand */}
      <ellipse cx={rightHandX} cy={handY} fill={fillColor} rx={handRadius} ry={handRadius * 1.3} />
      {showRibs === true ? (
        <g opacity={0.5} stroke="#000" strokeLinecap="round" strokeWidth={1}>
          <line
            x1={rightHandX - handRadius * 0.3}
            x2={rightHandX + handRadius * 0.5}
            y1={handY - handRadius * 0.4}
            y2={handY - handRadius * 0.4}
          />
          <line x1={rightHandX - handRadius * 0.3} x2={rightHandX + handRadius * 0.5} y1={handY} y2={handY} />
          <line
            x1={rightHandX - handRadius * 0.3}
            x2={rightHandX + handRadius * 0.5}
            y1={handY + handRadius * 0.4}
            y2={handY + handRadius * 0.4}
          />
        </g>
      ) : null}
    </svg>
  )
}
