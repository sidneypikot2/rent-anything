module Auth
  # Sign-in with email and password. Wrong credentials raise InvalidCredentials (401) with
  # the same message whether or not the email exists; authenticate_by takes the same time
  # either way.
  class SignIn < ApplicationService
    def initialize(values)
      @values = values
    end

    def call
      check_values!
      user = User.authenticate_by(email: @values[:email], password: @values[:password])
      raise InvalidCredentials, "Invalid email or password" unless user

      SessionIssuer.call(user)
    end

    private

    def check_values!
      record = User.new
      require_strings!(record, @values)
      %i[email password].each do |key|
        record.errors.add(key, :blank) if @values[key].blank?
      end
      raise ActiveRecord::RecordInvalid, record if record.errors.any?
    end
  end
end
