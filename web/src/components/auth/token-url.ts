// The emailed links' tokens (/confirm-email?token=…, /reset-password?token=…, RAA-215) leave the
// address bar as soon as the page has read them, so they aren't kept in the history or sent on
// in a Referer. history.replaceState, which Next's router follows, rather than router.replace:
// that would render the page again from the server, without its token.
export function dropTokenFromUrl() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("token")) return;
  url.searchParams.delete("token");
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}
