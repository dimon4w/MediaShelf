import { ArrowUpRight, Star, ThumbsUp } from 'lucide-react'
import type { MediaItem, StoreOffer } from '../lib/types'
import { countries, defaultPreferences, preferredOffer, sortOffers, stores } from '../lib/platforms'
import { useLibraryStore } from '../store/useLibraryStore'
import StoreIcon, { PlatformIcon } from './StoreIcon'

function Price({ offer }: { offer?: StoreOffer }) {
  if (offer?.price === undefined || !offer.currency)
    return <span className="price-unavailable">Уточнить цену</span>
  if (offer.price === 0) return <span className="price-free">Бесплатно</span>
  const parts = new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: offer.currency,
  }).formatToParts(offer.price / 100)
  return (
    <span className="price-value">
      <strong>
        {parts
          .filter((p) => !['currency', 'literal'].includes(p.type))
          .map((p) => p.value)
          .join('')}
      </strong>
      <span className="price-currency">{offer.currency}</span>
    </span>
  )
}
export function PublicRatings({
  item,
  compact = false,
  showSource = false,
}: {
  item: MediaItem
  compact?: boolean
  showSource?: boolean
}) {
  return (
    <div className={`public-ratings ${compact ? 'is-compact' : ''}`}>
      {item.ratings?.map((rating) => (
        <span
          key={rating.source}
          aria-label={`${rating.source === 'imdb' ? 'IMDb' : 'Steam'}: ${rating.value}${rating.source === 'steam' ? '%' : ' из 10'}, ${rating.votes.toLocaleString('ru-RU')} голосов`}
          title={`${rating.source === 'imdb' ? 'IMDb' : 'Steam'} · ${rating.votes.toLocaleString('ru-RU')} голосов`}
        >
          {rating.source === 'imdb' ? <Star size={14} /> : <ThumbsUp size={14} />}
          <b>
            {(!compact || showSource) && `${rating.source === 'imdb' ? 'IMDb' : 'Steam'} `}
            {rating.source === 'imdb' ? rating.value.toFixed(1) : `${rating.value}%`}
          </b>
          {!compact && <small>{rating.votes.toLocaleString('ru-RU')} голосов</small>}
        </span>
      ))}
    </div>
  )
}
export function CardPrice({
  item,
  interactive = true,
}: {
  item: MediaItem
  interactive?: boolean
}) {
  const country = useLibraryStore((s) => s.preferences?.country ?? defaultPreferences.country)
  if (item.type !== 'game') return null
  const offer = preferredOffer(item.offers, country)
  if (!offer) return null
  if (!interactive)
    return (
      <span className="card-price">
        <Price offer={offer} />
      </span>
    )
  return (
    <a
      className="card-price"
      href={offer.url}
      target="_blank"
      rel="noreferrer"
      aria-label={`Купить «${item.title}» в ${stores[offer.store]}`}
      title={`${stores[offer.store]} · регион ${countries[country]?.label}`}
    >
      <StoreIcon store={offer.store} size={15} />
      <Price offer={offer} />
    </a>
  )
}
export function StoreOffers({ item }: { item: MediaItem }) {
  const country = useLibraryStore((s) => s.preferences?.country ?? defaultPreferences.country)
  if (item.type !== 'game') return null
  const offers = sortOffers((item.offers ?? []).filter((o) => !o.country || o.country === country))
  return (
    <section className="store-offers" aria-label="Где купить игру">
      <div className="offer-heading">
        <h3>Где можно играть</h3>
        <span className="offer-region">
          Регион магазина <strong>{countries[country]?.label ?? country}</strong>
        </span>
      </div>
      <div className="offer-platforms">
        {item.platforms?.map((platform) => (
          <span key={platform}>
            <PlatformIcon platform={platform} />
            {platform}
          </span>
        ))}
      </div>
      <div className="offer-list">
        {offers.map((offer, index) => (
          <a
            className="store-offer"
            key={`${offer.store}-${index}`}
            href={offer.url}
            target="_blank"
            rel="noreferrer"
            title={
              offer.checkedAt
                ? `Цена проверена ${new Date(offer.checkedAt).toLocaleString('ru-RU')}`
                : undefined
            }
          >
            <StoreIcon store={offer.store} size={22} />
            <span className="offer-name">
              <strong>{stores[offer.store]}</strong>
              {offer.edition && <small>{offer.edition}</small>}
            </span>
            <Price offer={offer} />
            <ArrowUpRight size={17} />
          </a>
        ))}
      </div>
      {!offers.length && <p className="field-help">Предложения магазинов пока недоступны.</p>}
    </section>
  )
}
