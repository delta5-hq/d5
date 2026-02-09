import { useIntl } from 'react-intl'
import { EditableText, type EditableTextProps } from '@shared/ui/editable-field'

type NodeTitleEditorProps = Omit<EditableTextProps, 'placeholder' | 'title'> & {
  placeholder?: string
  title?: string
}

export const NodeTitleEditor = ({ placeholder, title, ...rest }: NodeTitleEditorProps) => {
  const { formatMessage } = useIntl()

  return (
    <EditableText
      placeholder={placeholder ?? formatMessage({ id: 'workflowTree.node.untitled' })}
      title={title ?? formatMessage({ id: 'workflowTree.node.editHint' })}
      {...rest}
    />
  )
}
