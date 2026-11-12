module Guests
  # "Create an account to keep this trip" (POST /me/register, RAA-175): a guest who has
  # given their email at checkout sets a password on the same account. They are then
  # registered, so Guests::Purge never deletes their trips; the trip link keeps working. As a
  # password account they confirm their email before checking out or paying again (RAA-214), so
  # the link is emailed to them.
  class Register < ApplicationService
    def initialize(user, params)
      @user = user
      @params = params
    end

    def call
      invalid!("Book a trip first: your account needs your email") if @user.anonymous?
      invalid!("This account already has a password") if @user.password_digest.present?
      password = @params[:password]
      invalid!("Password is required") unless password.is_a?(String) && password.present?

      @user.update!(password:)
      Auth::SendEmailConfirmation.call(@user)
      @user
    end

    private

    def invalid!(message)
      @user.errors.add(:base, message)
      raise ActiveRecord::RecordInvalid, @user
    end
  end
end
