import { Trash2 } from 'lucide-react'
import * as React from 'react'
import { FormattedMessage } from 'react-intl'
import { toast } from 'sonner'

import { Button } from '@shared/ui/button'
import { Card, CardContent } from '@shared/ui/card'
import { apiFetch } from '@shared/lib/base-api'
import ArrayIntegrationEmptyState from './array-integration-empty-state'
import { IntegrationTypeBadge } from './integration-type-badge'
import { DeleteConfirmationDialog } from './delete-confirmation-dialog'
import { buildIntegrationUrl } from '../utils/build-integration-url'

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
  inherited?: boolean
  onAdd: () => void
  onEdit: (item?: ArrayIntegrationItem) => void
  refresh: () => Promise<void>
  workflowId?: string | null
}

const ArrayIntegrationSection: React.FC<Props> = ({
  fieldName,
  titleId,
  items,
  inherited = false,
  onAdd,
  onEdit,
  refresh,
  workflowId,
}) => {
  const [deleteTarget, setDeleteTarget] = React.useState<string | null>(null)

  const handleDeleteRequest = (e: React.MouseEvent, alias: string) => {
    e.stopPropagation()
    setDeleteTarget(alias)
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return

    try {
      const url = buildIntegrationUrl(`/integration/${fieldName}/items/${encodeURIComponent(deleteTarget)}`, workflowId)
      await apiFetch(url, { method: 'DELETE' })
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

  if (items.length === 0 && !inherited) {
    return <ArrayIntegrationEmptyState fieldName={fieldName} onAdd={onAdd} titleId={titleId} />
  }

  if (items.length === 0 && inherited) {
    return null
  }

  const getIntegrationType = (item: ArrayIntegrationItem): string | null => item.transport || item.protocol || null

  const getKeyConfigDetail = (item: ArrayIntegrationItem): string | null => {
    if (item.toolName) return `Tool: ${item.toolName}`
    if (item.commandTemplate) return item.commandTemplate
    if (item.command) return item.command
    return null
  }

  const cardClassName = inherited
    ? 'cursor-pointer transition-shadow border-dashed opacity-60'
    : 'cursor-pointer hover:shadow-md transition-shadow'

  return (
    <>
      <div className="w-full mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">
            <FormattedMessage id={titleId} />
          </h3>
          {!inherited ? (
            <Button
              aria-label={`Add ${fieldName} integration`}
              data-type={`add-${fieldName}`}
              onClick={onAdd}
              size="sm"
              variant="default"
            >
              + <FormattedMessage id={`integration.${fieldName}.add`} />
            </Button>
          ) : null}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(item => {
            const keyDetail = getKeyConfigDetail(item)
            const integrationType = getIntegrationType(item)

            return (
              <Card
                aria-label={`${inherited ? 'Inherited' : 'Edit'} ${item.alias}`}
                className={cardClassName}
                data-alias={item.alias}
                data-field={fieldName}
                data-inherited={inherited}
                key={item.alias}
                onClick={() => onEdit(item)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onEdit(item)
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <CardContent className="p-4 relative">
                  {!inherited ? (
                    <Button
                      aria-label={`Delete ${item.alias}`}
                      className="absolute top-2 right-2 h-6 w-6 p-0"
                      onClick={e => handleDeleteRequest(e, item.alias)}
                      size="sm"
                      variant="ghost"
                    >
                      <Trash2 aria-hidden="true" className="h-3 w-3" />
                      <span className="sr-only">
                        <FormattedMessage id="dialog.integration.deleteAction" />
                      </span>
                    </Button>
                  ) : null}
                  <div className="flex-1 min-w-0 pr-8">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-mono text-lg font-bold truncate">{item.alias}</h4>
                      {integrationType ? <IntegrationTypeBadge type={integrationType} /> : null}
                    </div>
                    {keyDetail ? (
                      <p className="text-xs text-muted-foreground mb-1 truncate font-mono">{keyDetail}</p>
                    ) : null}
                    {item.description ? (
                      <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
                    ) : null}
                    {inherited ? (
                      <p className="text-xs text-muted-foreground italic mt-2">
                        <FormattedMessage id="integration.inheritedNote" />
                      </p>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {!inherited ? (
        <DeleteConfirmationDialog
          alias={deleteTarget || ''}
          onCancel={handleDeleteCancel}
          onConfirm={handleDeleteConfirm}
          open={!!deleteTarget}
        />
      ) : null}
    </>
  )
}

export default ArrayIntegrationSection
