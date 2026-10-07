import { useQueryClient } from '@tanstack/react-query'
import { useId, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { isRegion, regionLabel, REGIONS, type RegionCode } from '@shared/regions.ts'
import { PLATFORMS, STORES, type PlatformId, type StoreId, type User } from '@shared/types.ts'
import { useErrorMessage } from '@/components/library-actions'
import { Chip } from '@/components/ui/misc'
import { Select } from '@/components/ui/select'
import { useI18n } from '@/i18n'
import { keys, useUpdateProfile } from '@/lib/queries'
import { Group, Row, SectionHeading } from './layout'

interface GamePrefs {
  platforms: PlatformId[]
  stores: StoreId[]
  region: RegionCode
}

const pick = ({ platforms, stores, region }: User['preferences']): GamePrefs => ({
  platforms,
  stores,
  region: isRegion(region) ? region : 'US',
})

/** Toggles `value`, keeping the canonical order of `all`. */
const toggle = <T extends string>(all: readonly T[], selected: readonly T[], value: T) =>
  all.filter((item) => (item === value) !== selected.includes(item))

export function GamesSection({ user }: { user: User }) {
  const { t, locale } = useI18n()
  const client = useQueryClient()
  const update = useUpdateProfile()
  const message = useErrorMessage()
  const [prefs, setPrefs] = useState(() => pick(user.preferences))
  const platformsId = useId()
  const storesId = useId()
  const regionId = useId()

  // Optimistic: every change sends the whole group, so the latest request always matches the screen.
  const save = (patch: Partial<GamePrefs>) => {
    const next = { ...prefs, ...patch }
    setPrefs(next)
    update.mutate(
      { preferences: next },
      {
        onError: (error) => {
          const saved = client.getQueryData<{ user: User | null }>(keys.session)?.user
          if (saved) setPrefs(pick(saved.preferences))
          toast.error(message(error))
        },
      },
    )
  }

  const regions = useMemo(
    () =>
      (Object.keys(REGIONS) as RegionCode[])
        .map((code) => ({
          value: code,
          label: `${regionLabel(code, locale)} · ${REGIONS[code].currency}`,
        }))
        .sort((a, b) => a.label.localeCompare(b.label, locale)),
    [locale],
  )

  return (
    <>
      <SectionHeading title={t('settings.games')} text={t('settings.gamesText')} />
      <Group>
        <Row
          title={t('settings.platforms')}
          titleId={platformsId}
          description={t('settings.platformsHint')}
        >
          <div role="group" aria-labelledby={platformsId} className="flex flex-wrap gap-2">
            {PLATFORMS.map((id) => (
              <Chip
                key={id}
                active={prefs.platforms.includes(id)}
                onClick={() => save({ platforms: toggle(PLATFORMS, prefs.platforms, id) })}
              >
                {t(`platforms.${id}`)}
              </Chip>
            ))}
          </div>
        </Row>
        <Row title={t('settings.stores')} titleId={storesId} description={t('settings.storesHint')}>
          <div role="group" aria-labelledby={storesId} className="flex flex-wrap gap-2">
            {STORES.map((id) => (
              <Chip
                key={id}
                active={prefs.stores.includes(id)}
                onClick={() => save({ stores: toggle(STORES, prefs.stores, id) })}
              >
                {t(`stores.${id}`)}
              </Chip>
            ))}
          </div>
        </Row>
        <Row
          title={t('settings.region')}
          htmlFor={regionId}
          description={t('settings.regionHint')}
          action={
            <Select
              id={regionId}
              value={prefs.region}
              onValueChange={(region) => region !== prefs.region && save({ region })}
              options={regions}
              className="w-full @md:w-60"
            />
          }
        />
      </Group>
    </>
  )
}
