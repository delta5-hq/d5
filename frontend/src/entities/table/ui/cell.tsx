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

const DateCell: React.FC<{ value: string }> = ({ value }) => <span>{new Date(Date.parse(value)).toLocaleString()}</span>

export { StringCell, DateCell }
