import { useCallback, useEffect, useRef, useState } from 'react'
import type { NodeData, NodeId, EdgeData, EdgeId } from '@shared/base-types'
import { DEBOUNCE_TIMEOUT } from '@shared/config'
import { hasReferencesInAny } from '@shared/lib/reference-detection'
import { resolveNodePreview } from '../api/resolve-node-preview'

interface UseNodePreviewParams {
  nodeId: NodeId
  command: string | undefined
  title: string | undefined
  nodes: Record<NodeId, NodeData>
  edges: Record<EdgeId, EdgeData>
  workflowId: string
}

interface UseNodePreviewResult {
  previewText: string
  isLoading: boolean
  error: string | undefined
  refresh: () => void
}

/** @deprecated Use hasReferencesInAny from @shared/lib/reference-detection instead */
export const hasReferences = (command: string | undefined): boolean =>
  Boolean(command && (/@@/.test(command) || /##/.test(command)))

export function useNodePreview({
  nodeId,
  command,
  title,
  nodes,
  edges,
  workflowId,
}: UseNodePreviewParams): UseNodePreviewResult {
  const [previewText, setPreviewText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const abortRef = useRef<AbortController | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchPreview = useCallback(async () => {
    const textToResolve = command || title

    if (!hasReferencesInAny(command, title)) {
      setPreviewText(textToResolve ?? '')
      setError(undefined)
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setIsLoading(true)
    setError(undefined)

    try {
      const { resolvedCommand } = await resolveNodePreview({
        nodeId,
        workflowNodes: nodes,
        workflowEdges: edges,
        workflowId,
      })
      if (!controller.signal.aborted) {
        setPreviewText(resolvedCommand)
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err.message : 'Preview failed')
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false)
      }
    }
  }, [nodeId, command, title, nodes, edges, workflowId])

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(fetchPreview, DEBOUNCE_TIMEOUT)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      abortRef.current?.abort()
    }
  }, [fetchPreview])

  return { previewText, isLoading, error, refresh: fetchPreview }
}
