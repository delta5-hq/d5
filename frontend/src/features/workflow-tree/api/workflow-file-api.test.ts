import { describe, expect, it, vi } from 'vitest'
import { apiFetch } from '@shared/lib/base-api'
import { deleteWorkflowFile, uploadWorkflowFile } from './workflow-file-api'

vi.mock('@shared/lib/base-api', () => ({
  apiFetch: vi.fn(),
}))

describe('workflow file api', () => {
  it('uploads a single file as multipart form data to the workflow file route', async () => {
    const file = new File(['hello'], 'notes.txt', { type: 'text/plain' })
    vi.mocked(apiFetch).mockResolvedValueOnce({ id: 'file-1', filename: 'notes.txt', length: 5 })

    await uploadWorkflowFile('wf-test', file)

    expect(apiFetch).toHaveBeenCalledWith(
      '/workflow/wf-test/files',
      expect.objectContaining({
        body: expect.any(FormData),
        method: 'POST',
      }),
    )
    const body = vi.mocked(apiFetch).mock.calls[0][1]?.body as FormData
    expect(body.get('file')).toBe(file)
  })

  it.each([
    { workflowId: 'wf-test', fileId: 'file-1', expectedPath: '/workflow/wf-test/files/file-1' },
    {
      workflowId: 'workflow-with-dashes',
      fileId: 'gridfs-object-id',
      expectedPath: '/workflow/workflow-with-dashes/files/gridfs-object-id',
    },
  ])('deletes uploaded file metadata and bytes from $expectedPath', async ({ workflowId, fileId, expectedPath }) => {
    vi.mocked(apiFetch).mockResolvedValueOnce(undefined)

    await deleteWorkflowFile(workflowId, fileId)

    expect(apiFetch).toHaveBeenCalledWith(expectedPath, { method: 'DELETE' })
  })
})
