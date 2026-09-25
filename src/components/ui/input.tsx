import { Eye, EyeOff } from 'lucide-react'
import {
  forwardRef,
  useId,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/cn'

export const fieldBase = cn(
  'w-full rounded-lg bg-raised text-fg ring-1 ring-inset ring-line placeholder:text-fg-3',
  'transition-[box-shadow,background-color] duration-150 outline-none',
  'hover:ring-line-strong focus:bg-panel focus:ring-line-strong focus:shadow-[0_0_0_4px_var(--active)]',
  'disabled:opacity-50 aria-[invalid=true]:ring-danger/70',
)

export const Input = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & { size?: 'md' | 'lg' }
>(function Input({ className, size = 'md', ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        fieldBase,
        size === 'lg' ? 'h-11 px-3.5 text-lg' : 'h-9 px-3 text-base',
        className,
      )}
      {...props}
    />
  )
})

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(fieldBase, 'min-h-24 resize-y px-3 py-2.5 text-base leading-6', className)}
      {...props}
    />
  )
})

export const PasswordInput = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & { size?: 'md' | 'lg' }
>(function PasswordInput({ className, ...props }, ref) {
  const { t } = useI18n()
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <Input
        ref={ref}
        type={visible ? 'text' : 'password'}
        className={cn('pr-11', className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        aria-label={visible ? t('auth.hidePassword') : t('auth.showPassword')}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-lg text-fg-3 transition-colors hover:text-fg"
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  )
})

interface FieldProps {
  label: ReactNode
  hint?: ReactNode
  error?: string | null
  children: (props: {
    id: string
    'aria-invalid'?: boolean
    'aria-describedby'?: string
  }) => ReactNode
  className?: string
}

/** Label + control + hint/error with correct ARIA wiring. */
export function Field({ label, hint, error, children, className }: FieldProps) {
  const id = useId()
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined
  return (
    <div className={cn('grid gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-medium text-fg">
        {label}
      </label>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy })}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-fg-3">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
