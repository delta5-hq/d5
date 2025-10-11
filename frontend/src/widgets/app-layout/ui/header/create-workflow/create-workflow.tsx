import { useWorkflowManage } from '@entities/workflow'
import { Button } from '@shared/ui/button'
import { Loader2, Plus } from 'lucide-react'
import { FormattedMessage } from 'react-intl'
import { useNavigate } from 'react-router-dom'

export const CreateWorkflow = () => {
  const navigate = useNavigate()
  const { createEmpty, isCreating } = useWorkflowManage()

  const onCreate = async () => {
    const { workflowId } = await createEmpty()
    navigate(`/workflows/${workflowId}`)
  }

  return (
    <Button disabled={isCreating} onClick={onCreate} variant="accent">
      {!isCreating ? <Plus /> : <Loader2 className="animate-spin" />}
      <FormattedMessage id="createWorkflow" />
    </Button>
  )
}
