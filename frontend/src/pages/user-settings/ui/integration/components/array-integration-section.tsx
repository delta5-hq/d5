import { Trash2, Edit } from 'lucide-react'
import * as React from 'react'
import { FormattedMessage } from 'react-intl'
import { toast } from 'sonner'

import { Button } from '@shared/ui/button'
import { Card, CardContent } from '@shared/ui/card'
import { apiFetch } from '@shared/lib/base-api'
import ArrayIntegrationEmptyState from './array-integration-empty-state'
import { IntegrationTypeBadge } from './integration-type-badge'
import { DeleteConfirmationDialog } from './delete-confirmation-dialog'

interface ArrayIntegrationItem {
  alias: string
  description?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

interface Props {
  fieldName: string
  titleId: string
  items: ArrayIntegrationItem[]
  onAdd: () => void
  onEdit: (item: ArrayIntegrationItem) => void
  refresh: () => Promise<void>
}

const ArrayIntegrationSection: React.FC<Props> = ({ fieldName, titleId, items, onAdd, onEdit, refresh }) => {
  const [deleteTarget, setDeleteTarget] = React.useState<string | null>(null)

  const handleDeleteRequest = (alias: string) => {
    setDeleteTarget(alias)
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return

    try {
      await apiFetch(`/integration/${fieldName}/items/${encodeURIComponent(deleteTarget)}`, { method: 'DELETE' })
      toast.success(<FormattedMessage id="dialog.integration.deleteSuccess" />)
      await refresh()
    } catch {
      toast.error(<FormattedMessage id="errorServer" />)
    } finally {
      setDeleteTarget(null)
    }
  }

  const handleDeleteCancel = () => {
    setDeleteTarget(null)
  }

  if (items.length === 0) {
    return <ArrayIntegrationEmptyState fieldName={fieldName} onAdd={onAdd} titleId={titleId} />
  }

  const getIntegrationType = (item: ArrayIntegrationItem): string | null => {
    return item.transport || item.protocol || null
  }

  return (
    <>
      <div className="w-full mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">
            <FormattedMessage id={titleId} />
          </h3>
          <Button
            aria-label={`Add ${fieldName} integration`}
            data-type={`add-${fieldName}`}
            onClick={onAdd}
            size="sm"
            variant="default"
          >
            + <FormattedMessage id={`integration.${fieldName}.add`} />
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(item => (
            <Card
              className="hover:shadow-md transition-shadow"
              data-alias={item.alias}
              data-field={fieldName}
              key={item.alias}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-mono text-sm font-semibold truncate">{item.alias}</h4>
                      {getIntegrationType(item) ? <IntegrationTypeBadge type={getIntegrationType(item)!} /> : null}
                    </div>
                    {item.description ? (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.description}</p>
                    ) : null}
                  </div>
                  <div className="flex gap-1">
                    <Button aria-label={`Edit ${item.alias}`} onClick={() => onEdit(item)} size="sm" variant="ghost">
                      <Edit aria-hidden="true" className="h-3 w-3" />
                      <span className="sr-only">
                        <FormattedMessage id="dialog.integration.editAction" />
                      </span>
                    </Button>
                    <Button
                      aria-label={`Delete ${item.alias}`}
                      onClick={() => handleDeleteRequest(item.alias)}
                      size="sm"
                      variant="ghost"
                    >
                      <Trash2 aria-hidden="true" className="h-3 w-3" />
                      <span className="sr-only">
                        <FormattedMessage id="dialog.integration.deleteAction" />
                      </span>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <DeleteConfirmationDialog
        alias={deleteTarget || ''}
        onCancel={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        open={!!deleteTarget}
      />
    </>
  )
}

export default ArrayIntegrationSection
