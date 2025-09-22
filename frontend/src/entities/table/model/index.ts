import type React from 'react'

export interface Column<T> {
  id: keyof T
  label: string
  Cell?: React.FC<{ value: T[keyof T]; row: T }>
}
