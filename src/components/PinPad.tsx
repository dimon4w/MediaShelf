import { motion } from 'motion/react'
import { useRef, useState } from 'react'
import { cn } from '@/lib/cn'

/**
 * PIN pad: dots spring in as you type, shake on error,
 * burst into green on success.
 */
export function PinPad({
  onComplete,
  status,
  label,
  autoFocus,
  length = 4,
}: {
  onComplete(pin: string): void
  status: 'idle' | 'error' | 'success'
  label: string
  autoFocus?: boolean
  length?: number
}) {
  const [pin, setPin] = useState('')
  const input = useRef<HTMLInputElement>(null)

  const type = (value: string) => {
    const digits = value.replaceAll(/\D/g, '').slice(0, length)
    setPin(digits)
    if (digits.length === length) {
      onComplete(digits)
      // Let the user see the full row before the parent clears or advances.
      setTimeout(() => setPin(''), 450)
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => input.current?.focus()}
        aria-label={label}
        className="mx-auto block rounded-2xl outline-offset-4"
      >
        <motion.div
          animate={status === 'error' ? { x: [0, -12, 12, -8, 8, 0] } : { x: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-center gap-4"
        >
          {[0, 1, 2, 3, 4, 5].slice(0, length).map((index) => {
            const filled = index < pin.length
            // The next empty cell stays "armed": dull grey so you see where you type.
            const armed = index === pin.length && status === 'idle'
            return (
              <motion.span
                key={`${index}-${status === 'success' ? 'done' : 'live'}`}
                initial={false}
                animate={
                  status === 'success'
                    ? { scale: [1, 1.5, 1], backgroundColor: ['var(--fg)', '#22c55e', '#22c55e'] }
                    : filled
                      ? { scale: [0.4, 1.15, 1] }
                      : { scale: 1 }
                }
                transition={
                  status === 'success'
                    ? { duration: 0.5, delay: index * 0.07 }
                    : { type: 'spring', stiffness: 600, damping: 22 }
                }
                className={cn(
                  'grid size-14 place-items-center rounded-2xl ring-1 ring-inset',
                  status === 'error'
                    ? 'bg-danger/10 ring-danger'
                    : filled || status === 'success'
                      ? 'bg-active ring-line-strong'
                      : armed
                        ? 'bg-active/60 ring-line-strong'
                        : 'bg-raised ring-line',
                )}
              >
                <span
                  className={cn(
                    'size-3.5 rounded-full transition-colors',
                    status === 'success'
                      ? 'bg-[#22c55e]'
                      : filled
                        ? 'bg-fg'
                        : armed
                          ? 'bg-fg-3'
                          : 'bg-line-strong',
                  )}
                />
              </motion.span>
            )
          })}
        </motion.div>
      </button>
      <input
        ref={input}
        value={pin}
        onChange={(event) => type(event.target.value)}
        onPaste={(event) => {
          // Some keyboards hand over the clipboard in pieces; take it whole.
          event.preventDefault()
          type(event.clipboardData.getData('text'))
        }}
        type="password"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={length}
        aria-label={label}
        autoFocus={autoFocus}
        className="sr-only"
      />
    </div>
  )
}
