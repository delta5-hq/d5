import { fireEvent, render, screen } from '@testing-library/react'
import { IntlProvider } from 'react-intl'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import messages from '@shared/lib/intl'
import { VisibilityRadioGroup } from '../share-dialog/visibility-radio-group'

let isAdmin = false

vi.mock('@entities/auth', () => ({
  useAuthContext: () => ({ isAdmin }),
}))

const renderRadioGroup = (
  onValueChange = vi.fn(),
  value: Parameters<typeof VisibilityRadioGroup>[0]['value'] = 'public',
) => {
  render(
    <IntlProvider locale="en" messages={messages.en}>
      <VisibilityRadioGroup onValueChange={onValueChange} value={value} />
    </IntlProvider>,
  )
  return onValueChange
}

describe('VisibilityRadioGroup', () => {
  beforeEach(() => {
    isAdmin = false
  })

  it('hides collaborative public writeable control from non-admin users', () => {
    renderRadioGroup()

    expect(screen.queryByText('Collaborative editing')).not.toBeInTheDocument()
  })

  it('shows collaborative public writeable control to admin users', () => {
    isAdmin = true
    renderRadioGroup()

    expect(screen.getByText('Collaborative editing')).toBeInTheDocument()
  })

  it('emits writeable public only when admin toggles collaborative editing', () => {
    isAdmin = true
    const onValueChange = renderRadioGroup()

    fireEvent.click(screen.getByRole('switch'))

    expect(onValueChange).toHaveBeenCalledWith('writeable-public')
  })

  it('uses the same admin gate for unlisted collaborative editing', () => {
    renderRadioGroup(vi.fn(), 'unlisted')

    expect(screen.queryByText('Collaborative editing')).not.toBeInTheDocument()

    isAdmin = true
    renderRadioGroup(vi.fn(), 'unlisted')

    expect(screen.getByText('Collaborative editing')).toBeInTheDocument()
  })
})

describe('VisibilityRadioGroup — collaborative toggle hidden regardless of loaded value', () => {
  beforeEach(() => {
    isAdmin = false
  })

  it('hides collaborative toggle for non-admin when current value is writeable-public', () => {
    renderRadioGroup(vi.fn(), 'writeable-public')

    expect(screen.queryByText('Collaborative editing')).not.toBeInTheDocument()
  })

  it('hides collaborative toggle for non-admin when current value is writeable-unlisted', () => {
    renderRadioGroup(vi.fn(), 'writeable-unlisted')

    expect(screen.queryByText('Collaborative editing')).not.toBeInTheDocument()
  })

  it('shows collaborative toggle for admin when current value is writeable-public', () => {
    isAdmin = true
    renderRadioGroup(vi.fn(), 'writeable-public')

    expect(screen.getByText('Collaborative editing')).toBeInTheDocument()
  })
})
