# Mail about an account itself (RAA-214), to guests and partners alike: the link that confirms its
# email and the link that chooses a new password. Both open the web app's pages, which send the
# token back to the API.
class AccountMailer < ApplicationMailer
  def email_confirmation(user, token)
    @link = web_url("/confirm-email?token=#{ERB::Util.url_encode(token)}")
    @hours = User::EMAIL_CONFIRMATION_LIFETIME.in_hours.to_i
    mail(to: user.email, subject: "Confirm your TripKoNext email")
  end

  def password_reset(user, token)
    @link = web_url("/reset-password?token=#{ERB::Util.url_encode(token)}")
    @minutes = User::PASSWORD_RESET_LIFETIME.in_minutes.to_i
    mail(to: user.email, subject: "Choose a new TripKoNext password")
  end
end
