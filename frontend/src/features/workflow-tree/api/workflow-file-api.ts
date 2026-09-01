import { apiFetch } from '@shared/lib/base-api'

export interface WorkflowFileUploadResponse {
  id: string
  filename: string
  length: number
}

export async function uploadWorkflowFile(workflowId: string, file: File): Promise<WorkflowFileUploadResponse> {
  const formData = new FormData()
  formData.append('file', file)
  return apiFetch<WorkflowFileUploadResponse>(`/workflow/${workflowId}/files`, {
    method: 'POST',
    body: formData,
  })
}

export async function deleteWorkflowFile(workflowId: string, fileId: string): Promise<void> {
  await apiFetch(`/workflow/${workflowId}/files/${fileId}`, { method: 'DELETE' })
}
