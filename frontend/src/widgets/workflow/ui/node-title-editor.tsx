import { forwardRef } from 'react'
import { useIntl } from 'react-intl'
import { EditableTextArea, type EditableTextAreaProps, type EditableTextAreaHandle } from '@shared/ui/editable-field'

type NodeTitleEditorProps = Omit<EditableTextAreaProps, 'placeholder' | 'title'> & {
  placeholder?: string
  title?: string
}

export const NodeTitleEditor = forwardRef<EditableTextAreaHandle, NodeTitleEditorProps>(
  ({ placeholder, title, ...rest }, ref) => {
    const { formatMessage } = useIntl()

    return (
      <EditableTextArea
        placeholder={placeholder ?? formatMessage({ id: 'workflowTree.node.untitled' })}
        title={title ?? formatMessage({ id: 'workflowTree.node.editHint' })}
        {...rest}
        ref={ref}
      />
    )
  },
)

NodeTitleEditor.displayName = 'NodeTitleEditor'
