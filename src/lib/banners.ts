import type { BannerId } from '@shared/types.ts'

/**
 * Profile banner presets. Deep, low-chroma gradients so the white text and the glass
 * card on top stay legible; the hero is always rendered in the dark palette.
 */
export const BANNER_GRADIENTS: Record<Exclude<BannerId, 'none' | 'favorite'>, string> = {
  sunset: 'linear-gradient(135deg, #3b1d2e 0%, #7a2e3a 45%, #c2683f 100%)',
  ocean: 'linear-gradient(135deg, #0b1d33 0%, #11446b 50%, #1f7a8c 100%)',
  forest: 'linear-gradient(135deg, #0d1f17 0%, #1d4a35 55%, #4f7a3f 100%)',
  lavender: 'linear-gradient(135deg, #1e1934 0%, #4a3a7a 55%, #8a6fb8 100%)',
  candy: 'linear-gradient(135deg, #2c1430 0%, #8a2f6b 50%, #d9708f 100%)',
  steel: 'linear-gradient(135deg, #15181d 0%, #333a44 55%, #5d6774 100%)',
  sunrise: 'linear-gradient(135deg, #2a1a0e 0%, #8a4b17 50%, #e0a24a 100%)',
  midnight: 'linear-gradient(135deg, #05060a 0%, #111a33 55%, #26355f 100%)',
}

/** Neutral backdrop for "no background": a quiet graphite sheen, not a flat block. */
export const BANNER_NONE =
  'radial-gradient(120% 140% at 0% 0%, #2a2a2a 0%, #161616 55%, #0e0e0e 100%)'

export function bannerBackground(banner: BannerId): string {
  if (banner === 'none' || banner === 'favorite') return BANNER_NONE
  return BANNER_GRADIENTS[banner]
}
