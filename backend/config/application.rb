require_relative "boot"

require "rails"
# Pick the frameworks you want:
require "active_model/railtie"
require "active_job/railtie"
require "active_record/railtie"
# require "active_storage/engine"
require "action_controller/railtie"
require "action_mailer/railtie"
# require "action_mailbox/engine"
# require "action_text/engine"
require "action_view/railtie"
require "action_cable/engine"
# require "rails/test_unit/railtie"

# Require the gems listed in Gemfile, including any gems
# you've limited to :test, :development, or :production.
Bundler.require(*Rails.groups)

module Backend
  class Application < Rails::Application
    # Initialize configuration defaults for originally generated Rails version.
    config.load_defaults 8.1

    # Please, add to the `ignore` list any other `lib` subdirectories that do
    # not contain `.rb` files, or that should not be reloaded or eager loaded.
    # Common ones are `templates`, `generators`, or `middleware`, for example.
    config.autoload_lib(ignore: %w[assets tasks])

    # Configuration for the application, engines, and railties goes here.
    #
    # These settings can be overridden in specific environments using the files
    # in config/environments, which are processed later.
    #
    # config.time_zone = "Central Time (US & Canada)"
    # config.eager_load_paths << Rails.root.join("extras")

    # Only loads a smaller set of middleware suitable for API only apps.
    # Middleware like session, flash, cookies can be added back manually.
    # Skip views, helpers and assets when generating a new resource.
    config.api_only = true
    # The refresh token's HttpOnly cookie (RAA-306, RefreshCookie); there is no cookie session.
    config.middleware.use ActionDispatch::Cookies

    # Active Record Encryption (RAA-145: payout account numbers). The keys come from the
    # environment on staging; development and test set fixed, non-secret ones of their own.
    config.active_record.encryption.primary_key = ENV["ACTIVE_RECORD_ENCRYPTION_PRIMARY_KEY"]
    config.active_record.encryption.deterministic_key = ENV["ACTIVE_RECORD_ENCRYPTION_DETERMINISTIC_KEY"]
    config.active_record.encryption.key_derivation_salt = ENV["ACTIVE_RECORD_ENCRYPTION_KEY_DERIVATION_SALT"]

    # The web app's origin (FRONTEND_ORIGIN), exactly, no trailing slash, or a comma-separated
    # list: CORS allows each (config/initializers/cors.rb), and links back to the web app (emails,
    # PayMongo's and Didit's return URLs) use the first. Staging and production have no default
    # (RAA-218): without it the boot fails, rather than allowing localhost or linking elsewhere.
    # docker-compose.yml sets it for the local stack.
    frontend_origin = Rails.env.local? ? ENV.fetch("FRONTEND_ORIGIN", "http://localhost:8100") : ENV.fetch("FRONTEND_ORIGIN")
    config.x.frontend_origins = frontend_origin.split(",").map(&:strip).reject(&:empty?)
  end
end
