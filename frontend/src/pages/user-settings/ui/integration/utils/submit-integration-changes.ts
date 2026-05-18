type SaveAction = () => Promise<unknown>

interface SubmitOptions {
  refresh: () => Promise<void>
  onClose?: () => void
}

export async function submitIntegrationChanges(
  saveAction: SaveAction,
  { refresh, onClose }: SubmitOptions,
): Promise<void> {
  await saveAction()
  await refresh()
  onClose?.()
}
