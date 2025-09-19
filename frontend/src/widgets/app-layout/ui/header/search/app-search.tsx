import React, { forwardRef } from 'react'
import { Input } from '@shared/ui/input'

const AppSearch = forwardRef<HTMLInputElement, React.ComponentProps<typeof Input>>((props, ref) => (
  <Input ref={ref} {...props} />
))

AppSearch.displayName = 'AppSearch'

export default AppSearch
