# Error reporting to Sentry (project "backend" in the tripkonext org). Errors only: no
# tracing. Nothing is sent unless SENTRY_DSN is set, so development and specs stay local;
# the staging instance sets it in backend.env and SENTRY_RELEASE (the deployed commit) in
# deploy/staging/compose.yml.
#
# What leaves the app is set explicitly, because sentry-ruby 7's defaults send request
# bodies and client IPs: no bodies (they carry names, phone numbers and Didit findings),
# no cookies, no IP, no job arguments or SQL values, and no breadcrumbs (Rails' request
# breadcrumbs carry the params, body included); the signed-in user is sent by id only
# (ApplicationController). Query params, extra and contexts go through the same filter as the
# logs (filter_parameter_logging.rb, which loads before this file). Free text is not filtered:
# an exception's message goes as raised.
if ENV["SENTRY_DSN"].present?
  Sentry.init do |config|
    config.dsn = ENV["SENTRY_DSN"]
    config.environment = Rails.env
    config.release = ENV["SENTRY_RELEASE"].presence

    data = config.data_collection
    data.user_info = false
    data.cookies = false
    data.http_bodies = []
    data.http_headers.request.terms = Sentry::DataCollection::PII_HEADER_SNIPPETS
    data.http_headers.response.terms = Sentry::DataCollection::PII_HEADER_SNIPPETS
    # A job's positional arguments and SQL values can't be filtered by key.
    data.queues = false
    data.database_query_data = false

    filter = ActiveSupport::ParameterFilter.new(Rails.application.config.filter_parameters)
    config.before_send = lambda do |event, _hint|
      event.extra = filter.filter(event.extra) if event.extra.present?
      event.contexts = filter.filter(event.contexts) if event.contexts.present?
      if event.request&.query_string.is_a?(Hash)
        event.request.query_string = filter.filter(event.request.query_string)
      end
      event
    end
  end
end
