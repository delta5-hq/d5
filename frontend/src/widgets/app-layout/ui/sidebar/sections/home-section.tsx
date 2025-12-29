import { SidebarMenu } from '@shared/ui/sidebar'
import { type FC } from 'react'
import { SidebarSection } from '../components/sidebar-section'
import { Placeholder } from './shared/placeholder'

interface HomeSectionProps {
  showRecentItems: boolean
}

export const HomeSection: FC<HomeSectionProps> = ({ showRecentItems }) => (
  <>
    {showRecentItems ? (
      <SidebarSection labelId="sidebarRecentItemsLabel">
        <SidebarMenu>
          <Placeholder messageId="sidebarNoRecentItems" />
        </SidebarMenu>
      </SidebarSection>
    ) : null}

    <SidebarSection labelId="sidebarTagsLabel">
      <SidebarMenu>
        <Placeholder messageId="sidebarNoTags" />
      </SidebarMenu>
    </SidebarSection>
  </>
)
