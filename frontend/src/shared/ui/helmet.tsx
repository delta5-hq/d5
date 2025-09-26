import React, { useEffect } from 'react'
import { FormattedMessage } from 'react-intl'

interface TitleUpdaterProps {
  title: string
}

const TitleUpdater = ({ title }: TitleUpdaterProps) => {
  useEffect(() => {
    document.title = title ? `${title} | D5` : 'D5'

    return () => {
      document.title = 'D5'
    }
  }, [title])

  return null
}

const TitleFromTranslation: React.FC<{ id: string }> = ({ id }) => (
  <FormattedMessage id={id}>{translated => <TitleUpdater title={String(translated)} />}</FormattedMessage>
)

type HelmetTitleProps = { title: string } | { titleId: string }

const HelmetTitle = (props: HelmetTitleProps) => {
  if ('titleId' in props) {
    const { titleId } = props
    return <TitleFromTranslation id={titleId} />
  }
  const { title } = props

  return <TitleUpdater title={title ?? ''} />
}

export { HelmetTitle }
