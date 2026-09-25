import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Check, ChevronDown } from 'lucide-react'

export default function ChoiceMenu<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
  disabled?: boolean
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className="choice-trigger"
          aria-label={`${label}: ${options.find((o) => o.value === value)?.label ?? value}`}
          disabled={disabled}
        >
          <span>{options.find((o) => o.value === value)?.label ?? label}</span>
          <ChevronDown size={16} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="dropdown-content choice-options"
          align="end"
          sideOffset={8}
          collisionPadding={12}
        >
          <DropdownMenu.Label className="dropdown-label">{label}</DropdownMenu.Label>
          <DropdownMenu.RadioGroup value={value} onValueChange={(next) => onChange(next as T)}>
            {options.map((option) => (
              <DropdownMenu.RadioItem
                key={option.value}
                value={option.value}
                className="dropdown-item"
              >
                <span>{option.label}</span>
                <DropdownMenu.ItemIndicator className="choice-check">
                  <Check size={16} />
                </DropdownMenu.ItemIndicator>
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
