export type GradientBanner = 'sunset' | 'ocean' | 'forest' | 'lavender'

/**
 * Four quiet gradients for people who want a colour, not a picture. Deep and low-chroma so the
 * white text and the glass card on top stay legible; the hero is always rendered dark.
 */
export const BANNER_GRADIENTS: Record<GradientBanner, string> = {
  sunset: 'linear-gradient(135deg, #2a1a24 0%, #7a3a3a 60%, #b8693f 100%)',
  ocean: 'linear-gradient(135deg, #0b1c30 0%, #174a6e 65%, #2a7f94 100%)',
  forest: 'linear-gradient(135deg, #0e1d16 0%, #1f4a36 65%, #4d7a43 100%)',
  lavender: 'linear-gradient(135deg, #1c1830 0%, #46397a 65%, #7f66b4 100%)',
}

export const GRADIENT_BANNERS = Object.keys(BANNER_GRADIENTS) as GradientBanner[]

export function isGradientBanner(id: string): id is GradientBanner {
  return id in BANNER_GRADIENTS
}

/** Neutral backdrop behind a collage or a missing picture: a quiet graphite sheen. */
export const BANNER_NONE =
  'radial-gradient(120% 140% at 0% 0%, #2a2a2a 0%, #161616 55%, #0e0e0e 100%)'

export function bannerBackground(banner: string): string {
  return isGradientBanner(banner) ? BANNER_GRADIENTS[banner] : BANNER_NONE
}
