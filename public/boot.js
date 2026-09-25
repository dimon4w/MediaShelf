// Applies the saved theme and language before first paint (no flash). Kept tiny and CSP-safe.
;(function () {
  var root = document.documentElement
  try {
    var theme = localStorage.getItem('mediashelf:theme') || 'system'
    var dark =
      theme === 'dark' ||
      (theme !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    root.classList.toggle('dark', dark)
    root.dataset.theme = dark ? 'dark' : 'light'
    var locale = localStorage.getItem('mediashelf:locale')
    if (!locale) locale = /^ru\b/i.test(navigator.language || '') ? 'ru' : 'en'
    root.lang = locale === 'en' ? 'en' : 'ru'
    var meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', dark ? '#0a0a0a' : '#f5f5f5')
  } catch (error) {
    /* storage unavailable: keep defaults */
  }
})()
