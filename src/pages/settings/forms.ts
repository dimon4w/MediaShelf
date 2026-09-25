import { useErrorMessage } from '@/components/library-actions'
import { useI18n, type MessageKey } from '@/i18n'
import { ApiError } from '@/lib/api'

export type FormErrors<K extends string> = Partial<Record<K | 'form', string>>

interface Issue {
  path: readonly PropertyKey[]
  message: string
}

/** Turns zod issues and API errors into per-field messages, falling back to a form-level one. */
export function useFormErrors<K extends string>(fields: readonly K[]) {
  const { t } = useI18n()
  const message = useErrorMessage()
  const text = (code: string) =>
    t(`errors.fields.${/^[a-z_]+$/.test(code) ? code : 'invalid'}` as MessageKey)
  const known = (key: string): key is K => (fields as readonly string[]).includes(key)
  return {
    fromIssues(issues: readonly Issue[]) {
      const result: FormErrors<K> = {}
      for (const issue of issues) {
        const key = String(issue.path[0])
        if (known(key)) result[key] ??= text(issue.message)
      }
      return result
    },
    fromError(error: unknown) {
      const result: FormErrors<K> = {}
      if (error instanceof ApiError)
        for (const [key, code] of Object.entries(error.fields))
          if (known(key)) result[key] = text(code)
      if (!Object.keys(result).length) result.form = message(error)
      return result
    },
  }
}
