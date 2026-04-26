import type { UseFormSetValue, FieldValues } from 'react-hook-form'

export interface PresetDefinition<TForm extends FieldValues> {
  id: string
  label: string
  icon: string
  fill: (setValue: UseFormSetValue<TForm>) => void
}

export interface PresetButtonRowProps<TForm extends FieldValues> {
  presets: PresetDefinition<TForm>[]
  setValue: UseFormSetValue<TForm>
  disabled?: boolean
}
