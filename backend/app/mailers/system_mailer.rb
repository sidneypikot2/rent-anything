# Mail about the system itself, not about a booking. test_email checks the SMTP set-up:
# bin/rails mail:test TO=you@example.com
class SystemMailer < ApplicationMailer
  def test_email(to:)
    @environment = Rails.env
    @smtp_server = ENV["SMTP_ADDRESS"].presence || "none (not sent)"
    mail(to:, subject: "TripKoNext test email")
  end
end
