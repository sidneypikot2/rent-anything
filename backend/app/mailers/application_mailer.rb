class ApplicationMailer < ActionMailer::Base
  # Must be the SMTP account's own address: Gmail and GoDaddy rewrite or refuse any other sender.
  default from: -> { ENV.fetch("MAILER_FROM", "TripKoNext <tripkonext@gmail.com>") }
  layout "mailer"

  private

  # A web app page (FRONTEND_ORIGIN): emails never link to the API.
  def web_url(path)
    options = default_url_options
    port = options[:port] ? ":#{options[:port]}" : ""
    "#{options.fetch(:protocol, 'http')}://#{options.fetch(:host)}#{port}#{path}"
  end
end
