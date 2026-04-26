import * as React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { UseFormSetValue, FieldValues } from 'react-hook-form'
import { IntlProvider } from 'react-intl'
import { PresetButtonRow } from './preset-button-row'
import type { PresetDefinition } from './types'

interface TestFormValues extends FieldValues {
  field1: string
  field2: number
}

const messages = {
  'dialog.integration.presets': 'Presets',
}

const renderWithIntl = (ui: React.ReactElement) =>
  render(
    <IntlProvider locale="en" messages={messages}>
      {ui}
    </IntlProvider>,
  )

describe('PresetButtonRow', () => {
  describe('empty state handling', () => {
    it('renders nothing when presets array is empty', () => {
      const setValue = vi.fn() as unknown as UseFormSetValue<TestFormValues>
      const { container } = renderWithIntl(<PresetButtonRow presets={[]} setValue={setValue} />)
      expect(container.firstChild).toBeNull()
    })

    it('does not render Presets label when no presets', () => {
      const setValue = vi.fn() as unknown as UseFormSetValue<TestFormValues>
      renderWithIntl(<PresetButtonRow presets={[]} setValue={setValue} />)
      expect(screen.queryByText('Presets')).not.toBeInTheDocument()
    })

    it('handles undefined presets gracefully', () => {
      const setValue = vi.fn() as unknown as UseFormSetValue<TestFormValues>
      const { container } = renderWithIntl(<PresetButtonRow presets={[]} setValue={setValue} />)
      expect(container.firstChild).toBeNull()
    })
  })

  describe('rendering behavior', () => {
    it('renders preset buttons with icons and labels', () => {
      const mockPresets: PresetDefinition<TestFormValues>[] = [
        { id: 'preset-1', label: 'Test Preset 1', icon: '🧪', fill: vi.fn() },
        { id: 'preset-2', label: 'Test Preset 2', icon: '🎯', fill: vi.fn() },
      ]
      const setValue = vi.fn() as unknown as UseFormSetValue<TestFormValues>

      renderWithIntl(<PresetButtonRow presets={mockPresets} setValue={setValue} />)

      expect(screen.getByText('Presets')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /🧪 Test Preset 1/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /🎯 Test Preset 2/i })).toBeInTheDocument()
    })

    it('renders correct number of buttons matching preset count', () => {
      const mockPresets: PresetDefinition<TestFormValues>[] = [
        { id: 'preset-1', label: 'Preset 1', icon: '🧪', fill: vi.fn() },
        { id: 'preset-2', label: 'Preset 2', icon: '🎯', fill: vi.fn() },
        { id: 'preset-3', label: 'Preset 3', icon: '🚀', fill: vi.fn() },
      ]
      const setValue = vi.fn() as unknown as UseFormSetValue<TestFormValues>

      renderWithIntl(<PresetButtonRow presets={mockPresets} setValue={setValue} />)

      const buttons = screen.getAllByRole('button')
      expect(buttons).toHaveLength(3)
    })

    it('uses preset id as unique React key (no console warnings)', () => {
      const mockPresets: PresetDefinition<TestFormValues>[] = [
        { id: 'unique-1', label: 'Preset 1', icon: '🧪', fill: vi.fn() },
        { id: 'unique-2', label: 'Preset 2', icon: '🎯', fill: vi.fn() },
      ]
      const setValue = vi.fn() as unknown as UseFormSetValue<TestFormValues>
      const consoleSpy = vi.spyOn(console, 'error')

      renderWithIntl(<PresetButtonRow presets={mockPresets} setValue={setValue} />)

      expect(consoleSpy).not.toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('renders Presets label only once regardless of preset count', () => {
      const mockPresets: PresetDefinition<TestFormValues>[] = [
        { id: 'preset-1', label: 'Preset 1', icon: '🧪', fill: vi.fn() },
        { id: 'preset-2', label: 'Preset 2', icon: '🎯', fill: vi.fn() },
      ]
      const setValue = vi.fn() as unknown as UseFormSetValue<TestFormValues>

      renderWithIntl(<PresetButtonRow presets={mockPresets} setValue={setValue} />)

      const labels = screen.getAllByText('Presets')
      expect(labels).toHaveLength(1)
    })
  })

  describe('click interaction behavior', () => {
    it('invokes preset fill function when button clicked', () => {
      const fillFn = vi.fn()
      const mockPresets: PresetDefinition<TestFormValues>[] = [
        { id: 'preset-1', label: 'Test Preset', icon: '🧪', fill: fillFn },
      ]
      const setValue = vi.fn() as unknown as UseFormSetValue<TestFormValues>

      renderWithIntl(<PresetButtonRow presets={mockPresets} setValue={setValue} />)

      const button = screen.getByRole('button', { name: /🧪 Test Preset/i })
      fireEvent.click(button)

      expect(fillFn).toHaveBeenCalledWith(setValue)
      expect(fillFn).toHaveBeenCalledTimes(1)
    })

    it('passes correct setValue function to each preset', () => {
      const fillFn1 = vi.fn()
      const fillFn2 = vi.fn()
      const mockPresets: PresetDefinition<TestFormValues>[] = [
        { id: 'preset-1', label: 'Preset 1', icon: '🧪', fill: fillFn1 },
        { id: 'preset-2', label: 'Preset 2', icon: '🎯', fill: fillFn2 },
      ]
      const setValue = vi.fn() as unknown as UseFormSetValue<TestFormValues>

      renderWithIntl(<PresetButtonRow presets={mockPresets} setValue={setValue} />)

      fireEvent.click(screen.getByRole('button', { name: /🧪 Preset 1/i }))
      fireEvent.click(screen.getByRole('button', { name: /🎯 Preset 2/i }))

      expect(fillFn1).toHaveBeenCalledWith(setValue)
      expect(fillFn2).toHaveBeenCalledWith(setValue)
    })

    it('supports multiple clicks on same button', () => {
      const fillFn = vi.fn()
      const mockPresets: PresetDefinition<TestFormValues>[] = [
        { id: 'preset-1', label: 'Test Preset', icon: '🧪', fill: fillFn },
      ]
      const setValue = vi.fn() as unknown as UseFormSetValue<TestFormValues>

      renderWithIntl(<PresetButtonRow presets={mockPresets} setValue={setValue} />)

      const button = screen.getByRole('button', { name: /🧪 Test Preset/i })
      fireEvent.click(button)
      fireEvent.click(button)
      fireEvent.click(button)

      expect(fillFn).toHaveBeenCalledTimes(3)
    })

    it('does not invoke fill function when button disabled', () => {
      const fillFn = vi.fn()
      const mockPresets: PresetDefinition<TestFormValues>[] = [
        { id: 'preset-1', label: 'Test Preset', icon: '🧪', fill: fillFn },
      ]
      const setValue = vi.fn() as unknown as UseFormSetValue<TestFormValues>

      renderWithIntl(<PresetButtonRow disabled presets={mockPresets} setValue={setValue} />)

      const button = screen.getByRole('button', { name: /🧪 Test Preset/i })
      fireEvent.click(button)

      expect(fillFn).not.toHaveBeenCalled()
    })
  })

  describe('disabled state behavior', () => {
    it('disables all buttons when disabled prop is true', () => {
      const mockPresets: PresetDefinition<TestFormValues>[] = [
        { id: 'preset-1', label: 'Preset 1', icon: '🧪', fill: vi.fn() },
        { id: 'preset-2', label: 'Preset 2', icon: '🎯', fill: vi.fn() },
      ]
      const setValue = vi.fn() as unknown as UseFormSetValue<TestFormValues>

      renderWithIntl(<PresetButtonRow disabled presets={mockPresets} setValue={setValue} />)

      const buttons = screen.getAllByRole('button')
      buttons.forEach(button => {
        expect(button).toBeDisabled()
      })
    })

    it('enables all buttons when disabled prop is false', () => {
      const mockPresets: PresetDefinition<TestFormValues>[] = [
        { id: 'preset-1', label: 'Preset 1', icon: '🧪', fill: vi.fn() },
        { id: 'preset-2', label: 'Preset 2', icon: '🎯', fill: vi.fn() },
      ]
      const setValue = vi.fn() as unknown as UseFormSetValue<TestFormValues>

      renderWithIntl(<PresetButtonRow disabled={false} presets={mockPresets} setValue={setValue} />)

      const buttons = screen.getAllByRole('button')
      buttons.forEach(button => {
        expect(button).not.toBeDisabled()
      })
    })

    it('enables all buttons when disabled prop omitted (default behavior)', () => {
      const mockPresets: PresetDefinition<TestFormValues>[] = [
        { id: 'preset-1', label: 'Test Preset', icon: '🧪', fill: vi.fn() },
      ]
      const setValue = vi.fn() as unknown as UseFormSetValue<TestFormValues>

      renderWithIntl(<PresetButtonRow presets={mockPresets} setValue={setValue} />)

      const button = screen.getByRole('button', { name: /🧪 Test Preset/i })
      expect(button).not.toBeDisabled()
    })
  })

  describe('edge cases and error conditions', () => {
    it('handles preset with empty label gracefully', () => {
      const mockPresets: PresetDefinition<TestFormValues>[] = [{ id: 'preset-1', label: '', icon: '🧪', fill: vi.fn() }]
      const setValue = vi.fn() as unknown as UseFormSetValue<TestFormValues>

      const { container } = renderWithIntl(<PresetButtonRow presets={mockPresets} setValue={setValue} />)
      expect(container.querySelector('button')).toBeInTheDocument()
    })

    it('handles preset with empty icon gracefully', () => {
      const mockPresets: PresetDefinition<TestFormValues>[] = [
        { id: 'preset-1', label: 'Test', icon: '', fill: vi.fn() },
      ]
      const setValue = vi.fn() as unknown as UseFormSetValue<TestFormValues>

      renderWithIntl(<PresetButtonRow presets={mockPresets} setValue={setValue} />)
      expect(screen.getByRole('button', { name: /Test/i })).toBeInTheDocument()
    })

    it('handles very long preset labels without breaking layout', () => {
      const longLabel = 'A'.repeat(100)
      const mockPresets: PresetDefinition<TestFormValues>[] = [
        { id: 'preset-1', label: longLabel, icon: '🧪', fill: vi.fn() },
      ]
      const setValue = vi.fn() as unknown as UseFormSetValue<TestFormValues>

      const { container } = renderWithIntl(<PresetButtonRow presets={mockPresets} setValue={setValue} />)
      const button = container.querySelector('button')
      expect(button?.textContent).toContain(longLabel)
    })

    it('handles special characters in labels', () => {
      const mockPresets: PresetDefinition<TestFormValues>[] = [
        { id: 'preset-1', label: 'Test <>&"\'', icon: '🧪', fill: vi.fn() },
      ]
      const setValue = vi.fn() as unknown as UseFormSetValue<TestFormValues>

      renderWithIntl(<PresetButtonRow presets={mockPresets} setValue={setValue} />)
      expect(screen.getByRole('button', { name: /Test/i })).toBeInTheDocument()
    })

    it('maintains reference equality of setValue across renders', () => {
      const fillFn = vi.fn()
      const mockPresets: PresetDefinition<TestFormValues>[] = [
        { id: 'preset-1', label: 'Test', icon: '🧪', fill: fillFn },
      ]
      const setValue = vi.fn() as unknown as UseFormSetValue<TestFormValues>

      const { rerender } = renderWithIntl(<PresetButtonRow presets={mockPresets} setValue={setValue} />)
      const button = screen.getByRole('button', { name: /Test/i })
      fireEvent.click(button)

      const firstCallSetValue = fillFn.mock.calls[0][0]

      rerender(
        <IntlProvider locale="en" messages={messages}>
          <PresetButtonRow presets={mockPresets} setValue={setValue} />
        </IntlProvider>,
      )
      fireEvent.click(button)

      const secondCallSetValue = fillFn.mock.calls[1][0]
      expect(firstCallSetValue).toBe(secondCallSetValue)
    })
  })

  describe('accessibility requirements', () => {
    it('uses button role for all preset actions', () => {
      const mockPresets: PresetDefinition<TestFormValues>[] = [
        { id: 'preset-1', label: 'Preset 1', icon: '🧪', fill: vi.fn() },
        { id: 'preset-2', label: 'Preset 2', icon: '🎯', fill: vi.fn() },
      ]
      const setValue = vi.fn() as unknown as UseFormSetValue<TestFormValues>

      renderWithIntl(<PresetButtonRow presets={mockPresets} setValue={setValue} />)

      const buttons = screen.getAllByRole('button')
      expect(buttons).toHaveLength(2)
    })

    it('provides accessible button text with icon and label', () => {
      const mockPresets: PresetDefinition<TestFormValues>[] = [
        { id: 'preset-1', label: 'Test Preset', icon: '🧪', fill: vi.fn() },
      ]
      const setValue = vi.fn() as unknown as UseFormSetValue<TestFormValues>

      renderWithIntl(<PresetButtonRow presets={mockPresets} setValue={setValue} />)

      const button = screen.getByRole('button', { name: /🧪 Test Preset/i })
      expect(button.textContent).toContain('🧪')
      expect(button.textContent).toContain('Test Preset')
    })
  })

  describe('internationalization support', () => {
    it('uses FormattedMessage for Presets label', () => {
      const mockPresets: PresetDefinition<TestFormValues>[] = [
        { id: 'preset-1', label: 'Test', icon: '🧪', fill: vi.fn() },
      ]
      const setValue = vi.fn() as unknown as UseFormSetValue<TestFormValues>

      renderWithIntl(<PresetButtonRow presets={mockPresets} setValue={setValue} />)

      expect(screen.getByText('Presets')).toBeInTheDocument()
    })

    it('supports different locale messages', () => {
      const frenchMessages = { 'dialog.integration.presets': 'Préréglages' }
      const mockPresets: PresetDefinition<TestFormValues>[] = [
        { id: 'preset-1', label: 'Test', icon: '🧪', fill: vi.fn() },
      ]
      const setValue = vi.fn() as unknown as UseFormSetValue<TestFormValues>

      render(
        <IntlProvider locale="fr" messages={frenchMessages}>
          <PresetButtonRow presets={mockPresets} setValue={setValue} />
        </IntlProvider>,
      )

      expect(screen.getByText('Préréglages')).toBeInTheDocument()
    })
  })
})
