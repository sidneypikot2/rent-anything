module Auth
  # Emails an account the link that confirms its email (RAA-214): after a password sign-up, when a
  # guest sets a password (Guests::Register), and on request (POST /email_confirmation). Nothing
  # is sent once the email is confirmed; a guest with no email yet is a 422.
  class SendEmailConfirmation < Base
    def initialize(user)
      @user = user
    end

    def call
      invalid!("Book a trip first: your account needs your email") if @user.anonymous?
      return if @user.email_confirmed?

      AccountMailer.email_confirmation(@user, @user.generate_token_for(:email_confirmation)).deliver_later
      nil
    end
  end
end
