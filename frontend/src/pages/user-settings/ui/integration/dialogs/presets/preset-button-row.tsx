import { FormattedMessage } from 'react-intl'
import type { FieldValues, UseFormSetValue } from 'react-hook-form'
import { Button } from '@shared/ui/button'
import type { PresetButtonRowProps } from './types'

export const PresetButtonRow = <TForm extends FieldValues>({
  presets,
  setValue,
  disabled = false,
}: PresetButtonRowProps<TForm>) => {
  if (presets.length === 0) {
    return null
  }

  const handlePresetClick = (fill: (setValue: UseFormSetValue<TForm>) => void) => {
    fill(setValue)
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">
        <FormattedMessage id="dialog.integration.presets" />
      </span>
      <div className="flex flex-wrap gap-2">
        {presets.map(preset => (
          <Button
            disabled={disabled}
            key={preset.id}
            onClick={() => handlePresetClick(preset.fill)}
            size="sm"
            type="button"
            variant="default"
          >
            {preset.icon} {preset.label}
          </Button>
        ))}
      </div>
    </div>
  )
}
