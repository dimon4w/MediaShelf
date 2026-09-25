export type DeviceType = 'desktop' | 'mobile' | 'tablet'

export interface DeviceInfo {
  /** "Chrome · Windows", or null when nothing is recognisable. */
  label: string | null
  type: DeviceType
}

// Order matters: Chromium-based browsers also claim Chrome and Safari.
const BROWSERS: [RegExp, string][] = [
  [/EdgA?\/|EdgiOS\/|Edge\//, 'Edge'],
  [/YaBrowser\//, 'Yandex Browser'],
  [/OPR\/|OPT\/|Opera/, 'Opera'],
  [/SamsungBrowser\//, 'Samsung Internet'],
  [/Vivaldi\//, 'Vivaldi'],
  [/Firefox\/|FxiOS\//, 'Firefox'],
  [/Chrome\/|CriOS\/|Chromium\//, 'Chrome'],
  [/Version\/[\d.]+.*Safari\//, 'Safari'],
]

const SYSTEMS: [RegExp, string][] = [
  [/Windows/, 'Windows'],
  [/iPad/, 'iPadOS'],
  [/iPhone|iPod/, 'iOS'],
  [/Android/, 'Android'],
  [/CrOS/, 'ChromeOS'],
  [/Macintosh|Mac OS X/, 'macOS'],
  [/Linux/, 'Linux'],
]

export function describeUserAgent(userAgent: string | null): DeviceInfo {
  if (!userAgent) return { label: null, type: 'desktop' }
  const browser = BROWSERS.find(([pattern]) => pattern.test(userAgent))?.[1]
  const system = SYSTEMS.find(([pattern]) => pattern.test(userAgent))?.[1]
  const type: DeviceType =
    /iPad|Tablet/.test(userAgent) || (/Android/.test(userAgent) && !/Mobile/.test(userAgent))
      ? 'tablet'
      : /Mobi|iPhone|iPod/.test(userAgent)
        ? 'mobile'
        : 'desktop'
  const label = [browser, system].filter(Boolean).join(' · ')
  return { label: label || null, type }
}
