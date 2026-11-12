# The web app (Next.js) calls the API from the browser for signed-in pages; server-rendered
# pages call it server-side, where CORS doesn't apply. The allowed origins are FRONTEND_ORIGIN's,
# read in config/application.rb (RAA-218).
Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    origins(*Rails.configuration.x.frontend_origins)

    resource "*",
      # What the web app sends: the bearer token (web/src/lib/auth/middleware.ts), JSON bodies,
      # and, on the local stack, a photo's Content-MD5 when the browser uploads it to the
      # backend itself (PhotoStorage::Disk). Sentry tracing is off, so no sentry-trace/baggage.
      # X-Refresh-Cookie asks for the refresh token as a cookie (RAA-306, RefreshCookie), which
      # needs credentials: the browser sends and stores the cookie only for an allowed origin.
      headers: %w[Authorization Content-Type Accept Content-MD5 X-Refresh-Cookie],
      credentials: true,
      expose: %w[X-Total-Count X-Page X-Per-Page Link],
      methods: [ :get, :post, :put, :patch, :delete, :options, :head ]
  end
end
