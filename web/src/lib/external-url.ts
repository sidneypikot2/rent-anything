// The providers' hosted pages the API sends a user to (RAA-223). The same in every
// environment: PayMongo's test mode and Didit's sandbox use the live hosts.
// PayMongo checkout sessions: https://checkout.paymongo.com/cs_… (backend/app/lib/paymongo.rb).
export const PAYMONGO_HOSTS = ["checkout.paymongo.com", "*.paymongo.com"];
// Didit verification sessions: https://verify.didit.me/session/… (backend/app/lib/didit.rb).
export const DIDIT_HOSTS = ["verify.didit.me", "*.didit.me"];

// A URL from the API to send the browser to, if it's safe to follow: https, on the default
// port, with no credentials, and a host on the allowlist — "host.com" matches that host only,
// "*.host.com" any subdomain of it. `location.assign` follows `javascript:` and any other
// site, so a tampered or wrong response must not reach it.
export function safeExternalUrl(value: unknown, allowedHosts: readonly string[]): string | undefined {
  if (typeof value !== "string") return undefined;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return undefined;
  }
  if (url.protocol !== "https:" || url.port !== "" || url.username !== "" || url.password !== "") return undefined;
  const host = url.hostname;
  const allowed = allowedHosts.some((pattern) =>
    pattern.startsWith("*.") ? host.endsWith(pattern.slice(1)) : host === pattern,
  );
  return allowed ? url.href : undefined;
}
