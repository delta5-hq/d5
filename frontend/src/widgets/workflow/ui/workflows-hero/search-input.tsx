import { Input } from '@shared/ui/input'
import { Search } from 'lucide-react'
import { forwardRef } from 'react'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder: string
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(({ value, onChange, placeholder }, ref) => (
  <div className="relative w-full">
    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
    <Input
      className="h-12 pl-12 text-base"
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      ref={ref}
      type="search"
      value={value}
    />
  </div>
))

SearchInput.displayName = 'SearchInput'
