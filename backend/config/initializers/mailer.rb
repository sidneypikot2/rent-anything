# Outgoing email goes through whichever SMTP server the SMTP_* variables name: Gmail
# (tripkonext@gmail.com) on the local stack and staging, GoDaddy (team@tripkonext.com) in
# production. Each environment's env file picks the account; no code names one.
# Without SMTP_ADDRESS, development keeps :test (nothing is sent). The test env always does.
if ENV["SMTP_ADDRESS"].present? && !Rails.env.test?
  port = ENV.fetch("SMTP_PORT", "587").to_i

  ActiveSupport.on_load(:action_mailer) do
    self.delivery_method = :smtp
    self.raise_delivery_errors = true
    self.smtp_settings = {
      address: ENV.fetch("SMTP_ADDRESS"),
      port:,
      user_name: ENV["SMTP_USERNAME"],
      password: ENV["SMTP_PASSWORD"],
      authentication: :plain,
      # 465 is TLS from the first byte (GoDaddy); 587 upgrades with STARTTLS (Gmail).
      tls: port == 465,
      enable_starttls_auto: port != 465,
      open_timeout: 10,
      read_timeout: 15
    }
  end
end
