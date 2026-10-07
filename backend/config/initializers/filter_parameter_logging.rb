# Be sure to restart your server when you modify this file.

# Configure parameters to be partially matched (e.g. passw matches password) and filtered from the log file.
# Use this to limit dissemination of sensitive information.
# See the ActiveSupport::ParameterFilter documentation for supported notations and behaviors.
Rails.application.config.filter_parameters += [
  :passw, :email, :secret, :token, :_key, :crypt, :salt, :certificate, :otp, :ssn, :cvv, :cvc,
  # Didit webhooks (RAA-44) carry the ID check's findings (name, birth date, document
  # number, image links); we keep only the outcome, so they stay out of the logs too.
  :decision, :expected_details, :contact_details
]
