import type React from 'react'

const StringCell: React.FC<{ value: string }> = ({ value }) => {
  const ind = value.indexOf('@')
  if (value.length > 15 && ind > 14) {
    return (
      <span>
        {value.substring(0, ind)}
        <br />
        {value.substring(ind)}
      </span>
    )
  }
  return <span>{value}</span>
}

const DateCell: React.FC<{ value?: string | null }> = ({ value }) => {
  if (!value) return <span>-</span>

  const date = new Date(value)
  if (isNaN(date.getTime())) return <span>-</span>

  return <span>{date.toLocaleString()}</span>
}

const RoleCell = ({ value }: { value?: boolean }) => (value ? '✓' : '✖')

const FieldsOfWorkCell = ({ value }: { value?: Record<string, string> }) => {
  if (!value) return '-'

  const filteredValues = Object.values(value).filter(v => v && v.trim() !== '')
  return filteredValues.length > 0 ? filteredValues.join(', ') : '-'
}

const NumberCell = ({ value }: { value?: number }) => ((value ?? value === 0) ? value : '-')

export { StringCell, DateCell, RoleCell, FieldsOfWorkCell, NumberCell }
