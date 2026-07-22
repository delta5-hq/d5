export const buildIntegrationUrl = (path: string, workflowId?: string | null): string => {
  if (!workflowId) return path

  const separator = path.includes('?') ? '&' : '?'
  return `${path}${separator}workflowId=${encodeURIComponent(workflowId)}`
}
