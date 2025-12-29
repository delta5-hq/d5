import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@shared/ui/sidebar'
import { type FC } from 'react'
import { FormattedMessage } from 'react-intl'
import { SidebarSection } from '../components/sidebar-section'

interface HomeSectionProps {
  showRecentItems: boolean
}

const RecentItemsPlaceholder: FC = () => (
  <SidebarMenuItem>
    <SidebarMenuButton disabled>
      <span className="text-sm text-muted-foreground">
        <FormattedMessage id="sidebarNoRecentItems" />
      </span>
    </SidebarMenuButton>
  </SidebarMenuItem>
)

const TagsPlaceholder: FC = () => (
  <SidebarMenuItem>
    <SidebarMenuButton disabled>
      <span className="text-sm text-muted-foreground">
        <FormattedMessage id="sidebarNoTags" />
      </span>
    </SidebarMenuButton>
  </SidebarMenuItem>
)

export const HomeSection: FC<HomeSectionProps> = ({ showRecentItems }) => (
  <>
    {showRecentItems ? (
      <SidebarSection labelId="sidebarRecentItemsLabel">
        <SidebarMenu>
          <RecentItemsPlaceholder />
        </SidebarMenu>
      </SidebarSection>
    ) : null}

    <SidebarSection labelId="sidebarTagsLabel">
      <SidebarMenu>
        <TagsPlaceholder />
      </SidebarMenu>
    </SidebarSection>
  </>
)
