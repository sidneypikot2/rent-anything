module Auth
  # Email + password sign-in on one entry point: guest (/login), partner (/partner/login)
  # or admin (/admin). Email is unique per role, so the entry point picks the account; one of
  # another role is simply not found. A guest with no account yet signing in (current_user,
  # RAA-175) brings their trips into the account (Guests::Absorb).
  class SignIn < Base
    def initialize(email:, password:, role:, current_user: nil)
      @email = email
      @password = password
      @role = role
      @current_user = current_user
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

      Guests::Absorb.call(from: @current_user, into: user) if @current_user
      IssueTokens.call(user)
    end
  end
end
