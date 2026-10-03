# The web app (Next.js) calls the API from the browser for signed-in pages; server-rendered
# pages call it server-side, where CORS doesn't apply.
Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    origins ENV.fetch("FRONTEND_ORIGIN", "http://localhost:8080")

    resource "*",
      headers: :any,
      methods: [ :get, :post, :put, :patch, :delete, :options, :head ]
  end
end
