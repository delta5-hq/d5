import { FormattedMessage } from 'react-intl'
import { AppLayout } from '@widgets/app-layout'

export const TrainingPage = () => (
  <AppLayout>
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <div className="max-w-2xl w-full text-center space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">
          <FormattedMessage id="menuItemTraining" />
        </h1>
        <p className="text-lg text-muted-foreground">
          <FormattedMessage id="comingSoon" />
        </p>
      </div>
    </div>
  </AppLayout>
)
