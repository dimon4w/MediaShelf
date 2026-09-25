import { ExternalLink } from 'lucide-react'
import { Link } from 'react-router'
import { REGIONS, isRegion } from '@shared/regions.ts'
import type { StoreId, TitleRecord } from '@shared/types.ts'
import { BrandIcon } from '@/components/BrandIcon'
import { Button } from '@/components/ui/button'
import { Badge, Skeleton } from '@/components/ui/misc'
import { useI18n } from '@/i18n'
import { useOffers, useRegion, useUser } from '@/lib/queries'
import { titleName } from '@/lib/titles'

const SEARCH: Record<StoreId, (q: string) => string> = {
  steam: (q) => `https://store.steampowered.com/search/?term=${q}`,
  gog: (q) => `https://www.gog.com/games?query=${q}`,
  epic: (q) => `https://store.epicgames.com/browse?q=${q}&sortBy=relevancy`,
  xbox: (q) => `https://www.xbox.com/search?q=${q}`,
  playstation: (q) => `https://store.playstation.com/search/${q}`,
  nintendo: (q) => `https://www.nintendo.com/search/#q=${q}`,
}

export function OffersSection({ title }: { title: TitleRecord }) {
  const { t, locale, fmt } = useI18n()
  const offers = useOffers(title.id, true)
  const region = useRegion()
  const user = useUser()
  const regionName = isRegion(region) ? REGIONS[region][locale] : region
  const query = encodeURIComponent(title.names.en ?? title.names.original)
  const found = new Set((offers.data ?? []).map((offer) => offer.store))
  const others = (Object.keys(SEARCH) as StoreId[]).filter((store) => !found.has(store))

  return (
    <section
      aria-labelledby="offers-heading"
      className="rounded-xl bg-raised ring-1 ring-line ring-inset"
    >
      <div className="px-4 pt-3.5 pb-2">
        <h2 id="offers-heading" className="text-md font-semibold">
          {t('offers.title')}
        </h2>
        <p className="mt-0.5 text-xs text-fg-3">
          {t('offers.region', { region: regionName })}
          {user ? (
            <>
              {' · '}
              <Link
                to="/settings/games"
                className="underline-offset-2 hover:text-fg hover:underline"
              >
                {t('offers.change')}
              </Link>
            </>
          ) : null}
        </p>
      </div>
      <div className="px-2 pb-2">
        {offers.isLoading ? (
          <div className="grid gap-2 p-2">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        ) : offers.data?.length ? (
          <ul className="grid">
            {offers.data.map((offer) => (
              <li key={`${offer.store}-${offer.url}`}>
                <a
                  href={offer.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-hover"
                >
                  <BrandIcon id={offer.store} className="size-5 text-fg-2" />
                  <span className="min-w-0 flex-1 truncate text-base">
                    {t(`stores.${offer.store}`)}
                  </span>
                  {offer.discountPercent ? (
                    <Badge variant="solid">
                      {t('offers.discount', { value: offer.discountPercent })}
                    </Badge>
                  ) : null}
                  <span className="text-right">
                    {offer.isFree || offer.price === 0 ? (
                      <span className="text-base font-medium">{t('offers.free')}</span>
                    ) : offer.price !== undefined && offer.currency ? (
                      <>
                        <span className="tabular block text-base font-medium">
                          {fmt.currency(offer.price, offer.currency)}
                        </span>
                        {offer.originalPrice && offer.originalPrice > offer.price ? (
                          <span className="tabular block text-xs text-fg-3 line-through">
                            {fmt.currency(offer.originalPrice, offer.currency)}
                          </span>
                        ) : null}
                      </>
                    ) : (
                      <ExternalLink className="size-4 text-fg-3" />
                    )}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <div className="px-2 py-3">
            <p className="text-sm font-medium">{t('offers.none')}</p>
            <p className="mt-0.5 text-xs text-fg-3">{t('offers.noneText')}</p>
          </div>
        )}
      </div>
      {others.length ? (
        <div className="border-t border-line-subtle px-4 py-3">
          <p className="mb-2 text-xs font-medium text-fg-3">{t('offers.searchElsewhere')}</p>
          <div className="flex flex-wrap gap-1.5">
            {others.map((store) => (
              <Button key={store} asChild variant="outline" size="xs">
                <a
                  href={SEARCH[store](query)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${t(`stores.${store}`)}: ${titleName(title.names, locale)}`}
                >
                  <BrandIcon id={store} className="!size-3.5" />
                  {t(`stores.${store}`)}
                </a>
              </Button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}
