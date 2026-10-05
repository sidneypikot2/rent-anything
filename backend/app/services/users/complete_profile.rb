module Users
  # Finishes sign-up (RAA-32): sign-up asks only for email and password, so a new account
  # sets its name and phone here, and is then registration_complete. Both are required.
  class CompleteProfile < ApplicationService
    PHONE_FORMAT = /\A\+?[0-9 ()-]{7,20}\z/

    def initialize(user, params)
      @user = user
      @params = params
    end

    def call
      name = required_string(:name, "Name")
      phone = required_string(:phone, "Phone")
      invalid!("Phone must be a phone number") unless phone.match?(PHONE_FORMAT)

      @user.update!(name: name, phone: phone, registration_complete: true)
      @user
    end

    private

    def required_string(key, label)
      value = @params[key]
      invalid!("#{label} is required") unless value.is_a?(String) && value.present?
      value.strip
    end

    def invalid!(message)
      @user.errors.add(:base, message)
      raise ActiveRecord::RecordInvalid, @user
    end
  end
end
