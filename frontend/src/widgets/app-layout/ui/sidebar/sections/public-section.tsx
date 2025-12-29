import { SidebarMenu } from '@shared/ui/sidebar'
import { type FC } from 'react'
import { SidebarSection } from '../components/sidebar-section'
import { Placeholder } from './shared/placeholder'

export const PublicSection: FC = () => (
  <SidebarSection labelId="sidebarTagsLabel">
    <SidebarMenu>
      <Placeholder messageId="sidebarNoTags" />
    </SidebarMenu>
  </SidebarSection>
)
