import { Plus } from 'lucide-react'
import { type FC } from 'react'
import { FormattedMessage } from 'react-intl'
import styles from './create-actions-content.module.scss'

interface CreateActionsContentProps {
  onCreateWorkflow: () => void
  onNavigate?: () => void
}

export const CreateActionsContent: FC<CreateActionsContentProps> = ({ onCreateWorkflow, onNavigate }) => {
  const handleCreate = () => {
    onCreateWorkflow()
    onNavigate?.()
  }

  return (
    <div className={styles.createActionsContent}>
      <button className={styles.createButton} onClick={handleCreate} type="button">
        <Plus className="w-5 h-5" />
        <FormattedMessage id="createWorkflow" />
      </button>
    </div>
  )
}
