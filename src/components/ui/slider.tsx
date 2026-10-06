import { Slider as S } from 'radix-ui'
import { cn } from '@/lib/cn'

export function Slider({
  value,
  onValueChange,
  onValueCommit,
  max = 100,
  step = 1,
  className,
  'aria-label': ariaLabel,
  disabled,
}: {
  value: number
  onValueChange(value: number): void
  onValueCommit?(value: number): void
  max?: number
  step?: number
  className?: string
  'aria-label': string
  disabled?: boolean
}) {
  return (
    <S.Root
      value={[value]}
      max={max}
      step={step}
      disabled={disabled}
      onValueChange={([next]) => onValueChange(next)}
      onValueCommit={([next]) => onValueCommit?.(next)}
      className={cn(
        'relative flex h-5 w-full touch-none items-center select-none data-[disabled]:opacity-50',
        className,
      )}
    >
      <S.Track className="relative h-1.5 grow overflow-hidden rounded-full bg-active">
        <S.Range className="absolute h-full rounded-full bg-fg" />
      </S.Track>
      <S.Thumb
        aria-label={ariaLabel}
        className="block size-4 rounded-full bg-panel shadow-[0_0_0_1.5px_var(--fg),0_2px_6px_rgb(0_0_0/0.25)] transition-transform outline-none hover:scale-110 focus-visible:shadow-[0_0_0_1.5px_var(--fg),0_0_0_5px_var(--active)]"
      />
    </S.Root>
  )
}
