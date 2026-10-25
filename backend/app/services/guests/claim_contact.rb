module Guests
  # A guest's contact details at their first checkout (RAA-175): `contact` is
  # {name, email, phone}, all required, for a guest who has no email yet (User#anonymous?).
  # Partners see them on each booking.
  #
  # An email no other guest has is set on this guest, whose profile is then complete. One
  # another guest already has gets a sign-in code by email and a CodeRequiredError (409): the
  # guest signs in with the code (Auth::VerifySignInCode), which moves this guest's trips into
  # that account, and checks out again from there. Returns the user.
  class ClaimContact < ApplicationService
    def initialize(user, contact)
      @user = user
      @contact = contact
    end

    def call
      invalid!("Contact details (name, email and phone) are required to book") unless @contact.respond_to?(:key?)
      name = required_string(:name, "Name")
      email = required_string(:email, "Email")
      phone = required_string(:phone, "Phone")

      owner = User.guest.where.not(id: @user.id).find_by(email: email.downcase)
      if owner
        GuestMailer.sign_in_code(owner, SignInCode.issue!(owner)).deliver_later
        raise CodeRequiredError
      end

      @user.update!(name:, email:, phone:, registration_complete: true)
      @user
    rescue ActiveRecord::RecordNotUnique
      invalid!("Email has already been taken")
    end

    private

    def required_string(key, label)
      value = @contact[key]
      invalid!("#{label} is required") unless value.is_a?(String) && value.present?
      value.strip
    end

    def invalid!(message)
      @user.errors.add(:base, message)
      raise ActiveRecord::RecordInvalid, @user
    end
  end
end
