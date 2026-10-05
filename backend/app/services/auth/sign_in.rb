module Auth
  # Email + password sign-in on one entry point: guest (/login), partner (/partner/login)
  # or admin (/admin). Email is unique per role, so the entry point picks the account; one of
  # another role is simply not found.
  class SignIn < Base
    def initialize(email:, password:, role:)
      @email = email
      @password = password
      @role = role
    end

    def call
      check_role!(@role, User::ROLES)
      require_string!(@email, "Email")
      require_string!(@password, "Password")

      user = User.find_by(email: @email.strip.downcase, role: @role)
      # Accounts made with Google or Facebook have no password to check.
      unless user&.password_digest.present? && user.authenticate(@password)
        raise NotAuthenticatedError, "Wrong email or password"
      end

      IssueTokens.call(user)
    end
  end
end
