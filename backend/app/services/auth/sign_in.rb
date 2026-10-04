module Auth
  # Sign-in with email and password. Wrong credentials raise InvalidCredentials (401) with
  # the same message whether or not the email exists; authenticate_by takes the same time
  # either way.
  class SignIn < ApplicationService
    def initialize(values)
      @values = values
    end

    def call
      require_strings!(User.new, @values, present: %i[email password])
      user = User.authenticate_by(email: @values[:email], password: @values[:password])
      raise InvalidCredentials, "Invalid email or password" unless user

      SessionIssuer.call(user)
    end
  end
end
