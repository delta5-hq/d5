import { createElement, useEffect, useState, type ReactNode } from 'react'
import type { RowComponentProps } from '../types'

export interface LifecycleEvent {
  type: 'mount' | 'unmount'
  id: string
  instanceId: string
}

export interface TestRowProps {
  ids: string[]
  onMount: (id: string, instanceId: string) => void
  onUnmount: (id: string, instanceId: string) => void
}

let instanceCounter = 0
export const generateInstanceId = (): string => `inst-${++instanceCounter}`
export const resetInstanceCounter = (): void => {
  instanceCounter = 0
}

export const TrackedRow = ({ index, style, rowProps }: RowComponentProps<TestRowProps>): ReactNode => {
  const { ids, onMount, onUnmount } = rowProps
  const id = ids[index]
  const [instanceId] = useState(() => generateInstanceId())

  useEffect(() => {
    onMount(id, instanceId)
    return () => onUnmount(id, instanceId)
  }, [id, instanceId, onMount, onUnmount])

  return createElement('div', { style, 'data-testid': id, 'data-instance': instanceId }, id)
}
