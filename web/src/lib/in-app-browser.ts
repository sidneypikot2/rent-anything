// In-app browsers (Messenger, Facebook, Instagram and the like) are embedded webviews, where
// Google refuses to sign anyone in (its disallowed_useragent policy) and its popup can't hand
// the result back, leaving a blank page (RAA-157). These are the user-agent marks they leave:
// FBAN / FBAV / FB_IAB are Meta's apps (Messenger is FBAN/MessengerForiOS, FB_IAB/Orca-Android),
// and "; wv)" is any Android WebView.
const IN_APP = /FBAN|FBAV|FB_IAB|Messenger|Instagram|Line\/|MicroMessenger|musical_ly|TikTok|; wv\)/i;

export function isInAppBrowser(userAgent: string) {
  return IN_APP.test(userAgent);
}

// On Android an intent link opens the page in Chrome, falling back to the page itself.
// iOS has no such link, so the caller explains the way out instead.
export function openInBrowserHref(url: string, userAgent: string) {
  if (!/Android/i.test(userAgent)) return null;
  const { protocol, host, pathname, search } = new URL(url);
  const fallback = encodeURIComponent(url);
  return `intent://${host}${pathname}${search}#Intent;scheme=${protocol.slice(0, -1)};package=com.android.chrome;S.browser_fallback_url=${fallback};end`;
}
