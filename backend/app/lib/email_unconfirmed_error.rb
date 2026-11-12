# A password account checking out or paying before it has confirmed its email (RAA-214).
# Rendered as 403 with code "email_unconfirmed", so the web app can offer to send the link again.
class EmailUnconfirmedError < StandardError
  CODE = "email_unconfirmed".freeze

  def initialize(msg = "Confirm your email first: open the link we emailed you, or ask for a new one.")
    super
  end
end
