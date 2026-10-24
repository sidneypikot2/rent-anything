// Error reporting to Sentry (project "web" in the tripkonext org), shared by the server
// (src/instrumentation.ts) and the browser (src/instrumentation-client.ts). Errors only: no
// tracing or replay. Both values are baked in at build time (web/Dockerfile build args), so
// local builds have no DSN and send nothing. The release, the deployed commit, is injected by
// withSentryConfig in next.config.ts.
export const SENTRY_OPTIONS = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  // "staging" on the Lightsail instance (deploy-staging.yml), like the API's Rails.env.
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV,
  // No IP addresses, cookies or request bodies.
  sendDefaultPii: false,
  tracesSampleRate: 0,
};
