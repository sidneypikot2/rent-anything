class ApplicationMailer < ActionMailer::Base
  # Must be the SMTP account's own address: Gmail and GoDaddy rewrite or refuse any other sender.
  default from: -> { ENV.fetch("MAILER_FROM", "TripKoNext <tripkonext@gmail.com>") }
  layout "mailer"
end
