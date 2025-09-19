import { useEffect } from 'react'
import { FormattedMessage } from 'react-intl'

interface TitleUpdaterProps {
  title: string
}

const TitleUpdater = ({ title }: TitleUpdaterProps) => {
  useEffect(() => {
    document.title = title ? `${title} | D5` : 'D5'
  }, [title])

  return null
}

type HelmetTitleProps =
  | {
      title: string
    }
  | {
      titleId: string
    }

const HelmetTitle = (props: HelmetTitleProps) => {
  if ('titleId' in props) {
    const { titleId } = props
    return <FormattedMessage id={titleId}>{translated => <TitleUpdater title={String(translated)} />}</FormattedMessage>
  }
  const { title } = props

  return <TitleUpdater title={title} />
}

export { HelmetTitle }
