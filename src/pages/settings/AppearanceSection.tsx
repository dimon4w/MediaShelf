import { Monitor, Moon, Sun } from 'lucide-react'
import { useId } from 'react'
import { THEMES, type Locale, type ThemePreference } from '@shared/types.ts'
import { usePreferenceSetters } from '@/app/UserMenu'
import { Segmented } from '@/components/ui/segmented'
import { useI18n, type MessageKey } from '@/i18n'
import { cn } from '@/lib/cn'
import { useTheme } from '@/lib/theme'
import { Group, Row, SectionHeading } from './layout'

// Fixed copies of the index.css tokens: each preview must show its own theme, not the active one.
const TONES = {
  light: {
    canvas: 'bg-[#f5f5f5]',
    panel: 'bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.08)]',
    strong: 'bg-[#171717]',
    muted: 'bg-black/15',
    faint: 'bg-black/[0.07]',
  },
  dark: {
    canvas: 'bg-[#0a0a0a]',
    panel: 'bg-[#141414] shadow-[0_0_0_1px_rgb(255_255_255/0.09)]',
    strong: 'bg-[#ededed]',
    muted: 'bg-white/20',
    faint: 'bg-white/[0.08]',
  },
}

function Mock({ tone }: { tone: 'light' | 'dark' }) {
  const c = TONES[tone]
  return (
    <span className={cn('absolute inset-0 block', c.canvas)}>
      <span
        className={cn('absolute top-[13%] left-[7%] block size-[9%] rounded-[3px]', c.strong)}
      />
      {[30, 41, 52, 63].map((top, index) => (
        <span
          key={top}
          className={cn('absolute left-[7%] block h-[5%] rounded-full', index ? c.faint : c.muted)}
          style={{ top: `${top}%`, width: index ? '13%' : '16%' }}
        />
      ))}
      <span
        className={cn(
          'absolute top-[9%] right-0 bottom-0 left-[29%] block rounded-tl-[5px]',
          c.panel,
        )}
      >
        <span
          className={cn('absolute top-[13%] left-[9%] block h-[8%] w-[40%] rounded-full', c.strong)}
        />
        <span
          className={cn('absolute top-[27%] left-[9%] block h-[5%] w-[26%] rounded-full', c.muted)}
        />
        {[9, 36, 63].map((left) => (
          <span
            key={left}
            className={cn('absolute top-[42%] block h-[46%] w-[22%] rounded-[3px]', c.faint)}
            style={{ left: `${left}%` }}
          />
        ))}
      </span>
    </span>
  )
}

function ThemePreview({ theme }: { theme: ThemePreference }) {
  if (theme !== 'system') return <Mock tone={theme} />
  return (
    <>
      <Mock tone="light" />
      <span className="absolute inset-0 block [clip-path:polygon(60%_0,100%_0,100%_100%,40%_100%)]">
        <Mock tone="dark" />
      </span>
    </>
  )
}

const THEME_META: Record<ThemePreference, { label: MessageKey; icon: typeof Sun }> = {
  system: { label: 'settings.themeSystem', icon: Monitor },
  light: { label: 'settings.themeLight', icon: Sun },
  dark: { label: 'settings.themeDark', icon: Moon },
}

function ThemeOption({
  theme,
  name,
  checked,
  onSelect,
}: {
  theme: ThemePreference
  name: string
  checked: boolean
  onSelect(): void
}) {
  const { t } = useI18n()
  const { label, icon: Icon } = THEME_META[theme]
  return (
    <label className="group block min-w-0 cursor-pointer">
      <input
        type="radio"
        name={name}
        value={theme}
        checked={checked}
        onChange={onSelect}
        className="peer sr-only"
      />
      <span
        className={cn(
          'relative block aspect-[16/10] overflow-hidden rounded-lg transition-shadow duration-150',
          'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-fg',
          checked ? 'ring-2 ring-fg' : 'ring-1 ring-line group-hover:ring-line-strong',
        )}
      >
        <ThemePreview theme={theme} />
      </span>
      <span
        className={cn(
          'mt-2.5 flex items-center justify-center gap-1.5 text-center text-sm transition-colors duration-150',
          checked ? 'font-medium text-fg' : 'text-fg-2 group-hover:text-fg',
        )}
      >
        <Icon className="size-3.5 shrink-0 max-sm:hidden" aria-hidden="true" />
        {t(label)}
      </span>
    </label>
  )
}

export function AppearanceSection() {
  const { t, locale } = useI18n()
  const { preference } = useTheme()
  const setters = usePreferenceSetters()
  const themeTitleId = useId()
  const radioName = useId()
  return (
    <>
      <SectionHeading title={t('settings.appearance')} text={t('settings.appearanceText')} />
      <Group>
        <Row
          title={t('settings.theme')}
          titleId={themeTitleId}
          description={t('settings.themeHint')}
        >
          <div
            role="radiogroup"
            aria-labelledby={themeTitleId}
            className="grid grid-cols-3 gap-3 sm:gap-4"
          >
            {THEMES.map((theme) => (
              <ThemeOption
                key={theme}
                theme={theme}
                name={radioName}
                checked={preference === theme}
                onSelect={() => setters.setTheme(theme)}
              />
            ))}
          </div>
        </Row>
        <Row
          title={t('settings.language')}
          description={t('settings.languageHint')}
          action={
            <Segmented<Locale>
              aria-label={t('settings.language')}
              value={locale}
              onChange={setters.setLocale}
              options={[
                { value: 'ru', label: t('settings.languageRu') },
                { value: 'en', label: t('settings.languageEn') },
              ]}
            />
          }
        />
      </Group>
    </>
  )
}
