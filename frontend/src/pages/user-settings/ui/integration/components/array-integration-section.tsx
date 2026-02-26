import { Trash2, Edit } from 'lucide-react'
import * as React from 'react'
import { FormattedMessage } from 'react-intl'
import { toast } from 'sonner'

import { Button } from '@shared/ui/button'
import { Card, CardContent } from '@shared/ui/card'
import { apiFetch } from '@shared/lib/base-api'

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
  const handleDelete = async (alias: string) => {
    if (!confirm(`Delete ${alias}?`)) return

    try {
      await apiFetch(`/integration/${fieldName}/items/${encodeURIComponent(alias)}`, { method: 'DELETE' })
      toast.success(<FormattedMessage id="dialog.integration.deleteSuccess" />)
      await refresh()
    } catch {
      toast.error(<FormattedMessage id="errorServer" />)
    }
  }

  if (items.length === 0) return null

  return (
    <div className="w-full mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">
          <FormattedMessage id={titleId} />
        </h3>
        <Button data-type={`add-${fieldName}`} onClick={onAdd} size="sm" variant="default">
          + <FormattedMessage id={`integration.${fieldName}.add`} />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map(item => (
          <Card
            className="hover:shadow-md transition-shadow"
            data-alias={item.alias}
            glassEffect={false}
            key={item.alias}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h4 className="font-mono text-sm font-semibold truncate">{item.alias}</h4>
                  {item.description ? (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.description}</p>
                  ) : null}
                </div>
                <div className="flex gap-1 ml-2">
                  <Button onClick={() => onEdit(item)} size="sm" variant="ghost">
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button onClick={() => handleDelete(item.alias)} size="sm" variant="ghost">
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

export default ArrayIntegrationSection
