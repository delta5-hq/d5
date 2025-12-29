import { type FC } from 'react'
import { type SecondaryMenuItem } from '../../../config'
import { useSectionVisibility } from '../../../hooks/use-section-visibility'
import { DefaultSection } from './default-section'
import { HomeSection } from './home-section'
import { PublicSection } from './public-section'

interface SectionRendererProps {
  activeSection?: string
  menuItems: ReadonlyArray<SecondaryMenuItem>
}

export const SectionRenderer: FC<SectionRendererProps> = ({ activeSection, menuItems }) => {
  const { showMainMenu, showRecentItems } = useSectionVisibility(activeSection)
  const isHomeSection = activeSection === 'home'
  const isPublicSection = activeSection === 'public'

  return (
    <>
      {showMainMenu && activeSection ? <DefaultSection activeSection={activeSection} menuItems={menuItems} /> : null}
      {isHomeSection ? <HomeSection showRecentItems={showRecentItems} /> : null}
      {isPublicSection ? <PublicSection /> : null}
    </>
  )
}
