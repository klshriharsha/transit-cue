// iOS (Safari, Chrome, or any other browser — all run on WebKit there) only exposes the Push
// API to a site once it's been added to the Home Screen and is running standalone; a regular
// browser tab always reports push as unsupported, no matter the browser.
export function isIosOutsideHomeScreenApp(nav: Navigator): boolean {
  const isIos = /iphone|ipad|ipod/i.test(nav.userAgent) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1)

  if (!isIos) return false

  const isStandalone =
    (nav as Navigator & { standalone?: boolean }).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches

  return !isStandalone
}
