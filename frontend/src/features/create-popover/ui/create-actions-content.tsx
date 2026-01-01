import { Plus, LayoutTemplate } from 'lucide-react'
import { type FC } from 'react'
import { FormattedMessage } from 'react-intl'
import { useNavigate } from 'react-router-dom'
import styles from './create-actions-content.module.scss'

interface CreateActionsContentProps {
  onCreateWorkflow: () => void
  onNavigate?: () => void
}

export const CreateActionsContent: FC<CreateActionsContentProps> = ({ onCreateWorkflow, onNavigate }) => {
  const navigate = useNavigate()

  const handleCreate = () => {
    onCreateWorkflow()
    onNavigate?.()
  }

  const handleTemplates = () => {
    navigate('/templates')
    onNavigate?.()
  }

  return (
    <div className={styles.createActionsContent} data-testid="create-workflow-popover">
      <button className={styles.createButton} data-testid="create-workflow-button" onClick={handleCreate} type="button">
        <Plus className="w-5 h-5" />
        <FormattedMessage id="createWorkflow" />
      </button>
      <button
        className={styles.createButton}
        data-testid="create-from-template-button"
        onClick={handleTemplates}
        type="button"
      >
        <LayoutTemplate className="w-5 h-5" />
        <FormattedMessage id="createWorkflowFromTemplate" />
      </button>
    </div>
  )
}
