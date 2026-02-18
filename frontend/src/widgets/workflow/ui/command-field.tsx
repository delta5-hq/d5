import { cn } from '@shared/lib/utils'
import { useFieldDraft } from '@shared/lib/hooks'
import { EditableTextArea } from '@shared/ui/editable-field'

interface CommandFieldProps {
  nodeId: string
  value: string
  onChange: (value: string) => void
  onEnterCommit?: () => void
  onCtrlEnter?: () => void
  placeholder?: string
  className?: string
  autoFocus?: boolean
}

const buildStorageKey = (nodeId: string) => `workflow:node:${nodeId}:command`

export const CommandField = ({
  nodeId,
  value,
  onChange,
  onEnterCommit,
  onCtrlEnter,
  placeholder,
  className,
  autoFocus,
}: CommandFieldProps) => {
  const { draft, isDirty, setDraft, commit, discard } = useFieldDraft({
    storageKey: buildStorageKey(nodeId),
    committedValue: value,
    onChange,
  })

  const handleEnterCommit = () => {
    commit()
    onEnterCommit?.()
  }

  const handleCtrlEnter = () => {
    commit()
    onCtrlEnter?.()
  }

  return (
    <EditableTextArea
      autoFocus={autoFocus}
      className={cn(isDirty && 'border-amber-400 focus-visible:ring-amber-400', className)}
      onChange={onChange}
      onCtrlEnter={handleCtrlEnter}
      onEnterCommit={handleEnterCommit}
      onEscape={discard}
      onInput={setDraft}
      placeholder={placeholder}
      value={draft}
    />
  )
}
